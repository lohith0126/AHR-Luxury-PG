/**
 * Shrinks a phone-sized photo before upload (long side <= maxSide, JPEG). Photos and ID
 * images are stored in MongoDB, so keeping them small keeps the database small and
 * uploads fast on mobile data. PDFs and anything that can't be decoded pass through unchanged.
 */
export async function compressImage(file, { maxSide = 1600, quality = 0.85 } = {}) {
  if (!file || !file.type.startsWith('image/')) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    if (bitmap.close) bitmap.close();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob || (scale === 1 && blob.size >= file.size)) return file;
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'image';
    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
  } catch {
    return file;
  }
}
