/**
 * Compress an image file to a base64 string.
 * Resizes to maxSize x maxSize, quality 0.82 JPEG.
 * Keeps output well under 20KB for Firestore storage.
 */
export function compressImage(file: File, maxSize = 128): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to load image'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
        canvas.width  = Math.round(img.width  * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = e.target!.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/** Larger size for organizer logos — 256px, shown in events etc. */
export function compressLogo(file: File): Promise<string> {
  return compressImage(file, 256);
}
