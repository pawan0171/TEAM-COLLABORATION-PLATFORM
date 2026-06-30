import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { X, Users, ClipboardCopy } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const ProjectModal = ({ isOpen, onClose, onSave, project = null }) => {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('Planning');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [selectedManagerId, setSelectedManagerId] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      // Set initial values
      if (project) {
        setName(project.name);
        setDescription(project.description);
        setStatus(project.status);
        setSelectedMembers(project.members?.map((m) => m._id) || []);
        setSelectedManagerId(project.manager?._id || project.manager || '');
      } else {
        setName('');
        setDescription('');
        setStatus('Planning');
        setSelectedMembers([]);
        setSelectedManagerId(user?.id || user?._id || '');
      }

      // Fetch users list for selection
      const fetchUsers = async () => {
        try {
          const response = await api.get('/users');
          setUsers(response.data);
        } catch (err) {
          console.error('Failed to load users for modal list:', err);
        }
      };

      fetchUsers();
    }
  }, [isOpen, project, user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !description.trim()) {
      setError('Please fill in all required fields.');
      return;
    }

    setLoading(true);
    setError('');

    const payload = {
      name,
      description,
      status,
      members: selectedMembers,
    };

    if (user.role === 'Admin') {
      payload.managerId = selectedManagerId;
    }

    try {
      if (project) {
        // Edit project
        const response = await api.put(`/projects/${project._id}`, payload);
        onSave(response.data);
      } else {
        // Create new project
        const response = await api.post('/projects', payload);
        onSave(response.data);
      }
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save project');
    } finally {
      setLoading(false);
    }
  };

  const handleMemberToggle = (userId) => {
    setSelectedMembers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-250">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <ClipboardCopy className="h-5 w-5 text-indigo-400" />
            {project ? 'Edit Project Details' : 'Create New Project'}
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Project Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-2 block w-full rounded-lg border border-slate-800 bg-slate-900/50 py-2.5 px-3 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
              placeholder="E.g., Web App Revamp"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Description *
            </label>
            <textarea
              required
              rows="3"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-2 block w-full rounded-lg border border-slate-800 bg-slate-900/50 py-2.5 px-3 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all resize-none"
              placeholder="Describe the scope, objectives and deliverables..."
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="mt-2 block w-full rounded-lg border border-slate-800 bg-slate-900/50 py-2.5 px-3 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all cursor-pointer"
              >
                <option value="Planning">Planning</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
              </select>
            </div>

            {user.role === 'Admin' && (
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Project Owner / PM
                </label>
                <select
                  value={selectedManagerId}
                  onChange={(e) => setSelectedManagerId(e.target.value)}
                  className="mt-2 block w-full rounded-lg border border-slate-800 bg-slate-900/50 py-2.5 px-3 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all cursor-pointer"
                >
                  {users
                    .filter((u) => u.role === 'Project Manager' || u.role === 'Admin')
                    .map((pm) => (
                      <option key={pm._id} value={pm._id}>
                        {pm.name} ({pm.role})
                      </option>
                    ))}
                </select>
              </div>
            )}
          </div>

          {/* Members checklist */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="h-4 w-4 text-slate-500" />
              Assign Team Members
            </label>
            <div className="mt-2 max-h-36 overflow-y-auto rounded-lg border border-slate-800 bg-slate-900/30 p-3 space-y-2">
              {users
                .filter((u) => u._id !== selectedManagerId) // Hide current manager
                .map((u) => (
                  <label key={u._id} className="flex items-center gap-3 text-sm text-slate-300 hover:text-white cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={selectedMembers.includes(u._id)}
                      onChange={() => handleMemberToggle(u._id)}
                      className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                    />
                    <span>
                      {u.name}{' '}
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                        ({u.role})
                      </span>
                    </span>
                  </label>
                ))}
              {users.length === 0 && (
                <p className="text-xs text-slate-500 py-2 text-center">Loading team database...</p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 border-t border-slate-800 pt-4 mt-6">
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
              className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 cursor-pointer transition-all disabled:opacity-50"
            >
              {loading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
              ) : project ? (
                'Save Changes'
              ) : (
                'Create Project'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProjectModal;
