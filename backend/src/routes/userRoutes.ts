import { Router } from 'express';
import { getAllUsers, updateUserRole } from '../controllers/userController';
import { protect, authorize } from '../middleware/authMiddleware';

const router = Router();

router.get('/', protect, getAllUsers);
router.put('/:id/role', protect, authorize('Admin'), updateUserRole);

export default router;
