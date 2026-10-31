'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  CheckSquare,
  Trash2,
  Calendar,
  User as UserIcon,
  AlignLeft,
  MessageSquare,
  Send,
  Paperclip,
  File,
  FileImage,
  FileText,
  FileSpreadsheet,
  Download,
  Upload,
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Task, TaskPriority, TaskStatus, Project, User } from '../types';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (project: Project) => void;
  onUpdateProject?: (project: Project) => void;
  projectId: string;
  projectMembers: User[];
  task?: Task | null;
}

const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onUpdateProject,
  projectId,
  projectMembers,
  task = null,
}) => {
  const { user } = useAuth();
  const isTeamMember = user?.role === 'Team Member';

  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [priority, setPriority] = useState<TaskPriority>('Medium');
  const [status, setStatus] = useState<TaskStatus>('Todo');
  const [assignedUser, setAssignedUser] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  // Comment states
  const [commentText, setCommentText] = useState<string>('');
  const [commentLoading, setCommentLoading] = useState<boolean>(false);

  // File Upload states
  const [uploading, setUploading] = useState<boolean>(false);
  const [dragActive, setDragActive] = useState<boolean>(false);

  // Track task ID and open state to prevent overwriting form fields on live sync
  const [prevTaskId, setPrevTaskId] = useState<string | null>(null);
  const [prevIsOpen, setPrevIsOpen] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && (!prevIsOpen || (task && task._id !== prevTaskId))) {
      if (task) {
        setTitle(task.title || '');
        setDescription(task.description || '');
        setPriority(task.priority || 'Medium');
        setStatus(task.status || 'Todo');
        const assignee =
          typeof task.assignedUser === 'object' && task.assignedUser !== null
            ? task.assignedUser._id
            : task.assignedUser || '';
        setAssignedUser(assignee);
        setDueDate(
          task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : ''
        );
      } else {
        setTitle('');
        setDescription('');
        setPriority('Medium');
        setStatus('Todo');
        setAssignedUser('');
        setDueDate('');
      }
      setError('');
      setPrevTaskId(task?._id || null);
    }
    setPrevIsOpen(isOpen);
  }, [isOpen, task, prevIsOpen, prevTaskId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Task title is required.');
      return;
    }

    setLoading(true);
    setError('');

    const payload: {
      title: string;
      description: string;
      priority: TaskPriority;
      status: TaskStatus;
      dueDate: string | null;
      assignedUser?: string | null;
    } = {
      title,
      description,
      priority,
      status,
      dueDate: dueDate || null,
    };

    if (!isTeamMember) {
      payload.assignedUser = assignedUser || null;
    }

    try {
      let response;
      if (task) {
        // Edit task
        response = await api.put<Project>(`/projects/${projectId}/tasks/${task._id}`, payload);
      } else {
        // Create new task
        response = await api.post<Project>(`/projects/${projectId}/tasks`, payload);
      }
      onSave(response.data);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save task');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!task) return;
    if (!window.confirm('Are you sure you want to delete this task?')) return;

    setLoading(true);
    setError('');
    try {
      const response = await api.delete<Project>(`/projects/${projectId}/tasks/${task._id}`);
      onSave(response.data);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete task');
      setLoading(false);
    }
  };

  const handleCommentSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!task || !commentText.trim()) return;

    setCommentLoading(true);
    setError('');

    try {
      const response = await api.post<Project>(
        `/projects/${projectId}/tasks/${task._id}/comments`,
        { text: commentText }
      );
      if (onUpdateProject) {
        onUpdateProject(response.data);
      }
      setCommentText('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to add comment');
    } finally {
      setCommentLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !task) return;

    if (file.size > 10 * 1024 * 1024) {
      setError('File size exceeds the 10MB limit.');
      return;
    }

    setUploading(true);
    setError('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await api.post<Project>(
        `/projects/${projectId}/tasks/${task._id}/attachments`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      if (onUpdateProject) {
        onUpdateProject(response.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to upload attachment.');
    } finally {
      setUploading(false);
    }
  };

  const handleAttachmentDelete = async (attachmentId: string) => {
    if (!task) return;
    if (!window.confirm('Are you sure you want to delete this attachment?')) return;

    setUploading(true);
    setError('');

    try {
      const response = await api.delete<Project>(
        `/projects/${projectId}/tasks/${task._id}/attachments/${attachmentId}`
      );
      if (onUpdateProject) {
        onUpdateProject(response.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete attachment.');
    } finally {
      setUploading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0] && task) {
      const file = e.dataTransfer.files[0];
      if (file.size > 10 * 1024 * 1024) {
        setError('File size exceeds the 10MB limit.');
        return;
      }

      setUploading(true);
      setError('');

      const formData = new FormData();
      formData.append('file', file);

      try {
        const response = await api.post<Project>(
          `/projects/${projectId}/tasks/${task._id}/attachments`,
          formData,
          {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          }
        );
        if (onUpdateProject) {
          onUpdateProject(response.data);
        }
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to upload attachment.');
      } finally {
        setUploading(false);
      }
    }
  };

  const getFileIcon = (type?: string) => {
    switch (type) {
      case 'image':
        return <FileImage className="h-5 w-5 text-indigo-400" />;
      case 'pdf':
        return <FileText className="h-5 w-5 text-rose-400" />;
      default:
        return <File className="h-5 w-5 text-slate-400" />;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <div
        className={`w-full ${
          task ? 'max-w-5xl' : 'max-w-lg'
        } rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-250`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <CheckSquare className="h-5 w-5 text-indigo-400" />
            {task ? 'Edit Task Workspace' : 'Add New Project Task'}
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-900 hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg bg-rose-500/10 border border-rose-500/20 p-3.5 text-sm text-rose-400">
            {error}
          </div>
        )}

        {isTeamMember && !task && (
          <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3.5 text-xs text-amber-300">
            <strong className="text-amber-200">Role Restriction:</strong> Your account role is{' '}
            <strong>Team Member</strong>. Only Project Managers and Admins have permission to create and assign new project tasks. To create tasks, sign in with a Project Manager or Admin account.
          </div>
        )}

        {isTeamMember && task && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-indigo-500/20 bg-indigo-500/10 px-3.5 py-2.5 text-xs text-indigo-300">
            <CheckSquare className="h-4 w-4 text-indigo-400 shrink-0" />
            <span>
              You are editing your assigned task. Any status changes or updates you save will automatically notify the Project Manager and Admin.
            </span>
          </div>
        )}

        {/* Split Grid for Task Form and Comments/Attachments */}
        <div className={task ? 'grid grid-cols-1 md:grid-cols-5 gap-6 mt-4' : 'mt-4'}>
          {/* Form Panel */}
          <form onSubmit={handleSubmit} className={task ? 'md:col-span-3 space-y-4' : 'space-y-4'}>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Task Title *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-2 block w-full rounded-lg border border-slate-800 bg-slate-900/50 py-2.5 px-3 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                placeholder="E.g., Design database schemas"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <AlignLeft className="h-4 w-4 text-slate-500" />
                Description
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-2 block w-full rounded-lg border border-slate-800 bg-slate-900/50 py-2.5 px-3 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all resize-none"
                placeholder="Describe the scope, objectives or instructions for this task..."
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TaskPriority)}
                  className="mt-2 block w-full rounded-lg border border-slate-800 bg-slate-900/50 py-2.5 px-3 text-sm text-white focus:border-indigo-500 focus:outline-none cursor-pointer"
                >
                  <option value="Low">🟢 Low</option>
                  <option value="Medium">🟡 Medium</option>
                  <option value="High">🔴 High</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TaskStatus)}
                  className="mt-2 block w-full rounded-lg border border-slate-800 bg-slate-900/50 py-2.5 px-3 text-sm text-white focus:border-indigo-500 focus:outline-none cursor-pointer"
                >
                  <option value="Todo">Todo</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Review">Review</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>

              {!isTeamMember ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <UserIcon className="h-4 w-4 text-slate-500" />
                    Assignee
                  </label>
                  <select
                    value={assignedUser}
                    onChange={(e) => setAssignedUser(e.target.value)}
                    className="mt-2 block w-full rounded-lg border border-slate-800 bg-slate-900/50 py-2.5 px-3 text-sm text-white focus:border-indigo-500 focus:outline-none cursor-pointer"
                  >
                    <option value="">Select Assignee</option>
                    {projectMembers?.map((m) => (
                      <option key={m._id} value={m._id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <UserIcon className="h-4 w-4 text-slate-500" />
                    Assignee
                  </label>
                  <div className="mt-2 flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/40 py-2 px-3 text-xs text-slate-300">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-400 font-bold text-[10px]">
                      {user?.name ? user.name.charAt(0).toUpperCase() : '?'}
                    </div>
                    <span className="truncate">{user?.name} (Assigned to you)</span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-slate-500" />
                  Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="mt-2 block w-full rounded-lg border border-slate-800 bg-slate-900/50 py-2.5 px-3 text-sm text-white focus:border-indigo-500 focus:outline-none cursor-pointer"
                />
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex items-center justify-between border-t border-slate-800 pt-4 mt-6">
              <div>
                {task && !isTeamMember && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="rounded-lg bg-rose-950/20 px-3.5 py-2 text-sm font-semibold text-rose-400 border border-rose-900/30 hover:bg-rose-900/20 hover:text-rose-300 cursor-pointer transition-colors flex items-center gap-1.5"
                  >
                    <Trash2 className="h-4.5 w-4.5" />
                    Remove
                  </button>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg bg-slate-900 border border-slate-800 px-4 py-2 text-sm font-semibold text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || (!task && isTeamMember)}
                  className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  ) : task ? (
                    isTeamMember
                      ? status === 'Completed'
                        ? 'Submit Completed Task'
                        : 'Save & Notify Manager'
                      : 'Save Task'
                  ) : (
                    'Add Task'
                  )}
                </button>
              </div>
            </div>
          </form>

          {/* Right Panel: Comments & Attachments (Only when task exists) */}
          {task && (
            <div className="md:col-span-2 border-t md:border-t-0 md:border-l border-slate-800 pt-4 md:pt-0 md:pl-6 flex flex-col gap-6 max-h-[600px] overflow-y-auto pr-1">
              {/* Attachments Section */}
              <div className="flex flex-col">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Paperclip className="h-4 w-4 text-indigo-400" />
                  Attachments ({task.attachments?.length || 0})
                </h4>

                {/* Upload Zone */}
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  className={`relative flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-4 transition-all duration-150 ${
                    dragActive
                      ? 'border-indigo-500 bg-indigo-500/10'
                      : 'border-slate-800 bg-slate-900/20 hover:border-slate-700/60'
                  }`}
                >
                  <input
                    type="file"
                    id="file-upload"
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={uploading}
                  />
                  <label
                    htmlFor="file-upload"
                    className="flex flex-col items-center justify-center cursor-pointer text-slate-400 hover:text-white text-center"
                  >
                    <Upload className="h-6 w-6 text-indigo-400 mb-1.5" />
                    <span className="text-xs font-medium text-slate-300">
                      {uploading ? 'Uploading...' : 'Drop files here or click to browse'}
                    </span>
                    <span className="text-[10px] text-slate-500 mt-0.5">Images, PDFs, or docs up to 10MB</span>
                  </label>
                </div>

                {/* Attachments List */}
                <div className="mt-3 space-y-2">
                  {task.attachments?.map((att) => (
                    <div
                      key={att._id}
                      className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/40 p-2 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {getFileIcon(att.fileType)}
                        <span className="truncate text-slate-200 max-w-[140px]">{att.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <a
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 text-slate-400 hover:text-indigo-400 transition-colors"
                          title="Download"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </a>
                        <button
                          type="button"
                          onClick={() => att._id && handleAttachmentDelete(att._id)}
                          className="p-1 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Comments Section */}
              <div className="flex flex-col">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <MessageSquare className="h-4 w-4 text-indigo-400" />
                  Comments ({task.comments?.length || 0})
                </h4>

                {/* Comment Input */}
                <form onSubmit={handleCommentSubmit} className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Write a progress comment..."
                    className="flex-1 rounded-lg border border-slate-800 bg-slate-900/50 py-1.5 px-3 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={commentLoading || !commentText.trim()}
                    className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors disabled:opacity-40 cursor-pointer"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </form>

                {/* Comments List */}
                <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                  {task.comments?.map((comment, index) => {
                    const commenterName =
                      typeof comment.user === 'object' && comment.user !== null
                        ? comment.user.name
                        : 'User';

                    return (
                      <div
                        key={comment._id || index}
                        className="rounded-lg border border-slate-900 bg-slate-900/30 p-2.5 text-xs"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-indigo-400 text-[11px]">{commenterName}</span>
                          <span className="text-[9px] text-slate-500">
                            {new Date(comment.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <p className="text-slate-300 leading-relaxed text-[11px] whitespace-pre-wrap">
                          {comment.text}
                        </p>
                      </div>
                    );
                  })}
                  {(!task.comments || task.comments.length === 0) && (
                    <p className="text-center text-xs text-slate-600 py-3">No comments yet</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TaskModal;
