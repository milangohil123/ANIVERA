/**
 * PashuRakshak Botad — Client-side Image Compression and Media Queueing Service.
 *
 * Implements Step 8.2 offline photo processing:
 * - Canvas-based image downscaling (max 1920x1080) to conserve mobile IndexedDB storage.
 * - Web Crypto API SHA-256 computation over clean binary blob.
 * - Decoupled offline queueing: links photo to parentEventId in 'PENDING_REPORT_SYNC' state.
 */
import { offlineDb, type QueuedMedia } from '../db/offlineDb';

export interface ProcessedMedia {
  blob: Blob;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
}

/**
 * Calculate SHA-256 digest string from an ArrayBuffer using Web Crypto API.
 */
export async function computeSha256(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Compress an image file/blob to safe mobile dimensions (max 1920px) and clean JPEG.
 */
export async function compressImage(
  inputBlob: Blob,
  maxDimension = 1920,
  quality = 0.82
): Promise<ProcessedMedia> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(inputBlob);

    img.onload = async () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;

      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to acquire canvas 2D rendering context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        async (compressedBlob) => {
          if (!compressedBlob) {
            reject(new Error('Canvas compression returned empty blob'));
            return;
          }

          const arrayBuffer = await compressedBlob.arrayBuffer();
          const sha256 = await computeSha256(arrayBuffer);

          resolve({
            blob: compressedBlob,
            mimeType: 'image/jpeg',
            sizeBytes: compressedBlob.size,
            sha256,
          });
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(new Error(`Failed to load image for compression: ${err}`));
    };

    img.src = url;
  });
}

/**
 * Compress and enqueue a captured disease report photo into local IndexedDB.
 */
export async function queueDiseaseReportPhoto(
  parentEventId: string,
  rawFile: Blob
): Promise<string> {
  const processed = await compressImage(rawFile);
  const mediaId = crypto.randomUUID();

  const mediaItem: QueuedMedia = {
    mediaId,
    parentEventId,
    blob: processed.blob,
    mimeType: processed.mimeType,
    sizeBytes: processed.sizeBytes,
    sha256: processed.sha256,
    clientCreatedAt: new Date().toISOString(),
    state: 'PENDING_REPORT_SYNC',
    attempts: 0,
  };

  await offlineDb.queued_media.add(mediaItem);
  return mediaId;
}

