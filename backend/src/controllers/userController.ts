import { Request, Response } from 'express';
import User from '../models/User';
import { UserRole } from '../types';
import { getCache, setCache, delCache } from '../config/redis';

// @desc    Get all users (for assignment lists)
// @route   GET /api/users
// @access  Private
export const getAllUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const cacheKey = 'users:all';
    const cachedUsers = await getCache<any[]>(cacheKey);
    if (cachedUsers) {
      res.json(cachedUsers);
      return;
    }

    const users = await User.find({}).select('-password').sort({ name: 1 });
    await setCache(cacheKey, users, 300); // 5 min cache
    res.json(users);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update user role
// @route   PUT /api/users/:id/role
// @access  Private (Admin only)
export const updateUserRole = async (req: Request, res: Response): Promise<void> => {
  const { role } = req.body;

  if (!role || !['Admin', 'Project Manager', 'Team Member'].includes(role)) {
    res.status(400).json({ message: 'Invalid or missing role' });
    return;
  }

  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    // Do not allow an Admin to demote themselves if they are the only admin
    const currentUserId = req.user?._id?.toString();
    if (user._id.toString() === currentUserId && user.role === 'Admin' && role !== 'Admin') {
      const adminCount = await User.countDocuments({ role: 'Admin' });
      if (adminCount <= 1) {
        res.status(400).json({
          message: 'Cannot demote the only remaining Admin. Assign another Admin first.',
        });
        return;
      }
    }

    user.role = role as UserRole;
    await user.save();

    // Invalidate users cache
    await delCache('users:all');

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      message: 'User role updated successfully',
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
