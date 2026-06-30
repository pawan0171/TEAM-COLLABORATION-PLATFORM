const Project = require('../models/Project');
const fs = require('fs');
const path = require('path');
const { cloudinary, isCloudinaryConfigured } = require('../config/cloudinary');

// Helper to get fully populated project details
const getPopulatedProjectById = async (id) => {
  return await Project.findById(id)
    .populate('manager', 'name email role')
    .populate('members', 'name email role')
    .populate('tasks.assignedUser', 'name email role')
    .populate('tasks.comments.user', 'name email role')
    .populate('tasks.attachments.uploadedBy', 'name email role');
};

// @desc    Get projects based on role
// @route   GET /api/projects
// @access  Private
const getProjects = async (req, res) => {
  try {
    let query = {};
    
    // Filter by archived status
    const archivedQuery = req.query.archived === 'true';
    query.isArchived = archivedQuery;

    if (req.user.role === 'Project Manager') {
      query = {
        ...query,
        $or: [{ manager: req.user.id }, { members: req.user.id }],
      };
    } else if (req.user.role === 'Team Member') {
      query = {
        ...query,
        members: req.user.id,
      };
    }
    // Admin gets all projects matching isArchived query filter

    const projects = await Project.find(query)
      .populate('manager', 'name email role')
      .populate('members', 'name email role')
      .sort({ createdAt: -1 });

    res.json(projects);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a project
// @route   POST /api/projects
// @access  Private (Admin & Project Manager only)
const createProject = async (req, res) => {
  const { name, description, status, members, managerId } = req.body;

  try {
    let manager = req.user.id;

    // Admin can assign a different manager, Project Managers are managers of their own projects
    if (req.user.role === 'Admin' && managerId) {
      manager = managerId;
    }

    const project = await Project.create({
      name,
      description,
      status: status || 'Planning',
      manager,
      members: members || [],
      tasks: [],
    });

    const populatedProject = await Project.findById(project._id)
      .populate('manager', 'name email role')
      .populate('members', 'name email role');

    res.status(201).json(populatedProject);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Get project details by ID
// @route   GET /api/projects/:id
// @access  Private
const getProjectById = async (req, res) => {
  try {
    const project = await getPopulatedProjectById(req.params.id);

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Role-based auth: Admin can view all, others must be manager or member
    if (
      req.user.role !== 'Admin' &&
      project.manager._id.toString() !== req.user.id &&
      !project.members.some((m) => m._id.toString() === req.user.id)
    ) {
      return res.status(403).json({ message: 'Not authorized to view this project' });
    }

    res.json(project);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update a project
// @route   PUT /api/projects/:id
// @access  Private (Admin or Project Manager owner)
const updateProject = async (req, res) => {
  const { name, description, status, members, managerId } = req.body;

  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Only Admin or the managing Project Manager can update project details
    if (req.user.role !== 'Admin' && project.manager.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to update this project' });
    }

    project.name = name || project.name;
    project.description = description || project.description;
    project.status = status || project.status;
    if (members) {
      project.members = members;
    }

    if (req.user.role === 'Admin' && managerId) {
      project.manager = managerId;
    }

    const updatedProject = await project.save();

    const populatedProject = await getPopulatedProjectById(updatedProject._id);

    req.io.to(populatedProject._id.toString()).emit('projectUpdated', populatedProject);

    res.json(populatedProject);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a project
// @route   DELETE /api/projects/:id
// @access  Private (Admin or Project Manager owner)
const deleteProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Only Admin or the managing Project Manager can delete
    if (req.user.role !== 'Admin' && project.manager.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to delete this project' });
    }

    await project.deleteOne();
    res.json({ message: 'Project removed successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Add a task to project
// @route   POST /api/projects/:id/tasks
// @access  Private (Admin or Project Manager owner)
const addTask = async (req, res) => {
  const { title, description, priority, status, dueDate, assignedUser } = req.body;

  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Only Admin or managing Project Manager can add tasks
    if (req.user.role !== 'Admin' && project.manager.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to add tasks' });
    }

    project.tasks.push({
      title,
      description: description || '',
      priority: priority || 'Medium',
      status: status || 'Todo',
      assignedUser: assignedUser || null,
      dueDate: dueDate || null,
    });

    await project.save();

    const updatedProject = await getPopulatedProjectById(project._id);

    req.io.to(updatedProject._id.toString()).emit('projectUpdated', updatedProject);

    if (assignedUser) {
      req.io.to(assignedUser.toString()).emit('notification', {
        type: 'assignment',
        title: 'New Task Assignment',
        message: `You have been assigned to task "${title}" in project "${project.name}".`,
        projectId: project._id,
        createdAt: new Date(),
      });
    }

    res.status(201).json(updatedProject);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update a task (status, details, assignments)
// @route   PUT /api/projects/:id/tasks/:taskId
// @access  Private (Admin, Manager, or Members)
const updateTask = async (req, res) => {
  const { title, description, priority, status, dueDate, assignedUser } = req.body;
  const { id, taskId } = req.params;

  try {
    const project = await Project.findById(id);

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const isManager =
      req.user.role === 'Admin' || project.manager.toString() === req.user.id;
    const isMember = project.members.some((m) => m.toString() === req.user.id);

    // Admin, manager, or member can update tasks
    if (!isManager && !isMember) {
      return res.status(403).json({ message: 'Not authorized to update tasks in this project' });
    }

    const task = project.tasks.id(taskId);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    if (isManager) {
      // Manager can update everything
      if (title !== undefined) task.title = title;
      if (description !== undefined) task.description = description;
      if (priority !== undefined) task.priority = priority;
      if (status !== undefined) task.status = status;
      if (dueDate !== undefined) task.dueDate = dueDate;
      if (assignedUser !== undefined) task.assignedUser = assignedUser || null;
    } else {
      // Regular members can only update task status (e.g. dragging cards on Kanban board)
      if (status !== undefined) {
        task.status = status;
      }
      if (
        title !== undefined ||
        description !== undefined ||
        priority !== undefined ||
        dueDate !== undefined ||
        assignedUser !== undefined
      ) {
        return res.status(403).json({ message: 'Only managers or admins can edit task details' });
      }
    }

    await project.save();

    const updatedProject = await getPopulatedProjectById(project._id);

    req.io.to(updatedProject._id.toString()).emit('projectUpdated', updatedProject);

    if (assignedUser) {
      req.io.to(assignedUser.toString()).emit('notification', {
        type: 'assignment',
        title: 'Task Assignment Update',
        message: `You have been assigned to task "${task.title}" in project "${project.name}".`,
        projectId: project._id,
        createdAt: new Date(),
      });
    }

    res.json(updatedProject);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a task
// @route   DELETE /api/projects/:id/tasks/:taskId
// @access  Private (Admin or Project Manager owner)
const deleteTask = async (req, res) => {
  const { id, taskId } = req.params;

  try {
    const project = await Project.findById(id);

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Only Admin or managing Project Manager can delete tasks
    if (req.user.role !== 'Admin' && project.manager.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to delete tasks' });
    }

    const task = project.tasks.id(taskId);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    project.tasks.pull({ _id: taskId });
    await project.save();

    const updatedProject = await getPopulatedProjectById(project._id);

    req.io.to(updatedProject._id.toString()).emit('projectUpdated', updatedProject);

    res.json(updatedProject);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Archive a project
// @route   PUT /api/projects/:id/archive
// @access  Private (Admin or Project Manager owner)
const archiveProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Only Admin or the managing Project Manager can archive
    if (req.user.role !== 'Admin' && project.manager.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to archive this project' });
    }

    project.isArchived = true;
    const updatedProject = await project.save();

    const populatedProject = await getPopulatedProjectById(updatedProject._id);

    req.io.to(populatedProject._id.toString()).emit('projectUpdated', populatedProject);

    res.json(populatedProject);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Unarchive a project
// @route   PUT /api/projects/:id/unarchive
// @access  Private (Admin or Project Manager owner)
const unarchiveProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Only Admin or the managing Project Manager can unarchive
    if (req.user.role !== 'Admin' && project.manager.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to unarchive this project' });
    }

    project.isArchived = false;
    const updatedProject = await project.save();

    const populatedProject = await getPopulatedProjectById(updatedProject._id);

    req.io.to(populatedProject._id.toString()).emit('projectUpdated', populatedProject);

    res.json(populatedProject);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Add a comment to a task
// @route   POST /api/projects/:id/tasks/:taskId/comments
// @access  Private (Admin, PM, or Member of project)
const addComment = async (req, res) => {
  const { text } = req.body;
  const { id, taskId } = req.params;

  if (!text || !text.trim()) {
    return res.status(400).json({ message: 'Comment text is required' });
  }

  try {
    const project = await Project.findById(id);

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const isManager = req.user.role === 'Admin' || project.manager.toString() === req.user.id;
    const isMember = project.members.some((m) => m.toString() === req.user.id);

    if (!isManager && !isMember) {
      return res.status(403).json({ message: 'Not authorized to add comments in this project' });
    }

    const task = project.tasks.id(taskId);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    task.comments.push({
      text,
      user: req.user.id,
    });

    await project.save();

    const updatedProject = await getPopulatedProjectById(project._id);

    // Notify room of task/project updates
    req.io.to(project._id.toString()).emit('projectUpdated', updatedProject);

    // Notify task assignee
    const taskObj = updatedProject.tasks.id(taskId);
    if (taskObj.assignedUser && taskObj.assignedUser._id.toString() !== req.user.id) {
      req.io.to(taskObj.assignedUser._id.toString()).emit('notification', {
        type: 'comment',
        title: 'New Comment on Task',
        message: `${req.user.name} commented on "${taskObj.title}": "${text.substring(0, 30)}${text.length > 30 ? '...' : ''}"`,
        projectId: project._id,
        createdAt: new Date(),
      });
    }

    res.status(201).json(updatedProject);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Upload an attachment to a task
// @route   POST /api/projects/:id/tasks/:taskId/attachments
// @access  Private (Admin, PM, or Member of project)
const uploadAttachment = async (req, res) => {
  const { id, taskId } = req.params;

  if (!req.file) {
    return res.status(400).json({ message: 'Please upload a file' });
  }

  try {
    const project = await Project.findById(id);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const task = project.tasks.id(taskId);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const isManager = req.user.role === 'Admin' || project.manager.toString() === req.user.id;
    const isMember = project.members.some((m) => m.toString() === req.user.id);
    if (!isManager && !isMember) {
      return res.status(403).json({ message: 'Not authorized to upload files to this project' });
    }

    let fileUrl = '';
    let publicId = '';

    const originalName = req.file.originalname;
    const fileExtension = path.extname(originalName).toLowerCase();
    let fileType = 'document';
    if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(fileExtension)) {
      fileType = 'image';
    } else if (fileExtension === '.pdf') {
      fileType = 'pdf';
    }

    if (isCloudinaryConfigured) {
      const uploadPromise = () =>
        new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              folder: 'team_collaboration_attachments',
              resource_type: 'auto',
            },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
          stream.end(req.file.buffer);
        });

      const result = await uploadPromise();
      fileUrl = result.secure_url;
      publicId = result.public_id;
    } else {
      const fileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${fileExtension}`;
      const uploadPath = path.join(__dirname, '../uploads', fileName);

      await fs.promises.writeFile(uploadPath, req.file.buffer);
      fileUrl = `${req.protocol}://${req.get('host')}/uploads/${fileName}`;
      publicId = fileName;
    }

    task.attachments.push({
      name: originalName,
      url: fileUrl,
      publicId,
      fileType,
      uploadedBy: req.user.id,
    });

    await project.save();

    const updatedProject = await getPopulatedProjectById(project._id);

    req.io.to(updatedProject._id.toString()).emit('projectUpdated', updatedProject);

    res.status(201).json(updatedProject);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete an attachment from a task
// @route   DELETE /api/projects/:id/tasks/:taskId/attachments/:attachmentId
// @access  Private (Admin, PM, or Uploader)
const deleteAttachment = async (req, res) => {
  const { id, taskId, attachmentId } = req.params;

  try {
    const project = await Project.findById(id);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const task = project.tasks.id(taskId);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const attachment = task.attachments.id(attachmentId);
    if (!attachment) {
      return res.status(404).json({ message: 'Attachment not found' });
    }

    const isManager = req.user.role === 'Admin' || project.manager.toString() === req.user.id;
    const isUploader = attachment.uploadedBy.toString() === req.user.id;
    
    if (!isManager && !isUploader) {
      return res.status(403).json({ message: 'Not authorized to delete this attachment' });
    }

    if (isCloudinaryConfigured && attachment.publicId) {
      if (attachment.url.includes('cloudinary')) {
        await cloudinary.uploader.destroy(attachment.publicId);
      }
    } else if (attachment.publicId) {
      const filePath = path.join(__dirname, '../uploads', attachment.publicId);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    task.attachments.pull({ _id: attachmentId });
    await project.save();

    const updatedProject = await getPopulatedProjectById(project._id);

    req.io.to(updatedProject._id.toString()).emit('projectUpdated', updatedProject);

    res.json(updatedProject);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getProjects,
  createProject,
  getProjectById,
  updateProject,
  deleteProject,
  addTask,
  updateTask,
  deleteTask,
  archiveProject,
  unarchiveProject,
  addComment,
  uploadAttachment,
  deleteAttachment,
};
