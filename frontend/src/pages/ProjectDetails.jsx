import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import ProjectModal from '../components/ProjectModal';
import TaskModal from '../components/TaskModal';
import {
  Calendar,
  Users,
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  ArrowLeft,
  Briefcase,
  Edit2,
  Trash,
  Clock,
  UserCheck,
  AlertCircle,
  Archive,
  FolderKanban,
  BarChart3,
  TrendingUp,
  Percent,
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

const ProjectDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, socket, onlineUsers } = useAuth();

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('kanban'); // 'kanban' or 'analytics'

  // Kanban Task Modal states
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

  // Edit project state
  const [isEditOpen, setIsEditOpen] = useState(false);

  const fetchProjectDetails = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get(`/projects/${id}`);
      setProject(response.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load project details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjectDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Connect to project socket room for real-time synchronization
  useEffect(() => {
    if (socket && id) {
      // Join the project room
      socket.emit('joinProject', id);

      // Listen for task changes/comments/assignments
      socket.on('projectUpdated', (updatedProject) => {
        if (updatedProject && updatedProject._id === id) {
          setProject(updatedProject);
        }
      });

      return () => {
        socket.emit('leaveProject', id);
        socket.off('projectUpdated');
      };
    }
  }, [socket, id]);

  const handleEditSave = (updatedProject) => {
    setProject(updatedProject);
  };

  const handleDeleteProject = async () => {
    if (!window.confirm('Are you sure you want to delete this project? This will permanently remove all data.')) {
      return;
    }

    try {
      await api.delete(`/projects/${id}`);
      navigate('/');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete project');
    }
  };

  // Drag and Drop handlers for Kanban Board
  const handleDragStart = (e, taskId) => {
    if (project.isArchived) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    if (project.isArchived) return;
    e.preventDefault();
  };

  const handleDrop = async (e, targetStatus) => {
    if (project.isArchived) return;
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;

    // Check if status is actually changing
    const task = project.tasks?.find((t) => t._id === taskId);
    if (task && task.status === targetStatus) return;

    try {
      const response = await api.put(`/projects/${id}/tasks/${taskId}`, { status: targetStatus });
      setProject(response.data);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update task status');
    }
  };

  const handleAddTaskClick = () => {
    if (project.isArchived) return;
    setSelectedTask(null);
    setIsTaskModalOpen(true);
  };

  const handleTaskClick = (task) => {
    if (project.isArchived) return;
    setSelectedTask(task);
    setIsTaskModalOpen(true);
  };

  const handleSaveTask = (updatedProject) => {
    setProject(updatedProject);
    setIsTaskModalOpen(false);
    setSelectedTask(null);
  };

  const [systemUsers, setSystemUsers] = useState([]);

  useEffect(() => {
    const fetchSystemUsers = async () => {
      try {
        const response = await api.get('/users');
        setSystemUsers(response.data);
      } catch (err) {
        console.error('Failed to load system users', err);
      }
    };
    
    if (user) {
      fetchSystemUsers();
    }
  }, [user]);

  const handleInviteMember = async (memberId) => {
    if (!memberId) return;
    try {
      const updatedMembers = [...project.members.map((m) => m._id), memberId];
      const response = await api.put(`/projects/${id}`, {
        members: updatedMembers,
      });
      setProject(response.data);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to invite team member');
    }
  };

  const handleAssignManager = async (managerId) => {
    if (!managerId) return;
    try {
      const response = await api.put(`/projects/${id}`, {
        managerId,
      });
      setProject(response.data);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to assign project manager');
    }
  };

  const handleArchiveToggle = async () => {
    const action = project.isArchived ? 'unarchive' : 'archive';
    if (action === 'archive' && !window.confirm('Are you sure you want to archive this project?')) {
      return;
    }
    try {
      const response = await api.put(`/projects/${id}/${action}`);
      setProject(response.data);
    } catch (err) {
      alert(err.response?.data?.message || `Failed to ${action} project`);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b1329]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <AlertCircle className="h-12 w-12 text-rose-500 mx-auto mb-4 animate-bounce" />
        <h3 className="text-xl font-bold text-white">Error Loading Project</h3>
        <p className="text-slate-400 mt-2">{error || 'Project not found.'}</p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-505 transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const isManager =
    user.role === 'Admin' ||
    (user.role === 'Project Manager' && (project.manager?._id || project.manager) === (user.id || user._id));
  const isTeamMember = user.role === 'Team Member';
  const currentUserId = (user.id || user._id)?.toString();

  // Team members should only see tasks assigned to them
  const visibleTasks = isTeamMember
    ? (project.tasks || []).filter(
        (t) => (t.assignedUser?._id || t.assignedUser)?.toString() === currentUserId
      )
    : (project.tasks || []);

  // Compute Task Stats
  const totalTasks = visibleTasks.length;
  const completedTasks = visibleTasks.filter((t) => t.status === 'Completed' || t.status === 'Done').length;
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const columns = [
    { id: 'Todo', title: 'To Do', color: 'border-slate-900/60 bg-slate-950/30' },
    { id: 'In Progress', title: 'In Progress', color: 'border-indigo-500/10 bg-indigo-950/10' },
    { id: 'Review', title: 'In Review', color: 'border-amber-500/10 bg-amber-950/10' },
    { id: 'Completed', title: 'Completed', color: 'border-emerald-500/10 bg-emerald-950/10' },
  ];

  const groupedTasks = {
    Todo: [],
    'In Progress': [],
    Review: [],
    Completed: [],
  };

  visibleTasks.forEach((task) => {
    let statusKey = task.status || 'Todo';
    if (statusKey === 'To Do') statusKey = 'Todo';
    if (statusKey === 'Done') statusKey = 'Completed';
    
    if (groupedTasks[statusKey]) {
      groupedTasks[statusKey].push(task);
    } else {
      groupedTasks['Todo'].push(task);
    }
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Back to Dashboard Navigation */}
      <div className="mb-6">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
      </div>

      {project.isArchived && (
        <div className="mb-6 flex items-center gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-400">
          <AlertCircle className="h-5 w-5 shrink-0 animate-pulse" />
          <span>
            <strong className="font-semibold">Archived Workspace:</strong> This project is currently archived. You can view all information, but tasks and configurations are read-only.
          </span>
        </div>
      )}

      {isTeamMember && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-4 text-xs sm:text-sm text-indigo-300">
          <UserCheck className="h-5 w-5 text-indigo-400 shrink-0" />
          <span>
            <strong className="font-semibold text-white">Your Assigned Tasks View:</strong> You are viewing tasks assigned to you. You can move tasks across columns, edit details of completed work, and upload attachments. The Admin and Project Manager are automatically notified of your updates.
          </span>
        </div>
      )}

      {/* Hero Header */}
      <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-6 backdrop-blur-md mb-8">
        <div className="md:flex md:items-start md:justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${
                project.isArchived
                  ? 'bg-slate-800 text-slate-400 border border-slate-700'
                  : project.status === 'Completed'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : project.status === 'In Progress'
                  ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
              }`}>
                {project.isArchived ? 'Archived' : project.status}
              </span>
              <span className="text-slate-500 text-xs flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                Created {new Date(project.createdAt).toLocaleDateString()}
              </span>
            </div>
            <h1 className="mt-3 text-2xl font-extrabold text-white sm:text-3xl tracking-tight leading-tight">
              {project.name}
            </h1>
          </div>

          {/* Action CTAs */}
          {isManager && (
            <div className="mt-6 flex flex-wrap gap-3 md:mt-0 md:ml-4">
              <button
                onClick={() => setIsEditOpen(true)}
                disabled={project.isArchived}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-300 border border-slate-800 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Edit2 className="h-4 w-4" />
                Edit Project
              </button>
              <button
                onClick={handleArchiveToggle}
                className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold border transition-colors cursor-pointer ${
                  project.isArchived
                    ? 'bg-emerald-950/20 text-emerald-400 border-emerald-900/30 hover:bg-emerald-900/20 hover:text-emerald-300'
                    : 'bg-amber-950/20 text-amber-400 border-amber-900/30 hover:bg-amber-900/20 hover:text-amber-300'
                }`}
              >
                {project.isArchived ? (
                  <>
                    <FolderKanban className="h-4 w-4" />
                    Restore Project
                  </>
                ) : (
                  <>
                    <Archive className="h-4 w-4" />
                    Archive Project
                  </>
                )}
              </button>
              <button
                onClick={handleDeleteProject}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-950/20 px-4 py-2 text-sm font-semibold text-rose-400 border border-rose-900/30 hover:bg-rose-900/20 hover:text-rose-300 transition-colors cursor-pointer"
              >
                <Trash className="h-4 w-4" />
                Delete Project
              </button>
            </div>
          )}
        </div>

        {/* Hero Progress bar */}
        {totalTasks > 0 && (
          <div className="mt-8 border-t border-slate-900 pt-6">
            <div className="flex justify-between text-xs font-semibold mb-2">
              <span className="text-slate-400">Workspace Task Progress</span>
              <span className="text-indigo-400">{progressPercent}% Completed</span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-900 overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
          </div>
        )}
      </div>

      {/* Main Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        {/* Left Column: Description */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-950/30 p-6 backdrop-blur-md flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Project Description</h3>
            <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{project.description}</p>
          </div>
          <div className="mt-6 pt-4 border-t border-slate-900/80 flex justify-between text-xs text-slate-500">
            <span>Last updated: {new Date(project.updatedAt).toLocaleDateString()}</span>
            <span>Progress: {completedTasks} of {totalTasks} tasks done</span>
          </div>
        </div>

        {/* Right Column: Sidebar Meta details */}
        <div className="space-y-6">
          {/* Project Manager card */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950/30 p-6 backdrop-blur-md">
            <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-indigo-400" />
              Project Manager
            </h3>
            {user.role === 'Admin' ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-bold text-sm uppercase">
                    {project.manager?.name ? project.manager.name.charAt(0) : '?'}
                    {project.manager?._id && onlineUsers.includes(project.manager._id) && (
                      <span className="absolute bottom-0 right-0 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-slate-950"></span>
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{project.manager?.name || 'Unassigned'}</p>
                    <p className="text-xs text-slate-500">{project.manager?.email || ''}</p>
                  </div>
                </div>
                <div className="border-t border-slate-900 pt-3">
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Assign PM
                  </label>
                  <select
                    value={project.manager?._id || project.manager || ''}
                    onChange={(e) => handleAssignManager(e.target.value)}
                    disabled={project.isArchived}
                    className="block w-full rounded-lg border border-slate-800 bg-slate-900 py-1.5 px-3 text-xs text-white focus:outline-none cursor-pointer disabled:opacity-40"
                  >
                    <option value="">Select Manager</option>
                    {systemUsers
                      .filter((u) => u.role === 'Project Manager' || u.role === 'Admin')
                      .map((pm) => (
                        <option key={pm._id} value={pm._id}>
                          {pm.name} ({pm.role})
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-bold text-sm uppercase">
                  {project.manager?.name ? project.manager.name.charAt(0) : '?'}
                  {project.manager?._id && onlineUsers.includes(project.manager._id) && (
                    <span className="absolute bottom-0 right-0 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-slate-950"></span>
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{project.manager?.name || 'Unassigned'}</p>
                  <p className="text-xs text-slate-500">{project.manager?.email || ''}</p>
                </div>
              </div>
            )}
          </div>

          {/* Members card */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950/30 p-6 backdrop-blur-md">
            <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Users className="h-4 w-4 text-indigo-400" />
              Assigned Team Members ({project.members?.length || 0})
            </h3>
            <div className="divide-y divide-slate-900 space-y-3.5">
              {project.members?.map((member) => (
                <div key={member._id} className="flex items-center justify-between pt-3.5 first:pt-0">
                  <div className="flex items-center gap-3">
                    <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-slate-300 text-xs font-semibold uppercase">
                      {member.name.charAt(0)}
                      {onlineUsers.includes(member._id) && (
                        <span className="absolute bottom-0 right-0 flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 border-2 border-slate-950"></span>
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-medium text-white">{member.name}</p>
                      <p className="text-[10px] text-slate-500">{member.email}</p>
                    </div>
                  </div>
                  <span className="text-[9px] uppercase tracking-wider rounded bg-slate-900 border border-slate-800 text-slate-400 px-1.5 py-0.5">
                    {member.role === 'Project Manager' ? 'PM' : 'Member'}
                  </span>
                </div>
              ))}

              {(!project.members || project.members.length === 0) && (
                <p className="text-xs text-slate-500 py-2">No team members assigned.</p>
              )}

              {/* Invite Team Member selector */}
              {isManager && (
                <div className="pt-4 border-t border-slate-900">
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Invite Member
                  </label>
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        handleInviteMember(e.target.value);
                        e.target.value = ''; // reset selection
                      }
                    }}
                    disabled={project.isArchived}
                    className="block w-full rounded-lg border border-slate-800 bg-slate-900 py-1.5 px-3.5 text-xs text-white focus:outline-none cursor-pointer disabled:opacity-40 animate-in fade-in duration-200"
                  >
                    <option value="">+ Choose user to invite...</option>
                    {systemUsers
                      .filter(
                        (u) =>
                          !project.members.some((m) => m._id === u._id) &&
                          u._id !== (project.manager?._id || project.manager)
                      )
                      .map((u) => (
                        <option key={u._id} value={u._id}>
                          {u.name} ({u.role})
                        </option>
                      ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Kanban Board & Analytics Section */}
      <div className="rounded-2xl border border-slate-800 bg-slate-950/20 p-6 backdrop-blur-md mb-8 animate-in fade-in duration-300">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 border-b border-slate-900 pb-4">
          <div className="flex items-center gap-6">
            <button
              onClick={() => setActiveTab('kanban')}
              className={`text-base font-bold flex items-center gap-2 cursor-pointer pb-4 -mb-[17px] transition-all border-b-2 ${
                activeTab === 'kanban'
                  ? 'text-white border-indigo-500'
                  : 'text-slate-400 border-transparent hover:text-slate-200'
              }`}
            >
              <CheckCircle2 className="h-4.5 w-4.5 text-indigo-400" />
              Kanban Board
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`text-base font-bold flex items-center gap-2 cursor-pointer pb-4 -mb-[17px] transition-all border-b-2 ${
                activeTab === 'analytics'
                  ? 'text-white border-indigo-500'
                  : 'text-slate-400 border-transparent hover:text-slate-200'
              }`}
            >
              <BarChart3 className="h-4.5 w-4.5 text-indigo-400" />
              Project Analytics
            </button>
          </div>
          
          {activeTab === 'kanban' && isManager && !project.isArchived && (
            <button
              onClick={handleAddTaskClick}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Add Kanban Task
            </button>
          )}
        </div>

        {activeTab === 'kanban' ? (
          /* Board Columns Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-start">
            {columns.map((col) => {
              const colTasks = groupedTasks[col.id] || [];
              return (
                <div
                  key={col.id}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, col.id)}
                  className={`rounded-2xl border p-4 flex flex-col min-h-[450px] transition-colors ${col.color}`}
                >
                  {/* Column Header */}
                  <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-900/60">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white uppercase tracking-wider">{col.title}</span>
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-slate-400">
                        {colTasks.length}
                      </span>
                    </div>
                  </div>

                  {/* Cards Container */}
                  <div className="space-y-3 flex-1 overflow-y-auto">
                    {colTasks.map((task) => (
                      <div
                        key={task._id}
                        draggable={!project.isArchived}
                        onDragStart={(e) => handleDragStart(e, task._id)}
                        onClick={() => handleTaskClick(task)}
                        className="group rounded-xl border border-slate-900 bg-slate-950 p-4 shadow-sm hover:border-indigo-505/50 hover:shadow-md cursor-grab active:cursor-grabbing transition-all select-none duration-150"
                      >
                        {/* Priority and Due Date */}
                        <div className="flex items-center justify-between mb-3">
                          <span
                            className={`inline-flex rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${
                              task.priority === 'High'
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/25'
                                : task.priority === 'Medium'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/25'
                                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25'
                            }`}
                          >
                            {task.priority}
                          </span>
                          {task.dueDate && (
                            <span className="text-[10px] text-slate-500 flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(task.dueDate).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}
                            </span>
                          )}
                        </div>

                        {/* Task Title */}
                        <h4 className="text-sm font-bold text-white group-hover:text-indigo-400 transition-colors line-clamp-1">
                          {task.title}
                        </h4>

                        {/* Task Description */}
                        {task.description && (
                          <p className="mt-1.5 text-xs text-slate-400 line-clamp-2 leading-relaxed">
                            {task.description}
                          </p>
                        )}

                        {/* Assignee Footer */}
                        <div className="mt-4 flex items-center justify-between border-t border-slate-900 pt-3">
                          <div className="flex items-center gap-1.5">
                            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 border border-slate-800 text-[9px] font-bold text-indigo-400 uppercase">
                              {task.assignedUser?.name ? task.assignedUser.name.charAt(0) : '?'}
                            </div>
                            <span className="text-[11px] font-medium text-slate-400 truncate max-w-[100px]">
                              {task.assignedUser?.name || 'Unassigned'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}

                    {colTasks.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-16 border border-dashed border-slate-900/60 rounded-xl text-slate-600 text-xs select-none">
                        Drag tasks here
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Project Analytics View */
          <div className="space-y-8 animate-in fade-in duration-300">
            {totalTasks === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 border border-dashed border-slate-800 rounded-2xl text-slate-500 text-sm">
                <BarChart3 className="h-10 w-10 text-slate-600 mb-3 animate-pulse" />
                <span>No task data available to generate charts.</span>
                <p className="text-xs text-slate-650 mt-1">Add tasks to the Kanban board to view live project metrics.</p>
              </div>
            ) : (() => {
              // Analytics Math calculations
              const todoTasksCount = project.tasks?.filter((t) => t.status === 'Todo' || t.status === 'To Do').length || 0;
              const inProgressTasksCount = project.tasks?.filter((t) => t.status === 'In Progress').length || 0;
              const reviewTasksCount = project.tasks?.filter((t) => t.status === 'Review' || t.status === 'In Review').length || 0;
              const completedTasksCount = project.tasks?.filter((t) => t.status === 'Completed' || t.status === 'Done').length || 0;

              const distributionData = [
                { name: 'To Do', value: todoTasksCount, color: '#64748b' },
                { name: 'In Progress', value: inProgressTasksCount, color: '#6366f1' },
                { name: 'In Review', value: reviewTasksCount, color: '#f59e0b' },
                { name: 'Completed', value: completedTasksCount, color: '#10b981' },
              ].filter(item => item.value > 0);

              const pendingTasksCount = todoTasksCount + inProgressTasksCount + reviewTasksCount;
              const progressData = [
                { name: 'Completed', value: completedTasksCount, color: '#10b981' },
                { name: 'Pending', value: pendingTasksCount, color: '#1e293b' },
              ];

              const uniqueUsersList = [];
              if (project.manager) {
                uniqueUsersList.push(project.manager);
              }
              project.members?.forEach((m) => {
                if (!uniqueUsersList.some((u) => u._id === m._id)) {
                  uniqueUsersList.push(m);
                }
              });

              const productivityData = uniqueUsersList
                .map((u) => {
                  const userTasks = project.tasks?.filter((t) => (t.assignedUser?._id || t.assignedUser)?.toString() === (u._id || u)?.toString()) || [];
                  const completed = userTasks.filter((t) => t.status === 'Completed' || t.status === 'Done').length;
                  const pending = userTasks.length - completed;

                  return {
                    name: u.name,
                    Completed: completed,
                    Pending: pending,
                    Total: userTasks.length,
                  };
                })
                .filter((data) => data.Total > 0);

              return (
                <>
                  {/* Upper charts row */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Progress Donut */}
                    <div className="rounded-2xl border border-slate-900 bg-slate-950/40 p-6 flex flex-col items-center">
                      <h4 className="text-sm font-bold text-white mb-6 uppercase tracking-wider self-start flex items-center gap-1.5">
                        <Percent className="h-4 w-4 text-indigo-400" />
                        Completion Progress
                      </h4>
                      
                      <div className="relative h-60 w-full flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={progressData}
                              cx="50%"
                              cy="50%"
                              innerRadius={70}
                              outerRadius={90}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              {progressData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{ backgroundColor: '#090d16', borderColor: '#1e293b', borderRadius: '8px' }}
                              itemStyle={{ color: '#cbd5e1', fontSize: '12px' }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute flex flex-col items-center justify-center text-center">
                          <span className="text-3xl font-extrabold text-white tracking-tight">{progressPercent}%</span>
                          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mt-0.5">Completed</span>
                        </div>
                      </div>

                      <div className="flex justify-center gap-6 mt-4 text-xs font-semibold">
                        <div className="flex items-center gap-1.5">
                          <span className="h-3 w-3 rounded bg-emerald-500"></span>
                          <span className="text-slate-400">Completed ({completedTasksCount})</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="h-3 w-3 rounded bg-slate-800"></span>
                          <span className="text-slate-400">Pending ({pendingTasksCount})</span>
                        </div>
                      </div>
                    </div>

                    {/* Task Distribution Pie */}
                    <div className="rounded-2xl border border-slate-900 bg-slate-950/40 p-6 flex flex-col">
                      <h4 className="text-sm font-bold text-white mb-6 uppercase tracking-wider flex items-center gap-1.5">
                        <TrendingUp className="h-4 w-4 text-indigo-400" />
                        Task Status Distribution
                      </h4>
                      
                      <div className="h-60 w-full">
                        {distributionData.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={distributionData}
                                cx="50%"
                                cy="50%"
                                outerRadius={90}
                                dataKey="value"
                                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                                labelLine={false}
                              >
                                {distributionData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip
                                contentStyle={{ backgroundColor: '#090d16', borderColor: '#1e293b', borderRadius: '8px' }}
                                itemStyle={{ color: '#cbd5e1', fontSize: '12px' }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="h-full flex items-center justify-center text-xs text-slate-500">No tasks created yet.</div>
                        )}
                      </div>

                      <div className="flex flex-wrap justify-center gap-4 mt-4 text-[10px] font-bold uppercase tracking-wider">
                        {[
                          { name: 'To Do', value: todoTasksCount, color: 'bg-slate-500' },
                          { name: 'In Progress', value: inProgressTasksCount, color: 'bg-indigo-500' },
                          { name: 'Review', value: reviewTasksCount, color: 'bg-amber-500' },
                          { name: 'Completed', value: completedTasksCount, color: 'bg-emerald-500' }
                        ].map((item) => (
                          <div key={item.name} className="flex items-center gap-1.5">
                            <span className={`h-2.5 w-2.5 rounded ${item.color}`}></span>
                            <span className="text-slate-400">{item.name} ({item.value})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Team Productivity Stacked Bar Chart */}
                  <div className="rounded-2xl border border-slate-900 bg-slate-950/40 p-6 flex flex-col">
                    <h4 className="text-sm font-bold text-white mb-6 uppercase tracking-wider flex items-center gap-1.5">
                      <Users className="h-4 w-4 text-indigo-400" />
                      Team Member Productivity (Tasks)
                    </h4>
                    
                    <div className="h-80 w-full min-h-[300px]">
                      {productivityData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={productivityData}
                            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.5} />
                            <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                            <YAxis stroke="#64748b" fontSize={11} tickLine={false} allowDecimals={false} />
                            <Tooltip
                              contentStyle={{ backgroundColor: '#090d16', borderColor: '#1e293b', borderRadius: '8px' }}
                              itemStyle={{ color: '#cbd5e1', fontSize: '12px' }}
                            />
                            <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                            <Bar dataKey="Completed" stackId="a" fill="#10b981" barSize={32} />
                            <Bar dataKey="Pending" stackId="a" fill="#312e81" barSize={32} radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex items-center justify-center text-xs text-slate-500">
                          No tasks have been assigned to team members yet.
                        </div>
                      )}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </div>

      {/* Edit project modal */}
      <ProjectModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        onSave={handleEditSave}
        project={project}
      />

      {/* Task Modal */}
      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => {
          setIsTaskModalOpen(false);
          setSelectedTask(null);
        }}
        onSave={handleSaveTask}
        onUpdateProject={(updatedProject) => setProject(updatedProject)}
        projectId={id}
        projectMembers={project.members}
        task={selectedTask ? project.tasks?.find((t) => t._id === (selectedTask._id || selectedTask.id)) : null}
      />
    </div>
  );
};

export default ProjectDetails;
