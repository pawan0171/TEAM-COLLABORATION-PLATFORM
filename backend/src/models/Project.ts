import mongoose, { Document, Model, Schema, Types } from 'mongoose';
import { ProjectStatus, TaskPriority, TaskStatus } from '../types';

export interface IComment {
  text: string;
  user: Types.ObjectId | any;
  createdAt?: Date;
}

export interface ICommentDocument extends IComment, Types.Subdocument {
  _id: Types.ObjectId;
}

export interface IAttachment {
  name: string;
  url: string;
  publicId?: string;
  fileType?: string;
  uploadedBy: Types.ObjectId | any;
  uploadedAt?: Date;
}

export interface IAttachmentDocument extends IAttachment, Types.Subdocument {
  _id: Types.ObjectId;
}

export interface ITask {
  title: string;
  description?: string;
  priority: TaskPriority;
  status: TaskStatus;
  assignedUser?: Types.ObjectId | any;
  dueDate?: Date;
  comments: Types.DocumentArray<ICommentDocument>;
  attachments: Types.DocumentArray<IAttachmentDocument>;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ITaskDocument extends ITask, Types.Subdocument {
  _id: Types.ObjectId;
}

export interface IProject {
  name: string;
  description: string;
  status: ProjectStatus;
  isArchived: boolean;
  manager: Types.ObjectId | any;
  members: Types.ObjectId[] | any[];
  tasks: Types.DocumentArray<ITaskDocument>;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IProjectDocument extends IProject, Document {
  _id: Types.ObjectId;
}

const commentSchema = new Schema<ICommentDocument>(
  {
    text: {
      type: String,
      required: [true, 'Please add a comment text'],
      trim: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const attachmentSchema = new Schema<IAttachmentDocument>(
  {
    name: {
      type: String,
      required: [true, 'Please add an attachment name'],
    },
    url: {
      type: String,
      required: [true, 'Please add an attachment URL'],
    },
    publicId: {
      type: String,
    },
    fileType: {
      type: String,
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const taskSchema = new Schema<ITaskDocument>(
  {
    title: {
      type: String,
      required: [true, 'Please add a task title'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High'],
      default: 'Medium',
    },
    status: {
      type: String,
      enum: ['Todo', 'To Do', 'In Progress', 'Review', 'In Review', 'Completed', 'Done'],
      default: 'Todo',
    },
    assignedUser: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: false,
      default: null,
    },
    dueDate: {
      type: Date,
    },
    comments: [commentSchema],
    attachments: [attachmentSchema],
  },
  {
    timestamps: true,
    _id: true,
  }
);

const projectSchema = new Schema<IProjectDocument>(
  {
    name: {
      type: String,
      required: [true, 'Please add a project name'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Please add a project description'],
    },
    status: {
      type: String,
      enum: ['Planning', 'In Progress', 'Completed'],
      default: 'Planning',
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
    manager: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    members: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    tasks: [taskSchema],
  },
  {
    timestamps: true,
  }
);

const Project: Model<IProjectDocument> = mongoose.model<IProjectDocument>('Project', projectSchema);

export default Project;
