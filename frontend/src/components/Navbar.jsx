import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { KanbanSquare, LogOut, ShieldAlert, User as UserIcon, Bell, X, Info } from 'lucide-react';

const Navbar = () => {
  const { user, logout, notifications, clearNotifications } = useAuth();
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!user) return null;

  const getRoleBadge = (role) => {
    switch (role) {
      case 'Admin':
        return 'bg-rose-500/20 text-rose-400 border border-rose-500/30';
      case 'Project Manager':
        return 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30';
      default:
        return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
    }
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/70 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          
          {/* Logo Section */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center gap-2 text-xl font-bold tracking-tight text-white transition-all hover:opacity-90">
              <KanbanSquare className="h-6 w-6 text-indigo-400" />
              <span>Collab<span className="text-indigo-400">Hub</span></span>
            </Link>
            
            <div className="ml-10 flex items-baseline space-x-4">
              <Link
                to="/"
                className="rounded-md px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-900 hover:text-white transition-colors"
              >
                Dashboard
              </Link>
              {user.role === 'Admin' && (
                <Link
                  to="/admin"
                  className="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-rose-400 hover:bg-rose-950/30 hover:text-rose-300 transition-colors"
                >
                  <ShieldAlert className="h-4 w-4" />
                  Admin Panel
                </Link>
              )}
            </div>
          </div>

          {/* User profile, notifications, logout */}
          <div className="flex items-center gap-4 relative">
            
            {/* Real-time Notifications Bell */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative rounded-full p-2 text-slate-400 hover:bg-slate-900 hover:text-white transition-colors cursor-pointer"
                title="Notifications"
              >
                <Bell className="h-5 w-5" />
                {notifications.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                  </span>
                )}
              </button>

              {/* Notifications Dropdown Panel */}
              {showNotifications && (
                <div className="absolute right-0 mt-3 w-80 rounded-xl border border-slate-800 bg-slate-950 p-4 shadow-2xl ring-1 ring-black/5 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between border-b border-slate-900 pb-2 mb-3">
                    <span className="text-xs font-bold text-white uppercase tracking-wider">Inbox Notifications</span>
                    {notifications.length > 0 && (
                      <button
                        onClick={() => {
                          clearNotifications();
                          setShowNotifications(false);
                        }}
                        className="text-[10px] font-semibold text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
                      >
                        Clear All
                      </button>
                    )}
                  </div>

                  <div className="max-h-60 overflow-y-auto space-y-2.5">
                    {notifications.map((notif, idx) => (
                      <div
                        key={idx}
                        className="rounded-lg border border-slate-900 bg-slate-900/40 p-2.5 hover:border-slate-800 transition-all flex items-start gap-2"
                      >
                        <Info className="h-4.5 w-4.5 text-indigo-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-slate-200 leading-tight">{notif.title}</p>
                          <p className="text-[11px] text-slate-400 mt-1 leading-normal">{notif.message}</p>
                          <p className="text-[9px] text-slate-600 mt-1">
                            {new Date(notif.createdAt).toLocaleTimeString(undefined, {hour: '2-digit', minute:'2-digit'})}
                          </p>
                        </div>
                      </div>
                    ))}
                    {notifications.length === 0 && (
                      <div className="text-center py-6 text-slate-500 text-xs flex flex-col items-center justify-center">
                        <Bell className="h-6 w-6 text-slate-700 mb-2" />
                        No notifications inbox
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User credentials */}
            <div className="flex items-center gap-3 border-r border-slate-800 pr-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-slate-300">
                <UserIcon className="h-5 w-5" />
              </div>
              <div className="hidden text-left md:block">
                <p className="text-sm font-semibold text-slate-200">{user.name}</p>
                <p className={`mt-0.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${getRoleBadge(user.role)}`}>
                  {user.role}
                </p>
              </div>
            </div>

            {/* Logout button */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-slate-400 border border-slate-800 hover:bg-slate-800 hover:text-white transition-all cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
