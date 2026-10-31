'use client';

import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { X, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Project, ProjectStatus, User } from '../types';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (project: Project) => void;
  project?: Project | null;
}

const ProjectModal: React.FC<ProjectModalProps> = ({
  isOpen,
  onClose,
  onSave,
  project = null,
}) => {
  const { user } = useAuth();
  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [status, setStatus] = useState<ProjectStatus>('Planning');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [selectedManagerId, setSelectedManagerId] = useState<string>('');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      if (project) {
        setName(project.name);
        setDescription(project.description);
        setStatus(project.status);
        setSelectedMembers(
          project.members?.map((m: any) => (typeof m === 'object' ? m._id : m)) || []
        );
        setSelectedManagerId(
          typeof project.manager === 'object' && project.manager !== null
            ? project.manager._id
            : project.manager || ''
        );
      } else {
        setName('');
        setDescription('');
        setStatus('Planning');
        setSelectedMembers([]);
        setSelectedManagerId(user?._id || '');
      }

      // Fetch users list for member/manager selection
      const fetchUsers = async () => {
        try {
          const response = await api.get<User[]>('/users');
          setUsers(response.data);
        } catch (err) {
          console.error('Failed to load users for modal list:', err);
        }
      };

      fetchUsers();
    }
  }, [isOpen, project, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !description.trim()) {
      setError('Please fill in all required fields.');
      return;
    }

    setLoading(true);
    setError('');

    const payload: {
      name: string;
      description: string;
      status: ProjectStatus;
      members: string[];
      managerId?: string;
    } = {
      name,
      description,
      status,
      members: selectedMembers,
    };

    if (user?.role === 'Admin' && selectedManagerId) {
      payload.managerId = selectedManagerId;
    }

    try {
      if (project) {
        // Edit project
        const response = await api.put<Project>(`/projects/${project._id}`, payload);
        onSave(response.data);
      } else {
        // Create new project
        const response = await api.post<Project>('/projects', payload);
        onSave(response.data);
      }
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save project');
    } finally {
      setLoading(false);
    }
  };

  const handleMemberToggle = (userId: string) => {
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
            <Users className="h-5 w-5 text-indigo-400" />
            {project ? 'Edit Project Workspace' : 'Create New Project'}
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

        {!project && user?.role === 'Team Member' && (
          <div className="mt-4 rounded-lg bg-amber-500/10 border border-amber-500/20 p-3.5 text-xs text-amber-300">
            <span className="font-semibold">Role Restriction:</span> Your account role is{' '}
            <strong className="text-amber-200">Team Member</strong>. Only Project Managers and Admins can create new
            projects. Ask an Admin to promote your role or sign in as a Project Manager.
          </div>
        )}

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
              placeholder="E.g., Client Mobile App Redesign"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Description *
            </label>
            <textarea
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-2 block w-full rounded-lg border border-slate-800 bg-slate-900/50 py-2.5 px-3 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all resize-none"
              placeholder="Describe the objectives and key results for this workspace..."
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                className="mt-2 block w-full rounded-lg border border-slate-800 bg-slate-900/50 py-2.5 px-3 text-sm text-white focus:border-indigo-500 focus:outline-none cursor-pointer"
              >
                <option value="Planning">Planning</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
              </select>
            </div>

            {user?.role === 'Admin' && (
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Project Manager
                </label>
                <select
                  value={selectedManagerId}
                  onChange={(e) => setSelectedManagerId(e.target.value)}
                  className="mt-2 block w-full rounded-lg border border-slate-800 bg-slate-900/50 py-2.5 px-3 text-sm text-white focus:border-indigo-500 focus:outline-none cursor-pointer"
                >
                  <option value="">Select Manager</option>
                  {users
                    .filter((u) => u.role === 'Project Manager' || u.role === 'Admin')
                    .map((m) => (
                      <option key={m._id} value={m._id}>
                        {m.name} ({m.role})
                      </option>
                    ))}
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Assign Team Members
            </label>
            <div className="max-h-36 overflow-y-auto space-y-1 rounded-lg border border-slate-800 bg-slate-900/30 p-2">
              {users
                .filter((u) => u._id !== selectedManagerId)
                .map((member) => (
                  <label
                    key={member._id}
                    className="flex items-center gap-2.5 p-1.5 rounded hover:bg-slate-900/60 transition-colors cursor-pointer text-xs"
                  >
                    <input
                      type="checkbox"
                      checked={selectedMembers.includes(member._id)}
                      onChange={() => handleMemberToggle(member._id)}
                      className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                    />
                    <span className="text-white font-medium">{member.name}</span>
                    <span className="text-[10px] text-slate-400">({member.role})</span>
                  </label>
                ))}
              {users.length === 0 && (
                <p className="text-xs text-slate-500 py-1 text-center">Loading users list...</p>
              )}
            </div>
          </div>

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
              disabled={loading || (!project && user?.role === 'Team Member')}
              className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
