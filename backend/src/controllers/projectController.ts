import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import Project, { IProjectDocument } from '../models/Project';
import User from '../models/User';
import Notification from '../models/Notification';
import { cloudinary, isCloudinaryConfigured } from '../config/cloudinary';
import { getCache, setCache, delCache, delCacheByPattern } from '../config/redis';

// Invalidate cached project queries and individual project records
export const invalidateProjectCache = async (projectId?: string): Promise<void> => {
  await delCacheByPattern('projects:*');
  if (projectId) {
    await delCache(`project:${projectId}:populated`);
  }
};

export const getPopulatedProjectById = async (id: string | any): Promise<IProjectDocument | null> => {
  return await Project.findById(id)
    .populate('manager', 'name email role')
    .populate('members', 'name email role')
    .populate('tasks.assignedUser', 'name email role')
    .populate('tasks.comments.user', 'name email role')
    .populate('tasks.attachments.uploadedBy', 'name email role');
};

// Team members must never receive tasks assigned to somebody else. Keep this
// check on the server so hiding cards in the UI cannot be bypassed with an API call.
export const projectForUser = (project: any, user: { _id?: any; id?: any; role: string }): any => {
  if (!project) return null;
  const projectData = project.toObject ? project.toObject() : JSON.parse(JSON.stringify(project));

  if (user.role !== 'Team Member') return projectData;

  const currentUserId = (user._id || user.id)?.toString();
  return {
    ...projectData,
    tasks: (projectData.tasks || []).filter((task: any) => {
      const assigneeId = (task.assignedUser?._id || task.assignedUser)?.toString();
      return assigneeId && assigneeId === currentUserId;
    }),
  };
};

// Send and persist notification in DB and emit via Socket.io
export const sendNotification = async (
  req: Request,
  recipientId: string | any,
  notifData: {
    type?: string;
    title: string;
    message: string;
    projectId?: any;
    taskId?: any;
  }
): Promise<any> => {
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
  } catch (err: any) {
    console.error('Error creating/emitting notification:', err.message);
    return null;
  }
};

// Send each recipient the version of the project they are allowed to see.
export const emitProjectUpdate = async (req: Request, project: any): Promise<void> => {
  if (!req.io || !project) return;

  const recipients = new Map<string, string>();
  const managerId = (project.manager?._id || project.manager)?.toString();
  if (managerId) recipients.set(managerId, 'Project Manager');

  (project.members || []).forEach((member: any) => {
    const memberId = (member._id || member)?.toString();
    if (memberId) recipients.set(memberId, member.role || 'Team Member');
  });

  const admins = await User.find({ role: 'Admin' }).select('_id role');
  admins.forEach((admin) => recipients.set(admin._id.toString(), admin.role));

  recipients.forEach((role, recipientId) => {
    req.io?.to(recipientId).emit('projectUpdated', projectForUser(project, { id: recipientId, role }));
  });
};

export const notifyTaskEdit = async (req: Request, project: any, task: any): Promise<void> => {
  const recipientIds = new Set<string>();
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
  const senderName = req.user?.name || 'A team member';
  const message = isCompleted
    ? `${senderName} marked task "${task.title}" as completed in project "${project.name}".`
    : `${senderName} updated task "${task.title}" (${task.status}) in project "${project.name}".`;

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
export const getProjects = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Not authorized' });
      return;
    }

    let query: any = {};
    const archivedQuery = req.query.archived === 'true';
    query.isArchived = archivedQuery;

    const cacheKey = `projects:user:${req.user._id}:role:${req.user.role}:archived:${archivedQuery}`;
    const cachedProjects = await getCache<any[]>(cacheKey);
    if (cachedProjects) {
      res.json(cachedProjects);
      return;
    }

    if (req.user.role === 'Project Manager') {
      query = {
        ...query,
        $or: [{ manager: req.user._id }, { members: req.user._id }],
      };
    } else if (req.user.role === 'Team Member') {
      query = {
        ...query,
        members: req.user._id,
      };
    }

    const projects = await Project.find(query)
      .populate('manager', 'name email role')
      .populate('members', 'name email role')
      .populate('tasks.assignedUser', 'name email role')
      .sort({ createdAt: -1 });

    const scopedProjects = projects.map((project) => projectForUser(project, req.user!));
    await setCache(cacheKey, scopedProjects, 60);

    res.json(scopedProjects);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a project
// @route   POST /api/projects
// @access  Private (Admin & Project Manager only)
export const createProject = async (req: Request, res: Response): Promise<void> => {
  const { name, description, status, members, managerId } = req.body;

  try {
    if (!req.user) {
      res.status(401).json({ message: 'Not authorized' });
      return;
    }

    let manager = req.user._id;

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

    await invalidateProjectCache();

    res.status(201).json(populatedProject);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Get project details by ID
// @route   GET /api/projects/:id
// @access  Private
export const getProjectById = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Not authorized' });
      return;
    }

    const cacheKey = `project:${req.params.id}:populated`;
    let project = await getCache<any>(cacheKey);

    if (!project) {
      project = await getPopulatedProjectById(req.params.id);
      if (project) {
        await setCache(cacheKey, project, 120);
      }
    }

    if (!project) {
      res.status(404).json({ message: 'Project not found' });
      return;
    }

    const currentUserId = req.user._id.toString();
    const managerId = (project.manager?._id || project.manager)?.toString();
    const isMember = (project.members || []).some(
      (m: any) => (m._id || m)?.toString() === currentUserId
    );

    if (req.user.role !== 'Admin' && managerId !== currentUserId && !isMember) {
      res.status(403).json({ message: 'Not authorized to view this project' });
      return;
    }

    res.json(projectForUser(project, req.user));
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update a project
// @route   PUT /api/projects/:id
// @access  Private (Admin or Project Manager owner)
export const updateProject = async (req: Request, res: Response): Promise<void> => {
  const { name, description, status, members, managerId } = req.body;

  try {
    if (!req.user) {
      res.status(401).json({ message: 'Not authorized' });
      return;
    }

    const project = await Project.findById(req.params.id);

    if (!project) {
      res.status(404).json({ message: 'Project not found' });
      return;
    }

    const currentUserId = req.user._id.toString();
    const isOwner = project.manager.toString() === currentUserId;

    if (req.user.role !== 'Admin' && !isOwner) {
      res.status(403).json({ message: 'Not authorized to update this project' });
      return;
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

    await invalidateProjectCache(updatedProject._id.toString());
    await emitProjectUpdate(req, populatedProject);

    res.json(populatedProject);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a project
// @route   DELETE /api/projects/:id
// @access  Private (Admin or Project Manager owner)
export const deleteProject = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Not authorized' });
      return;
    }

    const project = await Project.findById(req.params.id);

    if (!project) {
      res.status(404).json({ message: 'Project not found' });
      return;
    }

    const currentUserId = req.user._id.toString();
    const isOwner = project.manager.toString() === currentUserId;

    if (req.user.role !== 'Admin' && !isOwner) {
      res.status(403).json({ message: 'Not authorized to delete this project' });
      return;
    }

    await project.deleteOne();
    await invalidateProjectCache(req.params.id as string);
    res.json({ message: 'Project removed successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Add a task to project
// @route   POST /api/projects/:id/tasks
// @access  Private (Admin or Project Manager owner)
export const addTask = async (req: Request, res: Response): Promise<void> => {
  const { title, description, priority, status, dueDate, assignedUser } = req.body;

  try {
    if (!req.user) {
      res.status(401).json({ message: 'Not authorized' });
      return;
    }

    const project = await Project.findById(req.params.id);

    if (!project) {
      res.status(404).json({ message: 'Project not found' });
      return;
    }

    const currentUserId = req.user._id.toString();
    const isOwner = project.manager.toString() === currentUserId;

    if (req.user.role !== 'Admin' && !isOwner) {
      res.status(403).json({ message: 'Not authorized to add tasks' });
      return;
    }

    project.tasks.push({
      title,
      description: description || '',
      priority: priority || 'Medium',
      status: status || 'Todo',
      assignedUser: assignedUser || null,
      dueDate: dueDate || null,
      comments: [] as any,
      attachments: [] as any,
    } as any);

    await project.save();

    const updatedProject = await getPopulatedProjectById(project._id);

    await invalidateProjectCache(project._id.toString());
    await emitProjectUpdate(req, updatedProject);

    if (assignedUser && updatedProject) {
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
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update a task (status, details, assignments)
// @route   PUT /api/projects/:id/tasks/:taskId
// @access  Private (Admin, Manager, or Members)
export const updateTask = async (req: Request, res: Response): Promise<void> => {
  const { title, description, priority, status, dueDate, assignedUser } = req.body;
  const id = req.params.id as string;
  const taskId = req.params.taskId as string;

  try {
    if (!req.user) {
      res.status(401).json({ message: 'Not authorized' });
      return;
    }

    const project = await Project.findById(id);

    if (!project) {
      res.status(404).json({ message: 'Project not found' });
      return;
    }

    const currentUserId = req.user._id.toString();
    const isManager =
      req.user.role === 'Admin' ||
      (project.manager?._id || project.manager)?.toString() === currentUserId;
    const isMember = (project.members || []).some(
      (m: any) => (m._id || m)?.toString() === currentUserId
    );

    if (!isManager && !isMember) {
      res.status(403).json({ message: 'Not authorized to update tasks in this project' });
      return;
    }

    const task = project.tasks.id(taskId);
    if (!task) {
      res.status(404).json({ message: 'Task not found' });
      return;
    }

    const existingAssigneeId = (task.assignedUser?._id || task.assignedUser)?.toString();
    const isAssignedMember = isMember && existingAssigneeId && existingAssigneeId === currentUserId;

    if (isManager) {
      if (title !== undefined) task.title = title;
      if (description !== undefined) task.description = description;
      if (priority !== undefined) task.priority = priority;
      if (status !== undefined) task.status = status;
      if (dueDate !== undefined) task.dueDate = dueDate;
      if (assignedUser !== undefined) task.assignedUser = assignedUser || null;
    } else {
      if (!isAssignedMember) {
        res.status(403).json({ message: 'You can only edit tasks assigned to you' });
        return;
      }
      if (
        assignedUser !== undefined &&
        assignedUser &&
        assignedUser.toString() !== existingAssigneeId
      ) {
        res.status(403).json({ message: 'Team members cannot reassign tasks' });
        return;
      }
      if (title !== undefined) task.title = title;
      if (description !== undefined) task.description = description;
      if (priority !== undefined) task.priority = priority;
      if (status !== undefined) task.status = status;
      if (dueDate !== undefined) task.dueDate = dueDate;
    }

    await project.save();

    const updatedProject = await getPopulatedProjectById(project._id);

    await invalidateProjectCache(project._id.toString());
    await emitProjectUpdate(req, updatedProject);

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

    if (!isManager) {
      await notifyTaskEdit(req, project, task);
    }

    res.json(projectForUser(updatedProject, req.user));
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a task
// @route   DELETE /api/projects/:id/tasks/:taskId
// @access  Private (Admin or Project Manager owner)
export const deleteTask = async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const taskId = req.params.taskId as string;

  try {
    if (!req.user) {
      res.status(401).json({ message: 'Not authorized' });
      return;
    }

    const project = await Project.findById(id);

    if (!project) {
      res.status(404).json({ message: 'Project not found' });
      return;
    }

    const currentUserId = req.user._id.toString();
    const isOwner = project.manager.toString() === currentUserId;

    if (req.user.role !== 'Admin' && !isOwner) {
      res.status(403).json({ message: 'Not authorized to delete tasks' });
      return;
    }

    const task = project.tasks.id(taskId);
    if (!task) {
      res.status(404).json({ message: 'Task not found' });
      return;
    }

    project.tasks.pull({ _id: taskId });
    await project.save();

    const updatedProject = await getPopulatedProjectById(project._id);

    await invalidateProjectCache(project._id.toString());
    await emitProjectUpdate(req, updatedProject);

    res.json(updatedProject);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Archive a project
// @route   PUT /api/projects/:id/archive
// @access  Private (Admin or Project Manager owner)
export const archiveProject = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Not authorized' });
      return;
    }

    const project = await Project.findById(req.params.id);

    if (!project) {
      res.status(404).json({ message: 'Project not found' });
      return;
    }

    const currentUserId = req.user._id.toString();
    const isOwner = project.manager.toString() === currentUserId;

    if (req.user.role !== 'Admin' && !isOwner) {
      res.status(403).json({ message: 'Not authorized to archive this project' });
      return;
    }

    project.isArchived = true;
    const updatedProject = await project.save();
    const populatedProject = await getPopulatedProjectById(updatedProject._id);

    await invalidateProjectCache(project._id.toString());
    await emitProjectUpdate(req, populatedProject);

    res.json(populatedProject);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Unarchive a project
// @route   PUT /api/projects/:id/unarchive
// @access  Private (Admin or Project Manager owner)
export const unarchiveProject = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Not authorized' });
      return;
    }

    const project = await Project.findById(req.params.id);

    if (!project) {
      res.status(404).json({ message: 'Project not found' });
      return;
    }

    const currentUserId = req.user._id.toString();
    const isOwner = project.manager.toString() === currentUserId;

    if (req.user.role !== 'Admin' && !isOwner) {
      res.status(403).json({ message: 'Not authorized to unarchive this project' });
      return;
    }

    project.isArchived = false;
    const updatedProject = await project.save();
    const populatedProject = await getPopulatedProjectById(updatedProject._id);

    await invalidateProjectCache(project._id.toString());
    await emitProjectUpdate(req, populatedProject);

    res.json(populatedProject);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Add a comment to a task
// @route   POST /api/projects/:id/tasks/:taskId/comments
// @access  Private (Admin, PM, or Member of project)
export const addComment = async (req: Request, res: Response): Promise<void> => {
  const { text } = req.body;
  const id = req.params.id as string;
  const taskId = req.params.taskId as string;

  if (!text || !text.trim()) {
    res.status(400).json({ message: 'Comment text is required' });
    return;
  }

  try {
    if (!req.user) {
      res.status(401).json({ message: 'Not authorized' });
      return;
    }

    const project = await Project.findById(id);

    if (!project) {
      res.status(404).json({ message: 'Project not found' });
      return;
    }

    const currentUserId = req.user._id.toString();
    const isManager = req.user.role === 'Admin' || project.manager.toString() === currentUserId;
    const isMember = (project.members || []).some(
      (m: any) => (m._id || m)?.toString() === currentUserId
    );

    if (!isManager && !isMember) {
      res.status(403).json({ message: 'Not authorized to add comments in this project' });
      return;
    }

    const task = project.tasks.id(taskId);
    if (!task) {
      res.status(404).json({ message: 'Task not found' });
      return;
    }

    if (!isManager && (!task.assignedUser || task.assignedUser.toString() !== currentUserId)) {
      res.status(403).json({ message: 'You can only comment on tasks assigned to you' });
      return;
    }

    task.comments.push({
      text,
      user: req.user._id,
    } as any);

    await project.save();

    const updatedProject = await getPopulatedProjectById(project._id);

    await invalidateProjectCache(project._id.toString());
    await emitProjectUpdate(req, updatedProject);

    const taskObj = updatedProject?.tasks.id(taskId);
    const assigneeId = (taskObj?.assignedUser?._id || taskObj?.assignedUser)?.toString();

    if (assigneeId && assigneeId !== currentUserId) {
      await sendNotification(req, assigneeId, {
        type: 'comment',
        title: 'New Comment on Task',
        message: `${req.user.name} commented on "${taskObj?.title}": "${text.substring(0, 35)}${text.length > 35 ? '...' : ''}"`,
        projectId: project._id,
        taskId: taskObj?._id,
      });
    }

    if (!isManager) {
      const recipientIds = new Set<string>();
      const managerId = (project.manager?._id || project.manager)?.toString();
      if (managerId) recipientIds.add(managerId);

      const admins = await User.find({ role: 'Admin' }).select('_id');
      admins.forEach((admin) => recipientIds.add(admin._id.toString()));
      recipientIds.delete(currentUserId);

      for (const recipientId of recipientIds) {
        await sendNotification(req, recipientId, {
          type: 'comment',
          title: 'Task Comment by Team Member',
          message: `${req.user.name} commented on task "${taskObj?.title}" in "${project.name}": "${text.substring(0, 35)}${text.length > 35 ? '...' : ''}"`,
          projectId: project._id,
          taskId: taskObj?._id,
        });
      }
    }

    res.status(201).json(projectForUser(updatedProject, req.user));
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Upload an attachment to a task
// @route   POST /api/projects/:id/tasks/:taskId/attachments
// @access  Private (Admin, PM, or Member of project)
export const uploadAttachment = async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const taskId = req.params.taskId as string;

  if (!req.file) {
    res.status(400).json({ message: 'Please upload a file' });
    return;
  }

  try {
    if (!req.user) {
      res.status(401).json({ message: 'Not authorized' });
      return;
    }

    const project = await Project.findById(id);
    if (!project) {
      res.status(404).json({ message: 'Project not found' });
      return;
    }

    const task = project.tasks.id(taskId);
    if (!task) {
      res.status(404).json({ message: 'Task not found' });
      return;
    }

    const currentUserId = req.user._id.toString();
    const isManager = req.user.role === 'Admin' || project.manager.toString() === currentUserId;
    const isMember = (project.members || []).some(
      (m: any) => (m._id || m)?.toString() === currentUserId
    );

    if (!isManager && !isMember) {
      res.status(403).json({ message: 'Not authorized to upload files to this project' });
      return;
    }
    if (!isManager && (!task.assignedUser || task.assignedUser.toString() !== currentUserId)) {
      res.status(403).json({ message: 'You can only upload files to tasks assigned to you' });
      return;
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
      const uploadPromise = (): Promise<{ secure_url: string; public_id: string }> =>
        new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              folder: 'team_collaboration_attachments',
              resource_type: 'auto',
            },
            (error, result) => {
              if (error) reject(error);
              else resolve(result as any);
            }
          );
          stream.end(req.file!.buffer);
        });

      const result = await uploadPromise();
      fileUrl = result.secure_url;
      publicId = result.public_id;
    } else {
      const uploadsDir = path.join(__dirname, '../../uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const fileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${fileExtension}`;
      const uploadPath = path.join(uploadsDir, fileName);

      await fs.promises.writeFile(uploadPath, req.file.buffer);
      fileUrl = `${req.protocol}://${req.get('host')}/uploads/${fileName}`;
      publicId = fileName;
    }

    task.attachments.push({
      name: originalName,
      url: fileUrl,
      publicId,
      fileType,
      uploadedBy: req.user._id,
    } as any);

    await project.save();

    const updatedProject = await getPopulatedProjectById(project._id);

    await invalidateProjectCache(project._id.toString());
    await emitProjectUpdate(req, updatedProject);

    if (!isManager) {
      const recipientIds = new Set<string>();
      const managerId = (project.manager?._id || project.manager)?.toString();
      if (managerId) recipientIds.add(managerId);

      const admins = await User.find({ role: 'Admin' }).select('_id');
      admins.forEach((admin) => recipientIds.add(admin._id.toString()));
      recipientIds.delete(currentUserId);

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
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete an attachment from a task
// @route   DELETE /api/projects/:id/tasks/:taskId/attachments/:attachmentId
// @access  Private (Admin, PM, or Uploader)
export const deleteAttachment = async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const taskId = req.params.taskId as string;
  const attachmentId = req.params.attachmentId as string;

  try {
    if (!req.user) {
      res.status(401).json({ message: 'Not authorized' });
      return;
    }

    const project = await Project.findById(id);
    if (!project) {
      res.status(404).json({ message: 'Project not found' });
      return;
    }

    const task = project.tasks.id(taskId);
    if (!task) {
      res.status(404).json({ message: 'Task not found' });
      return;
    }

    const attachment = task.attachments.id(attachmentId);
    if (!attachment) {
      res.status(404).json({ message: 'Attachment not found' });
      return;
    }

    const currentUserId = req.user._id.toString();
    const isManager = req.user.role === 'Admin' || project.manager.toString() === currentUserId;
    const isUploader = attachment.uploadedBy.toString() === currentUserId;
    const isAssignedMember =
      (project.members || []).some((m: any) => (m._id || m)?.toString() === currentUserId) &&
      task.assignedUser &&
      task.assignedUser.toString() === currentUserId;

    if (!isManager && (!isAssignedMember || !isUploader)) {
      res.status(403).json({ message: 'Not authorized to delete this attachment' });
      return;
    }

    if (isCloudinaryConfigured && attachment.publicId) {
      if (attachment.url.includes('cloudinary')) {
        await cloudinary.uploader.destroy(attachment.publicId);
      }
    } else if (attachment.publicId) {
      const uploadsDir = path.join(__dirname, '../../uploads');
      const filePath = path.join(uploadsDir, attachment.publicId);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    task.attachments.pull({ _id: attachmentId });
    await project.save();

    const updatedProject = await getPopulatedProjectById(project._id);

    await invalidateProjectCache(project._id.toString());
    await emitProjectUpdate(req, updatedProject);

    res.json(projectForUser(updatedProject, req.user));
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
