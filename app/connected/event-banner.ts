export async function bannerFormat(file:File):Promise<"png"|"jpg"|"webp"> {
  if(file.size>2*1024*1024 || !file.size) throw new Error("Choose an image up to 2 MB.");
  const bytes=new Uint8Array(await file.slice(0,12).arrayBuffer());
  if(file.type === "image/png" && [137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b))return "png";
  if(file.type === "image/jpeg" && bytes[0]===255 && bytes[1]===216 && bytes[2]===255)return "jpg";
  if(file.type === "image/webp" && String.fromCharCode(...bytes.slice(0,4)) === "RIFF" && String.fromCharCode(...bytes.slice(8,12)) === "WEBP")return "webp";
  throw new Error("Choose a PNG, JPEG or WebP image.");
}
