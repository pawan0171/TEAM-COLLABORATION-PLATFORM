const express = require('express');
const router = express.Router();
const {
  getProjects,
  createProject,
  getProjectById,
  updateProject,
  deleteProject,
  addTask,
  updateTask,
  deleteTask,
  archiveProject,
  unarchiveProject,
  addComment,
  uploadAttachment,
  deleteAttachment,
} = require('../controllers/projectController');
const { protect, authorize } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

router
  .route('/')
  .get(protect, getProjects)
  .post(protect, authorize('Admin', 'Project Manager'), createProject);

router
  .route('/:id')
  .get(protect, getProjectById)
  .put(protect, authorize('Admin', 'Project Manager'), updateProject)
  .delete(protect, authorize('Admin', 'Project Manager'), deleteProject);

router.put('/:id/archive', protect, authorize('Admin', 'Project Manager'), archiveProject);
router.put('/:id/unarchive', protect, authorize('Admin', 'Project Manager'), unarchiveProject);

router
  .route('/:id/tasks')
  .post(protect, authorize('Admin', 'Project Manager'), addTask);

router
  .route('/:id/tasks/:taskId')
  .put(protect, updateTask)
  .delete(protect, authorize('Admin', 'Project Manager'), deleteTask);

router.post('/:id/tasks/:taskId/comments', protect, addComment);

// Task File Attachments routes
router.post('/:id/tasks/:taskId/attachments', protect, upload.single('file'), uploadAttachment);
router.delete('/:id/tasks/:taskId/attachments/:attachmentId', protect, deleteAttachment);

module.exports = router;
