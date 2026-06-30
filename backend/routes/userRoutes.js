const express = require('express');
const router = express.Router();
const { getAllUsers, updateUserRole } = require('../controllers/userController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.get('/', protect, getAllUsers);
router.put('/:id/role', protect, authorize('Admin'), updateUserRole);

module.exports = router;
