import multer from 'multer';
import { Request } from 'express';
import { getFirebaseStorage } from '../config/firebase';
import { AppError } from './errorHandler';

// Configure multer for memory storage
const storage = multer.memoryStorage();

// File filter to only allow images
const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new AppError('Only image files are allowed', 400));
  }
};

// Configure multer upload
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// Function to upload file to Firebase Storage
export const uploadToFirebase = async (
  file: Express.Multer.File,
  path: string
): Promise<string> => {
  try {
    const bucket = getFirebaseStorage().bucket();
    const blob = bucket.file(path);
    
    const blobStream = blob.createWriteStream({
      metadata: {
        contentType: file.mimetype,
      },
    });

    return new Promise((resolve, reject) => {
      blobStream.on('error', (error) => {
        reject(new AppError('Error uploading file', 500));
      });

      blobStream.on('finish', async () => {
        // Make the file publicly accessible
        await blob.makePublic();
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;
        resolve(publicUrl);
      });

      blobStream.end(file.buffer);
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Error uploading file to storage', 500);
  }
}; 