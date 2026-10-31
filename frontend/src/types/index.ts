export type UserRole = 'Admin' | 'Project Manager' | 'Team Member';

export interface User {
  _id: string;
  id?: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt?: string;
  updatedAt?: string;
}

export interface Comment {
  _id?: string;
  text: string;
  user: User | string;
  createdAt: string;
}

export interface Attachment {
  _id?: string;
  name: string;
  url: string;
  publicId?: string;
  fileType?: string;
  uploadedBy: User | string;
  uploadedAt?: string;
}

export type TaskPriority = 'Low' | 'Medium' | 'High';
export type TaskStatus = 'Todo' | 'To Do' | 'In Progress' | 'Review' | 'In Review' | 'Completed' | 'Done';

export interface Task {
  _id: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  status: TaskStatus;
  assignedUser?: User | string | null;
  dueDate?: string | null;
  comments?: Comment[];
  attachments?: Attachment[];
  createdAt?: string;
  updatedAt?: string;
}

export type ProjectStatus = 'Planning' | 'In Progress' | 'Completed';

export interface Project {
  _id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  isArchived: boolean;
  manager: User | any;
  members: User[];
  tasks: Task[];
  createdAt: string;
  updatedAt: string;
}

export type NotificationType =
  | 'assignment'
  | 'task-update'
  | 'task-completed'
  | 'comment'
  | 'attachment'
  | 'general';

export interface Notification {
  _id: string;
  recipient: string;
  sender?: User;
  type: NotificationType;
  title: string;
  message: string;
  projectId?: { _id: string; name: string } | string;
  taskId?: string;
  isRead: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string, role?: string) => Promise<User>;
  logout: () => void;
  socket: any | null;
  onlineUsers: string[];
  notifications: Notification[];
  fetchNotifications: () => Promise<void>;
  clearNotifications: () => Promise<void>;
  markNotificationAsRead: (id: string) => Promise<void>;
}
