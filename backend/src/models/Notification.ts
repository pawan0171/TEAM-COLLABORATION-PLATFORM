import mongoose, { Document, Model, Schema, Types } from 'mongoose';
import { NotificationType } from '../types';

export interface INotification {
  recipient: Types.ObjectId | any;
  sender?: Types.ObjectId | any;
  type: NotificationType;
  title: string;
  message: string;
  projectId?: Types.ObjectId | any;
  taskId?: Types.ObjectId | any;
  isRead: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface INotificationDocument extends INotification, Document {
  _id: Types.ObjectId;
}

const notificationSchema = new Schema<INotificationDocument>(
  {
    recipient: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    type: {
      type: String,
      enum: ['assignment', 'task-update', 'task-completed', 'comment', 'attachment', 'general'],
      default: 'general',
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
    },
    taskId: {
      type: Schema.Types.ObjectId,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const Notification: Model<INotificationDocument> = mongoose.model<INotificationDocument>(
  'Notification',
  notificationSchema
);

export default Notification;
