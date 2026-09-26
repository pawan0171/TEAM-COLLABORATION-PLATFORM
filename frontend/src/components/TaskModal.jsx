import React, { useState, useEffect } from 'react';
import {
  X,
  CheckSquare,
  Trash2,
  Calendar,
  User,
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

const TaskModal = ({
  isOpen,
  onClose,
  onSave,
  onUpdateProject,
  projectId,
  projectMembers,
  task = null,
}) => {
  const { user } = useAuth();
  const isTeamMember = user.role === 'Team Member';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [status, setStatus] = useState('Todo');
  const [assignedUser, setAssignedUser] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Comment states
  const [commentText, setCommentText] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);

  // File Upload states
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Track task ID and open state to prevent overwriting form fields on live comments/attachments update
  const [prevTaskId, setPrevTaskId] = useState(null);
  const [prevIsOpen, setPrevIsOpen] = useState(false);

  useEffect(() => {
    if (isOpen && (!prevIsOpen || (task && task._id !== prevTaskId))) {
      if (task) {
        setTitle(task.title || '');
        setDescription(task.description || '');
        setPriority(task.priority || 'Medium');
        setStatus(task.status || 'Todo');
        setAssignedUser(task.assignedUser?._id || task.assignedUser || '');
        setDueDate(task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '');
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Task title is required.');
      return;
    }

    setLoading(true);
    setError('');

    const payload = {
      title,
      description,
      priority,
      status,
      dueDate: dueDate || null,
    };

    // Ownership is managed by an admin or project manager. A team member can
    // edit every work-detail field on their own task, but cannot reassign it.
    if (!isTeamMember) {
      payload.assignedUser = assignedUser || null;
    }

    try {
      let response;
      if (task) {
        // Edit task
        response = await api.put(`/projects/${projectId}/tasks/${task._id}`, payload);
      } else {
        // Create new task
        response = await api.post(`/projects/${projectId}/tasks`, payload);
      }
      onSave(response.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save task');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;

    setLoading(true);
    setError('');
    try {
      const response = await api.delete(`/projects/${projectId}/tasks/${task._id}`);
      onSave(response.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete task');
      setLoading(false);
    }
  };

  const handleCommentSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!commentText.trim()) return;

    setCommentLoading(true);
    setError('');

    try {
      const response = await api.post(`/projects/${projectId}/tasks/${task._id}/comments`, {
        text: commentText,
      });
      if (onUpdateProject) {
        onUpdateProject(response.data);
      }
      setCommentText('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add comment');
    } finally {
      setCommentLoading(false);
    }
  };

  // Attachment upload and delete logic
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setError('File size exceeds the 10MB limit.');
      return;
    }

    setUploading(true);
    setError('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await api.post(
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
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to upload attachment.');
    } finally {
      setUploading(false);
    }
  };

  const handleAttachmentDelete = async (attachmentId) => {
    if (!window.confirm('Are you sure you want to delete this attachment?')) return;

    setUploading(true);
    setError('');

    try {
      const response = await api.delete(
        `/projects/${projectId}/tasks/${task._id}/attachments/${attachmentId}`
      );
      if (onUpdateProject) {
        onUpdateProject(response.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete attachment.');
    } finally {
      setUploading(false);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
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
        const response = await api.post(
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
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to upload attachment.');
      } finally {
        setUploading(false);
      }
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

        {isTeamMember && task && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-indigo-500/20 bg-indigo-500/10 px-3.5 py-2.5 text-xs text-indigo-300">
            <CheckSquare className="h-4 w-4 text-indigo-400 shrink-0" />
            <span>
              You are editing your assigned task. Any status changes or updates you save will automatically notify the Project Manager and Admin.
            </span>
          </div>
        )}

        {/* Split Grid for Task Form and Comments/Attachments (Only when task exists) */}
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
                rows="3"
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
                  onChange={(e) => setPriority(e.target.value)}
                  className="mt-2 block w-full rounded-lg border border-slate-800 bg-slate-900/50 py-2.5 px-3 text-sm text-white focus:border-indigo-505 focus:outline-none cursor-pointer"
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
                  onChange={(e) => setStatus(e.target.value)}
                  className="mt-2 block w-full rounded-lg border border-slate-800 bg-slate-900/50 py-2.5 px-3 text-sm text-white focus:border-indigo-505 focus:outline-none cursor-pointer"
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
                    <User className="h-4 w-4 text-slate-500" />
                    Assignee
                  </label>
                  <select
                    value={assignedUser}
                    onChange={(e) => setAssignedUser(e.target.value)}
                    className="mt-2 block w-full rounded-lg border border-slate-800 bg-slate-900/50 py-2.5 px-3 text-sm text-white focus:border-indigo-505 focus:outline-none cursor-pointer"
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
                    <User className="h-4 w-4 text-slate-500" />
                    Assignee
                  </label>
                  <div className="mt-2 flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/40 py-2 px-3 text-xs text-slate-300">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-400 font-bold text-[10px]">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="truncate">{user.name} (Assigned to you)</span>
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
                  className="mt-2 block w-full rounded-lg border border-slate-800 bg-slate-900/50 py-2.5 px-3 text-sm text-white focus:border-indigo-505 focus:outline-none cursor-pointer"
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
                  disabled={loading}
                  className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 cursor-pointer transition-all disabled:opacity-50"
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
                    <Upload className="h-6 w-6 text-slate-500 mb-1.5 mx-auto" />
                    <span className="text-[11px] font-medium block">
                      {uploading ? 'Uploading attachment...' : 'Drag & drop file or click to browse'}
                    </span>
                    <span className="text-[9px] text-slate-500 block mt-0.5">
                      Images, PDFs, or Docs up to 10MB
                    </span>
                  </label>
                </div>

                {/* Attachments list */}
                <div className="mt-3.5 space-y-2 max-h-[160px] overflow-y-auto pr-1 scrollbar-thin">
                  {task.attachments && task.attachments.length > 0 ? (
                    task.attachments.map((att) => {
                      const isImage = att.fileType === 'image';
                      const isPdf = att.fileType === 'pdf';
                      const uploaderName = att.uploadedBy?.name || 'Unknown';

                      // Choose file icon
                      let FileIcon = File;
                      if (isImage) FileIcon = FileImage;
                      else if (isPdf) FileIcon = FileText;
                      else if (att.name.endsWith('.xls') || att.name.endsWith('.xlsx'))
                        FileIcon = FileSpreadsheet;

                      return (
                        <div
                          key={att._id}
                          className="group flex items-center justify-between rounded-lg border border-slate-900 bg-slate-950/40 p-2.5 hover:border-slate-800/80 transition-all"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {isImage ? (
                              <img
                                src={att.url}
                                alt={att.name}
                                className="h-9 w-9 rounded object-cover border border-slate-800 shrink-0"
                              />
                            ) : (
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-slate-900 border border-slate-800 text-indigo-400">
                                <FileIcon className="h-4.5 w-4.5" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p
                                className="text-[11px] font-semibold text-slate-200 truncate pr-2"
                                title={att.name}
                              >
                                {att.name}
                              </p>
                              <p className="text-[9px] text-slate-500 mt-0.5 font-medium">
                                By {uploaderName} • {new Date(att.uploadedAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                            <a
                              href={att.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded p-1 text-slate-400 hover:bg-slate-900 hover:text-white transition-colors"
                              title="Download Attachment"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </a>
                            {(user.role === 'Admin' ||
                              user.role === 'Project Manager' ||
                              (att.uploadedBy?._id || att.uploadedBy) ===
                                (user.id || user._id)) && (
                              <button
                                type="button"
                                onClick={() => handleAttachmentDelete(att._id)}
                                className="rounded p-1 text-rose-500/80 hover:bg-rose-950/20 hover:text-rose-400 transition-colors cursor-pointer"
                                title="Remove Attachment"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-[10px] text-slate-600 italic py-1 text-center">
                      No attachments uploaded yet.
                    </p>
                  )}
                </div>
              </div>

              {/* Comments Section */}
              <div className="flex flex-col border-t border-slate-900 pt-4 flex-1">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <MessageSquare className="h-4 w-4 text-indigo-400" />
                  Comments ({task.comments?.length || 0})
                </h4>

                {/* Scrollable Comments Thread */}
                <div className="flex-1 overflow-y-auto space-y-3.5 pr-2 mb-4 scrollbar-thin max-h-[220px]">
                  {task.comments && task.comments.length > 0 ? (
                    task.comments.map((comment) => {
                      const authorName = comment.user?.name || 'Unknown User';
                      const authorInitials = authorName.charAt(0).toUpperCase();
                      return (
                        <div key={comment._id} className="flex items-start gap-2.5">
                          {/* Avatar */}
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 border border-slate-800 text-xs font-bold text-indigo-400 uppercase">
                            {authorInitials}
                          </div>
                          {/* Body */}
                          <div className="flex-1 bg-slate-900/40 border border-slate-800/60 rounded-xl p-2.5">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-semibold text-slate-200">
                                {authorName}
                              </span>
                              <span className="text-[9px] text-slate-500">
                                {new Date(comment.createdAt).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                            <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
                              {comment.text}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="flex flex-col items-center justify-center py-6 text-slate-600 text-xs text-center">
                      <MessageSquare className="h-8 w-8 mb-2 opacity-20" />
                      No comments yet.
                      <br />
                      Be the first to share an update!
                    </div>
                  )}
                </div>

                {/* Add Comment Input Form */}
                <div className="mt-auto pt-3 border-t border-slate-900">
                  <div className="relative">
                    <textarea
                      rows="2"
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Add a comment..."
                      disabled={commentLoading}
                      className="w-full rounded-lg border border-slate-800 bg-slate-900/50 py-2 px-3 pr-10 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all resize-none"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleCommentSubmit(e);
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleCommentSubmit}
                      disabled={commentLoading || !commentText.trim()}
                      className="absolute right-2 bottom-2 rounded p-1 text-indigo-400 hover:bg-slate-800 hover:text-white transition-all disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                    >
                      {commentLoading ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent"></div>
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </button>
                  </div>
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
