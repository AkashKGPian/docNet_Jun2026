const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../../../uploads/profiles');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `patient-${req.user._id}-${Date.now()}${ext}`);
  },
});

const fileFilter = (_req, file, cb) => {
  const allowed = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
  if (allowed.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, WebP, or GIF images are allowed.'));
  }
};

const profilePhotoUpload = multer({
  storage,
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
  uploadDir,
};
