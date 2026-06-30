import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { ShieldCheck, UserCheck, Users, AlertCircle, RefreshCw } from 'lucide-react';

const AdminPanel = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get('/users');
      setUsers(response.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRoleChange = async (userId, newRole) => {
    setUpdatingId(userId);
    setError('');
    setSuccessMsg('');
    try {
      const response = await api.put(`/users/${userId}/role`, { role: newRole });
      setUsers((prevUsers) =>
        prevUsers.map((u) => (u._id === userId ? { ...u, role: newRole } : u))
      );
      setSuccessMsg(response.data.message || 'User role updated successfully!');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update user role');
    } finally {
      setUpdatingId(null);
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
      {/* Header */}
      <div className="md:flex md:items-center md:justify-between mb-8">
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold leading-7 text-white sm:truncate sm:text-3xl">
            User Roles Management
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Admin console to assign roles (Admin, Project Manager, Team Member) across the platform.
          </p>
        </div>
        <div className="mt-4 flex md:ml-4 md:mt-0">
          <button
            onClick={fetchUsers}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-300 border border-slate-800 hover:bg-slate-800 hover:text-white cursor-pointer transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="mb-6 flex items-start gap-2.5 rounded-lg border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-400">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="mb-6 flex items-start gap-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-400">
          <ShieldCheck className="h-5 w-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Users Table */}
      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/40 backdrop-blur-md">
        <table className="min-w-full divide-y divide-slate-800 text-left">
          <thead className="bg-slate-900/50">
            <tr>
              <th scope="col" className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
                User
              </th>
              <th scope="col" className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Email
              </th>
              <th scope="col" className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Current Role
              </th>
              <th scope="col" className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Change Assignment
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-transparent">
            {users.map((item) => (
              <tr key={item._id} className="hover:bg-slate-900/20 transition-colors">
                <td className="whitespace-nowrap px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-indigo-400 font-semibold border border-indigo-500/20">
                      {item.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm font-medium text-white">{item.name}</span>
                  </div>
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-300">
                  {item.email}
                </td>
                <td className="whitespace-nowrap px-6 py-4">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      item.role === 'Admin'
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        : item.role === 'Project Manager'
                        ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    }`}
                  >
                    {item.role === 'Admin' ? (
                      <ShieldCheck className="h-3 w-3" />
                    ) : (
                      <UserCheck className="h-3 w-3" />
                    )}
                    {item.role}
                  </span>
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm">
                  {updatingId === item._id ? (
                    <span className="text-slate-500 text-xs flex items-center gap-1.5">
                      <div className="h-3 w-3 animate-spin rounded-full border border-slate-500 border-t-transparent"></div>
                      Updating...
                    </span>
                  ) : (
                    <select
                      value={item.role}
                      onChange={(e) => handleRoleChange(item._id, e.target.value)}
                      className="rounded-lg border border-slate-800 bg-slate-900 py-1.5 px-3.5 text-xs text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer transition-all"
                    >
                      <option value="Team Member">Team Member</option>
                      <option value="Project Manager">Project Manager</option>
                      <option value="Admin">Admin</option>
                    </select>
                  )}
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan="4" className="text-center py-8 text-slate-500 text-sm">
                  <Users className="h-8 w-8 mx-auto mb-2 text-slate-600" />
                  No users found in system.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminPanel;
