/* eslint-disable @typescript-eslint/no-unused-vars */
import { ref as dbRef, set } from 'firebase/database';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { rdb, storage } from '../../firebase';

interface MediaInput {
  file?: File; // File for upload (optional if providing URL directly)
  url?: string; // Direct URL (optional if uploading file)
  type: 'image' | 'video';
  alt: string;
}

interface PostScreenSaverLayoutResult {
  success: boolean;
  error?: string;
}

export const postScreenSaverLayout = async (
  tenantId: string,
  layoutId: string,
  mediaInputs: MediaInput[],
  overwrite: boolean = false,
): Promise<PostScreenSaverLayoutResult> => {
  try {
    if (!tenantId || !layoutId) {
      throw new Error('tenantId and layoutId are required');
    }

    if (mediaInputs.length === 0) {
      throw new Error('At least one media item is required');
    }

    // Validate media inputs
    for (const input of mediaInputs) {
      if (!input.file && !input.url) {
        throw new Error('Each media item must have either a file or a URL');
      }
      if (!['image', 'video'].includes(input.type)) {
        throw new Error('Invalid media type; must be "image" or "video"');
      }
      if (!input.alt) {
        throw new Error('Alt text is required for each media item');
      }
    }

    // Prepare media for Firebase
    const mediaPromises = mediaInputs.map(async (input) => {
      let src: string;

      if (input.file) {
        // Upload file to Firebase Storage
        const storagePath = `TenantsDb/${tenantId}/Media/${Date.now()}_${input.file.name}`;
        const storageReference = storageRef(storage, storagePath);
        await uploadBytes(storageReference, input.file);
        src = await getDownloadURL(storageReference);
      } else {
        // Use provided URL
        src = input.url!;
      }

      return {
        type: input.type,
        src,
        alt: input.alt,
      };
    });

    const media = await Promise.all(mediaPromises);

    // Write to Realtime Database
    const dbPath = `TenantsDb/${tenantId}/ScreenSaverLayouts/${layoutId}`;
    const dbReference = dbRef(rdb, dbPath);

    await set(dbReference, { media: overwrite ? media : media });

    return { success: true };
  } catch (error) {
    console.error('Error posting ScreenSaver layout:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};