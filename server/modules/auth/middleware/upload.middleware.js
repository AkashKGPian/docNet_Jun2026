const multer = require('multer');

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const fileFilter = (_req, file, cb) => {
  if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, WebP, or GIF images are allowed.'));
  }
};

const profilePhotoUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 },
}).single('photo');

function handleProfilePhotoUpload(req, res, next) {
  profilePhotoUpload(req, res, (error) => {
    if (!error) return next();

    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Profile photo must be 2 MB or smaller.' });
    }

    return res.status(400).json({ error: error.message || 'Invalid profile photo upload.' });
  });
}

module.exports = {
  handleProfilePhotoUpload,
};
