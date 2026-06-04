import admin from '../config/firebase';

export interface StoredFile {
  url: string;
  path: string;
}

const PUBLIC_URL_EXPIRY = '2100-01-01';

const getBucket = () => {
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET;

  if (!bucketName) {
    throw new Error('FIREBASE_STORAGE_BUCKET is not configured');
  }

  return admin.storage().bucket(bucketName);
};

const sanitizeFileName = (fileName: string) => {
  return fileName
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 120);
};

export const uploadBufferToFirebaseStorage = async (
  file: Express.Multer.File,
  folder: string,
  ownerId: string
): Promise<StoredFile> => {
  const bucket = getBucket();
  const safeName = sanitizeFileName(file.originalname || 'upload');
  const storagePath = `${folder}/${ownerId}/${Date.now()}-${safeName}`;
  const storageFile = bucket.file(storagePath);

  await storageFile.save(file.buffer, {
    resumable: false,
    metadata: {
      contentType: file.mimetype,
      metadata: {
        ownerId,
        originalName: file.originalname,
      },
    },
  });

  const [url] = await storageFile.getSignedUrl({
    action: 'read',
    expires: PUBLIC_URL_EXPIRY,
  });

  return {
    url,
    path: storagePath,
  };
};

export const deleteFirebaseStorageFile = async (storagePath?: string) => {
  if (!storagePath) {
    return;
  }

  const bucket = getBucket();

  try {
    await bucket.file(storagePath).delete({ ignoreNotFound: true });
  } catch (error) {
    console.warn(`Failed to delete Firebase Storage file ${storagePath}`, error);
  }
};
