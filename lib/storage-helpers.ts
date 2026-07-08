import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  UploadMetadata,
} from 'firebase/storage';
import { storage } from './firebase';

/**
 * Upload file to Firebase Storage
 * @param path Storage path (e.g., 'profile/userId/photo.jpg')
 * @param file File to upload
 * @param metadata Optional metadata
 * @returns Download URL
 */
export async function uploadFile(
  path: string,
  file: File | Blob,
  metadata?: UploadMetadata
): Promise<string> {
  const storageRef = ref(storage, path);
  const snapshot = await uploadBytes(storageRef, file, metadata);
  const downloadURL = await getDownloadURL(snapshot.ref);
  return downloadURL;
}

/**
 * Upload profile photo
 */
export async function uploadProfilePhoto(
  userId: string,
  file: File
): Promise<string> {
  const fileName = `${Date.now()}_${file.name}`;
  const path = `profile/${userId}/${fileName}`;
  return uploadFile(path, file, {
    contentType: file.type,
  });
}

/**
 * Upload absensi selfie photo
 */
export async function uploadAbsensiPhoto(
  userId: string,
  date: Date,
  file: File,
  type: 'clock-in' | 'clock-out'
): Promise<string> {
  const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
  const fileName = `${type}_${Date.now()}.jpg`;
  const path = `absensi/${userId}/${dateStr}/${fileName}`;
  return uploadFile(path, file, {
    contentType: 'image/jpeg',
  });
}

/**
 * Upload pengajuan document (cuti/izin)
 */
export async function uploadPengajuanDocument(
  userId: string,
  pengajuanId: string,
  file: File
): Promise<string> {
  const fileName = `${Date.now()}_${file.name}`;
  const path = `pengajuan/${userId}/${pengajuanId}/${fileName}`;
  return uploadFile(path, file, {
    contentType: file.type,
  });
}

/**
 * Delete file from Firebase Storage
 */
export async function deleteFile(downloadURL: string): Promise<void> {
  try {
    const fileRef = ref(storage, downloadURL);
    await deleteObject(fileRef);
  } catch (error) {
    console.error('Error deleting file:', error);
    throw error;
  }
}

/**
 * Convert File to base64 (for preview before upload)
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Compress image before upload
 */
export async function compressImage(
  file: File,
  maxWidth: number = 1024,
  quality: number = 0.8
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to compress image'));
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
