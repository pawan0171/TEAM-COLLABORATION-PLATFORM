import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import path from 'path';
import jwt from 'jsonwebtoken';
import connectDB from './config/db';
import { initRedis, trackUserOnline, trackUserOffline, getOnlineUsersFromRedis, isRedisAvailable } from './config/redis';
import User from './models/User';
import authRoutes from './routes/authRoutes';
import projectRoutes from './routes/projectRoutes';
import userRoutes from './routes/userRoutes';
import notificationRoutes from './routes/notificationRoutes';
import { notFound, errorHandler } from './middleware/errorMiddleware';

// Load environment variables
dotenv.config();

// Connect to MongoDB & Redis (guarded for testing)
if (process.env.NODE_ENV !== 'test') {
  connectDB();
  initRedis();
}

const app: Application = express();
const server = http.createServer(app);

// Socket.io setup
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  },
});

// In-memory fallback for online presence
const activeUsers = new Map<string, string>();

interface JwtSocketPayload {
  id: string;
}

// Authenticate socket connections before granting access to personal rooms
io.use(async (socket: Socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));

    const secret = process.env.JWT_SECRET || 'secret123';
    const decoded = jwt.verify(token, secret) as JwtSocketPayload;
    const user = await User.findById(decoded.id).select('_id role');
    if (!user) return next(new Error('User not found'));

    socket.data.user = user;
    next();
  } catch (error) {
    next(new Error('Invalid authentication token'));
  }
});

const broadcastOnlineUsers = async () => {
  if (isRedisAvailable()) {
    const redisUsers = await getOnlineUsersFromRedis();
    if (redisUsers.length > 0) {
      io.emit('onlineUsers', redisUsers);
      return;
    }
  }
  io.emit('onlineUsers', Array.from(activeUsers.keys()));
};

io.on('connection', async (socket: Socket) => {
  console.log(`Socket connected: ${socket.id}`);

  const user = socket.data.user;
  const userId = user?._id?.toString();

  if (userId) {
    socket.join(userId);
    activeUsers.set(userId, socket.id);
    await trackUserOnline(userId);
    await broadcastOnlineUsers();
  }

  // Project room actions
  socket.on('joinProject', (projectId: string) => {
    socket.join(projectId);
    console.log(`Socket ${socket.id} joined project room: ${projectId}`);
  });

  socket.on('leaveProject', (projectId: string) => {
    socket.leave(projectId);
    console.log(`Socket ${socket.id} left project room: ${projectId}`);
  });

  socket.on('disconnect', async () => {
    console.log(`Socket disconnected: ${socket.id}`);
    if (userId) {
      activeUsers.delete(userId);
      await trackUserOffline(userId);
      await broadcastOnlineUsers();
    }
  });
});

// Middleware to attach io to req
app.use((req: Request, res: Response, next: NextFunction) => {
  req.io = io;
  next();
});

// Core Middlewares
app.use(cors());
app.use(express.json());

// Serve static uploads
const uploadsPath = path.join(__dirname, '../uploads');
app.use('/uploads', express.static(uploadsPath));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/users', userRoutes);
app.use('/api/notifications', notificationRoutes);

// Basic health check
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'Team Collaboration Platform API is running',
    redis: isRedisAvailable() ? 'connected' : 'fallback-memory',
  });
});

// 404 & Centralized Error Handlers
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log(
      `Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`
    );
  });
}

export { app, server, io };
