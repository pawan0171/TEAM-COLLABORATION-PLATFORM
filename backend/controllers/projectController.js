const Project = require('../models/Project');
const User = require('../models/User');
const Notification = require('../models/Notification');
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

// Team members must never receive tasks assigned to somebody else. Keep this
// check on the server so hiding cards in the UI cannot be bypassed with an API call.
const projectForUser = (project, user) => {
  if (!project) return null;
  const projectData = project.toObject ? project.toObject() : JSON.parse(JSON.stringify(project));

  if (user.role !== 'Team Member') return projectData;

  const currentUserId = (user._id || user.id)?.toString();
  return {
    ...projectData,
    tasks: (projectData.tasks || []).filter((task) => {
      const assigneeId = (task.assignedUser?._id || task.assignedUser)?.toString();
      return assigneeId && assigneeId === currentUserId;
    }),
  };
};

// Send and persist notification in DB and emit via Socket.io
const sendNotification = async (req, recipientId, notifData) => {
  try {
    const targetRecipient = recipientId?.toString();
    if (!targetRecipient) return null;

    const notification = await Notification.create({
      recipient: targetRecipient,
      sender: req.user?._id || req.user?.id,
      type: notifData.type || 'general',
      title: notifData.title,
      message: notifData.message,
      projectId: notifData.projectId,
      taskId: notifData.taskId,
    });

    if (req.io) {
      req.io.to(targetRecipient).emit('notification', {
        _id: notification._id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        projectId: notification.projectId,
        taskId: notification.taskId,
        isRead: false,
        createdAt: notification.createdAt,
      });
    }

    return notification;
  } catch (err) {
    console.error('Error creating/emitting notification:', err.message);
    return null;
  }
};

// Send each recipient the version of the project they are allowed to see.
// Project rooms are intentionally not used here because they contain members
// with different task visibility permissions.
const emitProjectUpdate = async (req, project) => {
  const recipients = new Map();
  const managerId = (project.manager?._id || project.manager)?.toString();
  if (managerId) recipients.set(managerId, 'Project Manager');

  (project.members || []).forEach((member) => {
    const memberId = (member._id || member)?.toString();
    if (memberId) recipients.set(memberId, member.role || 'Team Member');
  });

  const admins = await User.find({ role: 'Admin' }).select('_id role');
  admins.forEach((admin) => recipients.set(admin._id.toString(), admin.role));

  recipients.forEach((role, recipientId) => {
    req.io.to(recipientId).emit('projectUpdated', projectForUser(project, { id: recipientId, role }));
  });
};

const notifyTaskEdit = async (req, project, task) => {
  const recipientIds = new Set();
  const managerId = (project.manager?._id || project.manager)?.toString();
  if (managerId) recipientIds.add(managerId);

  const admins = await User.find({ role: 'Admin' }).select('_id');
  admins.forEach((admin) => recipientIds.add(admin._id.toString()));

  const currentUserId = (req.user?._id || req.user?.id)?.toString();
  if (currentUserId) recipientIds.delete(currentUserId);

  const isCompleted = task.status === 'Completed';
  const title = isCompleted
    ? 'Task Completed by Team Member'
    : 'Task Updated by Team Member';
  const message = isCompleted
    ? `${req.user.name} marked task "${task.title}" as completed in project "${project.name}".`
    : `${req.user.name} updated task "${task.title}" (${task.status}) in project "${project.name}".`;

  for (const recipientId of recipientIds) {
    await sendNotification(req, recipientId, {
      type: isCompleted ? 'task-completed' : 'task-update',
      title,
      message,
      projectId: project._id,
      taskId: task._id,
    });
  }
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
      .populate('tasks.assignedUser', 'name email role')
      .sort({ createdAt: -1 });

    res.json(projects.map((project) => projectForUser(project, req.user)));
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

    res.json(projectForUser(project, req.user));
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

    await emitProjectUpdate(req, populatedProject);

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

    await emitProjectUpdate(req, updatedProject);

    if (assignedUser) {
      const createdTask = updatedProject.tasks[updatedProject.tasks.length - 1];
      await sendNotification(req, assignedUser, {
        type: 'assignment',
        title: 'New Task Assignment',
        message: `You have been assigned to task "${title}" in project "${project.name}".`,
        projectId: project._id,
        taskId: createdTask?._id,
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

    const currentUserId = (req.user?._id || req.user?.id)?.toString();
    const isManager =
      req.user.role === 'Admin' ||
      (project.manager?._id || project.manager)?.toString() === currentUserId;
    const isMember = (project.members || []).some(
      (m) => (m._id || m)?.toString() === currentUserId
    );

    // Admin, manager, or a project member can update tasks.
    if (!isManager && !isMember) {
      return res.status(403).json({ message: 'Not authorized to update tasks in this project' });
    }

    const task = project.tasks.id(taskId);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const existingAssigneeId = (task.assignedUser?._id || task.assignedUser)?.toString();
    const isAssignedMember = isMember && existingAssigneeId && existingAssigneeId === currentUserId;

    if (isManager) {
      // Manager can update everything
      if (title !== undefined) task.title = title;
      if (description !== undefined) task.description = description;
      if (priority !== undefined) task.priority = priority;
      if (status !== undefined) task.status = status;
      if (dueDate !== undefined) task.dueDate = dueDate;
      if (assignedUser !== undefined) task.assignedUser = assignedUser || null;
    } else {
      if (!isAssignedMember) {
        return res.status(403).json({ message: 'You can only edit tasks assigned to you' });
      }
      // Members can update their own work, but cannot reassign to someone else
      if (
        assignedUser !== undefined &&
        assignedUser &&
        assignedUser.toString() !== existingAssigneeId
      ) {
        return res.status(403).json({ message: 'Team members cannot reassign tasks' });
      }
      if (title !== undefined) task.title = title;
      if (description !== undefined) task.description = description;
      if (priority !== undefined) task.priority = priority;
      if (status !== undefined) task.status = status;
      if (dueDate !== undefined) task.dueDate = dueDate;
    }

    await project.save();

    const updatedProject = await getPopulatedProjectById(project._id);

    await emitProjectUpdate(req, updatedProject);

    // If assigned user changed by manager, notify the new assignee
    if (
      isManager &&
      assignedUser &&
      assignedUser.toString() !== existingAssigneeId
    ) {
      await sendNotification(req, assignedUser, {
        type: 'assignment',
        title: 'Task Assignment Update',
        message: `You have been assigned to task "${task.title}" in project "${project.name}".`,
        projectId: project._id,
        taskId: task._id,
      });
    }

    // When edited by a team member, notify manager and admins
    if (!isManager) {
      await notifyTaskEdit(req, project, task);
    }

    res.json(projectForUser(updatedProject, req.user));
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

    await emitProjectUpdate(req, updatedProject);

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

    await emitProjectUpdate(req, populatedProject);

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

    await emitProjectUpdate(req, populatedProject);

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

    if (!isManager && (!task.assignedUser || task.assignedUser.toString() !== req.user.id)) {
      return res.status(403).json({ message: 'You can only comment on tasks assigned to you' });
    }

    task.comments.push({
      text,
      user: req.user.id,
    });

    await project.save();

    const updatedProject = await getPopulatedProjectById(project._id);

    await emitProjectUpdate(req, updatedProject);

    // Notify task assignee if someone else commented
    const taskObj = updatedProject.tasks.id(taskId);
    const assigneeId = (taskObj.assignedUser?._id || taskObj.assignedUser)?.toString();
    const currentUserId = (req.user?._id || req.user?.id)?.toString();

    if (assigneeId && assigneeId !== currentUserId) {
      await sendNotification(req, assigneeId, {
        type: 'comment',
        title: 'New Comment on Task',
        message: `${req.user.name} commented on "${taskObj.title}": "${text.substring(0, 35)}${text.length > 35 ? '...' : ''}"`,
        projectId: project._id,
        taskId: taskObj._id,
      });
    }

    // If non-manager commented, notify manager and admins
    if (!isManager) {
      const recipientIds = new Set();
      const managerId = (project.manager?._id || project.manager)?.toString();
      if (managerId) recipientIds.add(managerId);

      const admins = await User.find({ role: 'Admin' }).select('_id');
      admins.forEach((admin) => recipientIds.add(admin._id.toString()));
      recipientIds.delete(currentUserId);

      for (const recipientId of recipientIds) {
        await sendNotification(req, recipientId, {
          type: 'comment',
          title: 'Task Comment by Team Member',
          message: `${req.user.name} commented on task "${taskObj.title}" in "${project.name}": "${text.substring(0, 35)}${text.length > 35 ? '...' : ''}"`,
          projectId: project._id,
          taskId: taskObj._id,
        });
      }
    }

    res.status(201).json(projectForUser(updatedProject, req.user));
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
    if (!isManager && (!task.assignedUser || task.assignedUser.toString() !== req.user.id)) {
      return res.status(403).json({ message: 'You can only upload files to tasks assigned to you' });
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

    await emitProjectUpdate(req, updatedProject);

    if (!isManager) {
      const recipientIds = new Set();
      const managerId = (project.manager?._id || project.manager)?.toString();
      if (managerId) recipientIds.add(managerId);

      const admins = await User.find({ role: 'Admin' }).select('_id');
      admins.forEach((admin) => recipientIds.add(admin._id.toString()));
      recipientIds.delete((req.user?._id || req.user?.id)?.toString());

      for (const recipientId of recipientIds) {
        await sendNotification(req, recipientId, {
          type: 'attachment',
          title: 'Attachment Uploaded by Team Member',
          message: `${req.user.name} uploaded "${originalName}" for task "${task.title}" in "${project.name}".`,
          projectId: project._id,
          taskId: task._id,
        });
      }
    }

    res.status(201).json(projectForUser(updatedProject, req.user));
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
    const isAssignedMember =
      project.members.some((m) => m.toString() === req.user.id) &&
      task.assignedUser &&
      task.assignedUser.toString() === req.user.id;
    
    if (!isManager && (!isAssignedMember || !isUploader)) {
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

    await emitProjectUpdate(req, updatedProject);

    res.json(projectForUser(updatedProject, req.user));
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
