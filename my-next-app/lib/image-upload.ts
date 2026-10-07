/** Shared browser-only preparation for generation photos and avatars. */
export const IMAGE_UPLOAD_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,image/heic-sequence,image/heif-sequence,.heic,.heif";
export const MAX_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024;
// Avatars pass through a Server Action; Vercel Functions reject bodies above ~4.5 MB.
export const MAX_AVATAR_UPLOAD_BYTES = 4 * 1024 * 1024;
export const AVATAR_TOO_LARGE_MESSAGE = "Profile photos must be 4 MiB or smaller after conversion. Choose a smaller photo or export a smaller JPEG.";
const JPEG_QUALITY = 0.9;
const WEB_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const HEIF_BRANDS = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis", "hevm", "hevs", "mif1", "msf1"]);

export class ImageUploadError extends Error {}

function ascii(bytes: Uint8Array, start: number, length: number) {
  return String.fromCharCode(...bytes.subarray(start, start + length));
}

/** Sniff before trusting MIME/extension: pickers may omit or mislabel either. */
async function inspectImage(file: File) {
  const bytes = new Uint8Array(await file.slice(0, 512).arrayBuffer());
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && ascii(bytes, 1, 3) === "PNG") return "image/png";
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") return "image/webp";
  if (ascii(bytes, 4, 4) === "ftyp") {
    const brands = [ascii(bytes, 8, 4)];
    const boxSize = new DataView(bytes.buffer).getUint32(0);
    for (let offset = 16; offset + 4 <= Math.min(boxSize, bytes.length); offset += 4) {
      brands.push(ascii(bytes, offset, 4));
    }
    // AVIF also uses mif1; do not mistake it for an iPhone HEIC image.
    if (brands.includes("avif") || brands.includes("avis")) return "unsupported";
    if (brands.some(brand => HEIF_BRANDS.has(brand))) return "heif";
    return "unsupported";
  }
  if (/^image\/hei[cf](?:-sequence)?$/i.test(file.type) || /\.hei[cf]$/i.test(file.name)) return "heif";
  return file.type.toLowerCase();
}

async function nativeHeifToJpeg(file: File): Promise<Blob> {
  // The browser applies orientation once; drawing bakes it into the JPEG pixels.
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const canvas = document.createElement("canvas");
  try {
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image canvas unavailable.");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("JPEG encoding failed.")), "image/jpeg", JPEG_QUALITY);
    });
  } finally {
    bitmap.close();
    canvas.width = canvas.height = 0;
  }
}

async function heifToJpeg(file: File): Promise<Blob> {
  try {
    return await nativeHeifToJpeg(file);
  } catch {
    // Keep the codec out of initial bundles and ordinary JPEG/PNG/WebP uploads.
    const { heicTo } = await import("heic-to/csp");
    // libheif applies the container's rotation/mirroring. Do not apply the EXIF
    // orientation again or copy it into the output: that double-rotates photos.
    return await heicTo({ blob: file, type: "image/jpeg", quality: JPEG_QUALITY });
  }
}

type PrepareOptions = { maxBytes?: number; tooLargeMessage?: string };

/** The size limit is on the prepared/uploaded file, not the original HEIC. */
export async function prepareImageUpload(file: File, { maxBytes = MAX_IMAGE_UPLOAD_BYTES, tooLargeMessage }: PrepareOptions = {}): Promise<File> {
  if (file.size === 0) throw new ImageUploadError("Choose a nonempty image.");
  let kind: string;
  try {
    kind = await inspectImage(file);
  } catch {
    throw new ImageUploadError("Couldn’t read this photo. Choose it again.");
  }
  let prepared = file;
  if (kind === "heif") {
    let jpeg: Blob;
    try {
      jpeg = await heifToJpeg(file);
      if (jpeg.type !== "image/jpeg" || !jpeg.size) throw new Error("Invalid JPEG output.");
    } catch {
      throw new ImageUploadError("Couldn’t convert this HEIC/HEIF photo. Try another photo or export it as JPEG.");
    }
    const stem = file.name.replace(/\.[^.]+$/, "") || "photo";
    prepared = new File([jpeg], `${stem}.jpg`, { type: "image/jpeg", lastModified: file.lastModified });
  } else if (!WEB_TYPES.has(kind)) {
    throw new ImageUploadError("Choose a JPEG, PNG, WebP, HEIC, or HEIF photo.");
  } else if (file.type !== kind || /\.hei[cf]$/i.test(file.name)) {
    // Some iPhone pickers already convert the bytes but retain the HEIC name.
    const extension = kind === "image/jpeg" ? "jpg" : kind.split("/")[1];
    prepared = new File([file], `${file.name.replace(/\.[^.]+$/, "") || "photo"}.${extension}`, { type: kind, lastModified: file.lastModified });
  }
  if (prepared.size > maxBytes) {
    throw new ImageUploadError(tooLargeMessage ?? (kind === "heif"
      ? "The converted JPEG is larger than 5 MiB. Choose a smaller photo or export a smaller JPEG."
      : "Choose an image no larger than 5 MiB."));
  }
  return prepared;
}
