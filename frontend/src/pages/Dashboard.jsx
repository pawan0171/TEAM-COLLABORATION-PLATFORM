import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import ProjectModal from '../components/ProjectModal';
import { Link } from 'react-router-dom';
import {
  FolderKanban,
  Plus,
  Search,
  Users,
  Edit2,
  Trash2,
  CheckCircle,
  Clock,
  Briefcase,
  AlertTriangle,
  FolderOpen,
  Archive,
} from 'lucide-react';

const Dashboard = () => {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Search and Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [viewArchived, setViewArchived] = useState(false);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get(`/projects?archived=${viewArchived}`);
      setProjects(response.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [viewArchived]);

  const handleCreateClick = () => {
    setEditingProject(null);
    setIsModalOpen(true);
  };

  const handleEditClick = (e, project) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingProject(project);
    setIsModalOpen(true);
  };

  const handleDeleteClick = async (e, projectId) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!window.confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      return;
    }

    try {
      await api.delete(`/projects/${projectId}`);
      setProjects((prev) => prev.filter((p) => p._id !== projectId));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete project');
    }
  };

  const handleArchiveClick = async (e, projectId) => {
    e.preventDefault();
    e.stopPropagation();

    if (!window.confirm('Are you sure you want to archive this project? It will be hidden from the active dashboard.')) {
      return;
    }

    try {
      await api.put(`/projects/${projectId}/archive`);
      setProjects((prev) => prev.filter((p) => p._id !== projectId));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to archive project');
    }
  };

  const handleUnarchiveClick = async (e, projectId) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      await api.put(`/projects/${projectId}/unarchive`);
      setProjects((prev) => prev.filter((p) => p._id !== projectId));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to unarchive project');
    }
  };

  const handleSaveProject = (savedProject) => {
    if (editingProject) {
      // Update in state
      setProjects((prev) =>
        prev.map((p) => (p._id === savedProject._id ? savedProject : p))
      );
    } else {
      // Add to list
      setProjects((prev) => [savedProject, ...prev]);
    }
  };

  // Stats calculation
  const totalProjects = projects.length;
  const inProgressProjects = projects.filter((p) => p.status === 'In Progress').length;
  const completedProjects = projects.filter((p) => p.status === 'Completed').length;
  const planningProjects = projects.filter((p) => p.status === 'Planning').length;

  // Filtered projects
  const filteredProjects = projects.filter((project) => {
    const matchesSearch =
      project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.description.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'All' || project.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Completed':
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      case 'In Progress':
        return 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20';
      default:
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b1329]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Top Banner */}
      <div className="md:flex md:items-center md:justify-between mb-8">
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold leading-7 text-white sm:truncate sm:text-3xl">
            Project Dashboard
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Welcome back, <span className="font-semibold text-slate-200">{user.name}</span>. Manage, track, and collaborate on your team projects.
          </p>
        </div>
        
        {/* CTAs */}
        {(user.role === 'Admin' || user.role === 'Project Manager') && (
          <div className="mt-4 flex md:ml-4 md:mt-0">
            <button
              onClick={handleCreateClick}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-500/20 hover:bg-indigo-500 hover:shadow-indigo-500/30 transition-all cursor-pointer"
            >
              <Plus className="h-4.5 w-4.5" />
              Create Project
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-6 flex items-start gap-2.5 rounded-lg border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-400">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-8">
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4.5 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Projects</span>
            <FolderKanban className="h-5 w-5 text-indigo-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-white">{totalProjects}</p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4.5 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">In Progress</span>
            <Clock className="h-5 w-5 text-indigo-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-white">{inProgressProjects}</p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4.5 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Completed</span>
            <CheckCircle className="h-5 w-5 text-emerald-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-white">{completedProjects}</p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4.5 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Planning</span>
            <Briefcase className="h-5 w-5 text-amber-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-white">{planningProjects}</p>
        </div>
      </div>

      {/* Active vs Archived Sub-navigation */}
      <div className="flex gap-6 border-b border-slate-800 mb-6">
        <button
          onClick={() => setViewArchived(false)}
          className={`pb-3 text-sm font-semibold transition-all border-b-2 cursor-pointer ${
            !viewArchived
              ? 'border-indigo-500 text-indigo-400 font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Active Projects ({projects.filter(p => !p.isArchived).length || projects.length})
        </button>
        <button
          onClick={() => setViewArchived(true)}
          className={`pb-3 text-sm font-semibold transition-all border-b-2 cursor-pointer ${
            viewArchived
              ? 'border-indigo-500 text-indigo-400 font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Archived Workspaces
        </button>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Search className="h-5 w-5 text-slate-500" />
          </div>
          <input
            type="text"
            placeholder="Search projects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2 pl-10 pr-3 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
          />
        </div>

        {/* Filter status tabs */}
        <div className="flex flex-wrap gap-1.5 rounded-lg border border-slate-800 bg-slate-950/60 p-1 backdrop-blur-md">
          {['All', 'Planning', 'In Progress', 'Completed'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`rounded-md px-3.5 py-1.5 text-xs font-medium cursor-pointer transition-all ${
                statusFilter === status
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-white'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filteredProjects.map((project) => {
          // Progress calculation
          const totalTasks = project.tasks?.length || 0;
          const completedTasks = project.tasks?.filter((t) => t.status === 'Done').length || 0;
          const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

          // Permission check for editing/deleting
          // Admins can manage all. PMs can manage if they are the project manager
          const isManager = 
            user.role === 'Admin' ||
            (user.role === 'Project Manager' && (project.manager?._id || project.manager) === (user.id || user._id));

          return (
            <Link
              key={project._id}
              to={`/projects/${project._id}`}
              className="group relative flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-950/30 p-6 backdrop-blur-sm hover:border-indigo-500/40 hover:shadow-lg hover:shadow-indigo-500/5 hover:-translate-y-0.5 transition-all duration-200"
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between">
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${getStatusBadge(project.status)}`}>
                    {project.status}
                  </span>
                  
                  {/* Action Buttons */}
                  {isManager && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => handleEditClick(e, project)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-900 hover:text-indigo-400 transition-colors cursor-pointer"
                        title="Edit Project"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      {project.isArchived ? (
                        <button
                          onClick={(e) => handleUnarchiveClick(e, project._id)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-900 hover:text-emerald-400 transition-colors cursor-pointer"
                          title="Restore Project"
                        >
                          <FolderKanban className="h-4 w-4" />
                        </button>
                      ) : (
                        <button
                          onClick={(e) => handleArchiveClick(e, project._id)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-900 hover:text-amber-400 transition-colors cursor-pointer"
                          title="Archive Project"
                        >
                          <Archive className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={(e) => handleDeleteClick(e, project._id)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-900 hover:text-rose-400 transition-colors cursor-pointer"
                        title="Delete Project"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Title */}
                <h3 className="mt-4 text-lg font-bold text-white group-hover:text-indigo-400 transition-colors">
                  {project.name}
                </h3>
                
                {/* Description */}
                <p className="mt-2 text-sm text-slate-400 line-clamp-2 leading-relaxed">
                  {project.description}
                </p>
              </div>

              <div className="mt-6 border-t border-slate-900 pt-4 space-y-4.5">
                {/* Progress bar */}
                {totalTasks > 0 ? (
                  <div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-slate-500">Tasks Progress</span>
                      <span className="font-semibold text-slate-300">
                        {completedTasks}/{totalTasks} ({progressPercent}%)
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-900 overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                        style={{ width: `${progressPercent}%` }}
                      ></div>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>No tasks assigned</span>
                    <span>0%</span>
                  </div>
                )}

                {/* Manager & Team members counts */}
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500">Manager:</span>
                    <span className="font-medium text-slate-300">
                      {project.manager?.name || 'Unassigned'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-slate-500">
                    <Users className="h-3.5 w-3.5" />
                    <span>{project.members?.length || 0}</span>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}

        {filteredProjects.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-slate-800 bg-slate-950/20 py-16 text-center">
            <FolderOpen className="h-12 w-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white">No Projects Found</h3>
            <p className="text-slate-500 text-sm mt-1">
              {searchTerm || statusFilter !== 'All'
                ? 'Try adjusting your filters or search query.'
                : "Get started by creating your very first collaborative workspace project."}
            </p>
            {((user.role === 'Admin' || user.role === 'Project Manager') && !searchTerm && statusFilter === 'All') && (
              <button
                onClick={handleCreateClick}
                className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-indigo-500 cursor-pointer transition-colors"
              >
                <Plus className="h-4 w-4" />
                Create First Project
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modal */}
      <ProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveProject}
        project={editingProject}
      />
    </div>
  );
};

export default Dashboard;
