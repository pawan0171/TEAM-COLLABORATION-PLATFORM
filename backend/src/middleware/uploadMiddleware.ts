import multer from 'multer';

// Store files in memory buffer before Cloudinary upload or local write
const storage = multer.memoryStorage();

// Set upload limits (10MB)
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
});

export default upload;
