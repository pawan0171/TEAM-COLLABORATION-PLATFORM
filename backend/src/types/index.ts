import { Server as SocketIOServer } from 'socket.io';
import { IUserDocument } from '../models/User';

export type UserRole = 'Admin' | 'Project Manager' | 'Team Member';

export type ProjectStatus = 'Planning' | 'In Progress' | 'Completed';

export type TaskPriority = 'Low' | 'Medium' | 'High';

export type TaskStatus =
  | 'Todo'
  | 'To Do'
  | 'In Progress'
  | 'Review'
  | 'In Review'
  | 'Completed'
  | 'Done';

export type NotificationType =
  | 'assignment'
  | 'task-update'
  | 'task-completed'
  | 'comment'
  | 'attachment'
  | 'general';

declare global {
  namespace Express {
    interface Request {
      user?: IUserDocument;
      io?: SocketIOServer;
    }
  }
}
