const multer = require('multer');

// Store files in memory buffer before upload
const storage = multer.memoryStorage();

// Set upload limits (e.g. 10MB)
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
});

module.exports = upload;
