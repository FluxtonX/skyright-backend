import multer from 'multer';

const FIVE_MB = 5 * 1024 * 1024;

export const uploadProfilePhoto = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: FIVE_MB,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }

    cb(null, true);
  },
}).single('photo');

const TWENTY_MB = 20 * 1024 * 1024;

export const uploadSingleFile = (fieldName: string) => multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: TWENTY_MB,
    files: 1,
  },
}).single(fieldName);
