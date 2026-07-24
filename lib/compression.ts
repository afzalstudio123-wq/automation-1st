/**
 * Compresses an image file in the browser using HTML5 Canvas.
 * Resizes the image if its dimensions exceed maxWidth, and outputs as WEBP.
 * Returns the compressed Blob or the original File if compression is skipped or fails.
 */
export async function compressImage(
  file: File,
  quality = 0.75,
  maxWidth = 1200
): Promise<Blob | File> {
  // Skip compression for very small files (< 150KB) to save time
  if (file.size < 150 * 1024) {
    return file;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Maintain aspect ratio while capping width
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file); // Fallback to original file if canvas context is not available
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Convert canvas image to WebP blob
        canvas.toBlob(
          (blob) => {
            if (blob) {
              // Only return compressed blob if it actually reduces the file size
              if (blob.size < file.size) {
                resolve(blob);
              } else {
                resolve(file);
              }
            } else {
              resolve(file);
            }
          },
          'image/webp',
          quality
        );
      };
      img.onerror = () => resolve(file); // Fallback to original file
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve(file); // Fallback to original file
    reader.readAsDataURL(file);
  });
}
