export async function bannerFormat(file:File):Promise<"png"|"jpg"|"webp"> {
  if(file.size>2*1024*1024 || !file.size) throw new Error("Choose an image up to 2 MB.");
  const bytes=new Uint8Array(await file.slice(0,12).arrayBuffer());
  if(file.type === "image/png" && [137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b))return "png";
  if(file.type === "image/jpeg" && bytes[0]===255 && bytes[1]===216 && bytes[2]===255)return "jpg";
  if(file.type === "image/webp" && String.fromCharCode(...bytes.slice(0,4)) === "RIFF" && String.fromCharCode(...bytes.slice(8,12)) === "WEBP")return "webp";
  throw new Error("Choose a PNG, JPEG or WebP image.");
}

// Read the picker handle immediately. Mobile providers can revoke it while a
// manager finishes the form; only the copied Blob is retained for later upload.
export async function copyBanner(file: File): Promise<Blob> {
  if (!file.size || file.size > 20 * 1024 * 1024)
    throw new Error("Choose a PNG, JPEG or WebP photo up to 20 MB.");
  let bytes: ArrayBuffer;
  try { bytes = await file.arrayBuffer(); }
  catch { throw new Error("This photo could not be opened. Choose it again, or save it to your device first. Your event details are kept."); }
  const blob = new Blob([bytes], { type: file.type });
  // Signature validation uses the owned bytes, with the upload size checked
  // after resizing rather than rejecting normal camera photos at selection.
  await bannerFormat(new File([blob.slice(0, 12)], "banner", { type: file.type }));
  return blob;
}

export async function prepareBanner(file: File): Promise<Blob> {
  const owned = await copyBanner(file);
  const url = URL.createObjectURL(owned);
  try {
    const image = new Image();
    image.src = url;
    try { await image.decode(); }
    catch { throw new Error("This photo could not be opened. Choose another PNG, JPEG or WebP photo. Your event details are kept."); }
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 60_000_000)
      throw new Error("Choose a smaller photo for the event banner.");
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("The photo could not be prepared. Please choose it again.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    // Re-encoding also avoids uploading camera/location metadata.
    const result = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, owned.type === "image/jpeg" ? "image/jpeg" : "image/webp", 0.85));
    if (!result || result.size > 2 * 1024 * 1024)
      throw new Error("Choose a smaller photo for the event banner.");
    return result;
  } finally { URL.revokeObjectURL(url); }
}
