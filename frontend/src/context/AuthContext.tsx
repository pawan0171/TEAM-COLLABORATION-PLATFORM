'use client';

import React, { createContext, useState, useEffect, useContext } from 'react';
import api, { SOCKET_BASE_URL } from '../services/api';
import { io, Socket } from 'socket.io-client';
import { User, Notification, AuthContextType } from '../types';

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Real-time Socket states
  const [socket, setSocket] = useState<Socket | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Load token from localStorage once mounted
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedToken = localStorage.getItem('token');
      if (storedToken) {
        setToken(storedToken);
      } else {
        setLoading(false);
      }
    }
  }, []);

  // Fetch current user session when token is available
  useEffect(() => {
    const loadUser = async () => {
      if (token) {
        try {
          const response = await api.get<User>('/auth/me');
          setUser(response.data);
        } catch (error: any) {
          // If token expired or invalid, quietly clear session without throwing red errors
          if (error.response?.status === 401) {
            logout();
          } else {
            console.warn('User session check notice:', error.message);
            logout();
          }
        }
      }
      setLoading(false);
    };

    if (token) {
      loadUser();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const fetchNotifications = async () => {
    try {
      const response = await api.get<Notification[]>('/notifications');
      setNotifications(response.data);
    } catch (err) {
      console.warn('Failed to fetch notifications:', err);
    }
  };

  // Real-time Socket lifecycle management
  useEffect(() => {
    let socketInstance: Socket | null = null;

    if (user && token) {
      fetchNotifications();

      // Connect to the backend Socket server with token auth and resilient reconnect options
      socketInstance = io(SOCKET_BASE_URL, {
        auth: { token },
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        transports: ['websocket', 'polling'],
      });
      setSocket(socketInstance);

      // Listener for connection errors
      socketInstance.on('connect_error', (err) => {
        console.debug('Socket connection notice:', err.message);
      });

      // Listener for online user status updates
      socketInstance.on('onlineUsers', (usersList: string[]) => {
        setOnlineUsers(usersList);
      });

      // Listener for incoming assignment/comment/task-update notifications
      socketInstance.on('notification', (notif: Notification) => {
        setNotifications((prev) => [notif, ...prev]);
      });
    } else {
      setSocket(null);
      setOnlineUsers([]);
      setNotifications([]);
    }

    return () => {
      if (socketInstance) {
        socketInstance.disconnect();
      }
    };
  }, [user, token]);

  const login = async (email: string, password: string): Promise<User> => {
    try {
      const response = await api.post<{ token: string } & User>('/auth/login', { email, password });
      const { token: userToken, ...userData } = response.data;
      if (typeof window !== 'undefined') {
        localStorage.setItem('token', userToken);
      }
      setToken(userToken);
      setUser(userData as User);
      return userData as User;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Login failed');
    }
  };

  const register = async (name: string, email: string, password: string, role?: string): Promise<User> => {
    try {
      const response = await api.post<{ token: string } & User>('/auth/register', { name, email, password, role });
      const { token: userToken, ...userData } = response.data;
      if (typeof window !== 'undefined') {
        localStorage.setItem('token', userToken);
      }
      setToken(userToken);
      setUser(userData as User);
      return userData as User;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Registration failed');
    }
  };

  const logout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
    }
    setToken(null);
    setUser(null);
    setNotifications([]);
  };

  const clearNotifications = async () => {
    try {
      await api.delete('/notifications');
      setNotifications([]);
    } catch (err) {
      console.warn('Failed to clear notifications:', err);
      setNotifications([]);
    }
  };

  const markNotificationAsRead = async (notificationId: string) => {
    // Optimistically mark as read in local state
    setNotifications((prev) =>
      prev.map((n) => (n._id === notificationId ? { ...n, isRead: true } : n))
    );

    try {
      await api.put(`/notifications/${notificationId}/read`);
    } catch (err: any) {
      console.debug('Notification read status notice:', err.response?.status);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        logout,
        socket,
        onlineUsers,
        notifications,
        fetchNotifications,
        clearNotifications,
        markNotificationAsRead,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
