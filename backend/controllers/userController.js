const User = require('../models/User');

// @desc    Get all users (for assignment lists)
// @route   GET /api/users
// @access  Private
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}).select('-password').sort({ name: 1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update user role
// @route   PUT /api/users/:id/role
// @access  Private (Admin only)
const updateUserRole = async (req, res) => {
  const { role } = req.body;

  if (!role || !['Admin', 'Project Manager', 'Team Member'].includes(role)) {
    return res.status(400).json({ message: 'Invalid or missing role' });
  }

  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Do not allow an Admin to demote themselves if they are the only admin
    if (user.id === req.user.id && user.role === 'Admin' && role !== 'Admin') {
      const adminCount = await User.countDocuments({ role: 'Admin' });
      if (adminCount <= 1) {
        return res.status(400).json({
          message: 'Cannot demote the only remaining Admin. Assign another Admin first.',
        });
      }
    }

    user.role = role;
    await user.save();

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      message: 'User role updated successfully',
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getAllUsers,
  updateUserRole,
};
