import { v2 as cloudinary } from 'cloudinary';

const isConfigured: boolean = !!(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

if (isConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
} else {
  console.warn(
    '⚠️ Cloudinary credentials missing from environment. File uploads will fall back to local disk storage.'
  );
}

export { cloudinary, isConfigured as isCloudinaryConfigured };
