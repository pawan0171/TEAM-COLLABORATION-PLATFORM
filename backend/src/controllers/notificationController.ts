import { Request, Response } from 'express';
import Notification from '../models/Notification';

// @desc    Get user notifications
// @route   GET /api/notifications
// @access  Private
export const getNotifications = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    const notifications = await Notification.find({ recipient: userId })
      .populate('sender', 'name email role')
      .populate('projectId', 'name')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json(notifications);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Mark all user notifications as read
// @route   PUT /api/notifications/read-all
// @access  Private
export const markAllAsRead = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    await Notification.updateMany(
      { recipient: userId, isRead: false },
      { $set: { isRead: true } }
    );
    res.json({ message: 'All notifications marked as read' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Mark a single notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
export const markAsRead = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      // If notification does not exist or was cleared, return success
      res.status(200).json({ message: 'Notification already marked as read or cleared' });
      return;
    }

    // Allow recipient or Admin to mark as read
    if (
      notification.recipient.toString() === userId?.toString() ||
      req.user?.role === 'Admin'
    ) {
      notification.isRead = true;
      await notification.save();
      res.json(notification);
      return;
    }

    res.status(403).json({ message: 'Not authorized to modify this notification' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete/clear all user notifications
// @route   DELETE /api/notifications
// @access  Private
export const clearNotifications = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    await Notification.deleteMany({ recipient: userId });
    res.json({ message: 'All notifications cleared successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
