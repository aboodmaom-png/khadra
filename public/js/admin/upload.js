// رفع الصور والفيديو لـ Cloudinary من الموبايل
// الصور بتتصغّر على الجهاز قبل الرفع (أسرع بكثير على النت الضعيف)
import { cloudinaryConfig } from "../cloudinary-config.js";

const MAX = 1600;

async function compress(file) {
  if (!file.type.startsWith("image/") || /heic|heif|gif|svg/i.test(file.type)) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, MAX / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    c.getContext("2d").drawImage(bmp, 0, 0, w, h);
    bmp.close?.();
    const blob = await new Promise((res) => c.toBlob(res, "image/jpeg", 0.82));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;   // إذا المتصفح ما قدر يفتحها (زي HEIC) بنرفع الأصلية وCloudinary بيتصرف
  }
}

/**
 * بيرفع ملف وبيرجع رابطه. onProgress(0..1)
 */
export async function upload(file, onProgress) {
  if (!cloudinaryConfig.cloudName) throw new Error("cloudinary-not-configured");
  const body = await compress(file);
  const fd = new FormData();
  fd.append("file", body, file.name || "upload");
  fd.append("upload_preset", cloudinaryConfig.uploadPreset);
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open("POST", `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/auto/upload`);
    x.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total); };
    x.onload = () => {
      try {
        const r = JSON.parse(x.responseText);
        if (x.status >= 200 && x.status < 300 && r.secure_url) resolve(r.secure_url);
        else reject(new Error(r?.error?.message || "upload failed"));
      } catch (e) { reject(e); }
    };
    x.onerror = () => reject(new Error("network"));
    x.send(fd);
  });
}
