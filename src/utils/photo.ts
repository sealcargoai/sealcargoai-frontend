// 02-11x: optional product photo. It is shrunk in the browser (longest side ≤ 1024 px, JPEG): the upload is
// small and the EXIF data (GPS location, camera) is dropped because only the pixels are redrawn. The photo is
// sent once to /api/suppliers/image-analyze to SUGGEST what the product is; it is never stored or sent to SEAL.
// The client decides what goes into the description: nothing the AI saw is added on its own.

export const PHOTO_MAX_SIDE = 1024;
export const PHOTO_MAX_BYTES = 1_500_000; // the server's limit (services/vision.js)
export const PHOTO_MAX_INPUT_BYTES = 15_000_000;

export type PhotoError = "photo_type" | "photo_too_big" | "photo_unreadable";

/** The photo as a small JPEG data URL, or an error code. */
export async function shrinkPhoto(file: File): Promise<{ dataUrl: string; bytes: number } | { error: PhotoError }> {
  if (!file || !/^image\//.test(file.type || "")) return { error: "photo_type" };
  if (/^image\/(?:svg|gif)/.test(file.type)) return { error: "photo_type" };
  if (file.size > PHOTO_MAX_INPUT_BYTES) return { error: "photo_too_big" };
  let bitmap: ImageBitmap | HTMLImageElement;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    // some browsers can't decode HEIC and similar: the client is asked for a JPG or PNG
    return { error: "photo_unreadable" };
  }
  const w = (bitmap as ImageBitmap).width;
  const h = (bitmap as ImageBitmap).height;
  if (!w || !h) return { error: "photo_unreadable" };
  const scale = Math.min(1, PHOTO_MAX_SIDE / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return { error: "photo_unreadable" };
  ctx.fillStyle = "#fff"; // a transparent PNG becomes white, not black
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap as CanvasImageSource, 0, 0, canvas.width, canvas.height);
  for (const q of [0.82, 0.7, 0.55]) {
    const dataUrl = canvas.toDataURL("image/jpeg", q);
    const bytes = Math.floor(((dataUrl.length - dataUrl.indexOf(",") - 1) * 3) / 4);
    if (bytes <= PHOTO_MAX_BYTES) return { dataUrl, bytes };
  }
  return { error: "photo_too_big" };
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** The description with the product seen in the photo: as the description when empty, otherwise added once. */
export function withPhotoProduct(description: string, productEs: string, maxLen = 1500): string {
  const d = String(description || "").trim();
  const p = String(productEs || "").trim();
  if (!p) return d;
  if (!d) return p.slice(0, maxLen);
  if (norm(d).includes(norm(p))) return d;
  return `${d}\n${p}`.slice(0, maxLen);
}

/** The description with one printed figure the client chose to add (once). */
export function withPhotoSpec(description: string, spec: string, maxLen = 1500): string {
  const d = String(description || "").trim();
  const s = String(spec || "").trim();
  if (!s) return d;
  if (norm(d).replace(/\s/g, "").includes(norm(s).replace(/\s/g, ""))) return d;
  return (d ? `${d}, ${s}` : s).slice(0, maxLen);
}
