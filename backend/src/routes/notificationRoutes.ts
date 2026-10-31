import { Router } from 'express';
import {
  getNotifications,
  markAllAsRead,
  markAsRead,
  clearNotifications,
} from '../controllers/notificationController';
import { protect } from '../middleware/authMiddleware';

const router = Router();

router.get('/', protect, getNotifications);
router.put('/read-all', protect, markAllAsRead);
router.put('/:id/read', protect, markAsRead);
router.delete('/', protect, clearNotifications);

export default router;
