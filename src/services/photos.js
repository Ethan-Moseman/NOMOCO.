// =============================================================================
// Photo uploads (Cloud Storage). Optional everywhere — never block a form.
// =============================================================================

import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '../lib/firebase';

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB, matches storage.rules

/**
 * Uploads one image and returns its public download URL.
 * folder is 'propertyPhotos' or 'jobPhotos' — both are keyed by uid in the
 * storage rules, so a user can only ever write inside their own folder.
 */
export async function uploadPhoto(uid, file, folder = 'propertyPhotos') {
  if (!file) return null;
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file.');
  }
  if (file.size > MAX_BYTES) {
    throw new Error('That photo is larger than 10 MB. Please pick a smaller one.');
  }

  const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
  const fileRef = ref(storage, `${folder}/${uid}/${safeName}`);
  await uploadBytes(fileRef, file);
  return getDownloadURL(fileRef);
}

/** Uploads several photos at once and returns the URLs that succeeded. */
export async function uploadPhotos(uid, files, folder = 'propertyPhotos') {
  const list = Array.from(files || []).slice(0, 5); // keep the MVP snappy
  const results = await Promise.allSettled(
    list.map((file) => uploadPhoto(uid, file, folder))
  );
  return results
    .filter((result) => result.status === 'fulfilled' && result.value)
    .map((result) => result.value);
}
