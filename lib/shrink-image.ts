// Browser-only helper: resize a picked photo and convert it to JPEG before upload.
// Small uploads on mobile data, and a format WhatsApp always accepts.
const MAX_SIDE = 1600;

export async function shrinkImage(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('This photo format can’t be read here. Use a JPG or PNG (iPhone HEIC photos: change Camera → Formats → Most Compatible).');
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const width = Math.round(bmp.width * scale);
  const height = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not process the photo.');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bmp, 0, 0, width, height);
  bmp.close();
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.86));
  if (!blob) throw new Error('Could not process the photo.');
  return { blob, width, height };
}
