// أدوات مشتركة بين المتجر ولوحة التحكم

// ---- حماية النصوص قبل ما تنحط بالصفحة (أي نص جاي من الداتابيز أو من الزبون) ----
const ESC_MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, (c) => ESC_MAP[c]);
}
export const escAttr = esc;

// بنسمح بروابط https و مسارات نسبية بس، أي إشي ثاني (javascript: مثلاً) بيرجع فاضي
export function safeUrl(u) {
  const s = String(u ?? "").trim();
  if (!s) return "";
  if (/^https:\/\//i.test(s)) return s;
  // "/assets/.." بتصير "assets/.." عشان تشتغل من أي مجلد (Live Server بيفتح الموقع من /public/)
  if (/^(\.{0,2}\/)?[\w\-./]+$/.test(s) && !s.includes("..//")) return s.startsWith("/assets/") ? s.slice(1) : s;
  return "";
}

// ---- أرقام وعملة ----
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
export function arDigits(v) {
  return String(v).replace(/\d/g, (d) => AR_DIGITS[d]);
}
// المبالغ بنخزنها أرقام عادية بالشيكل (ممكن فيها نص شيكل: 12.5)
export function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}
export function money(n) {
  const v = round2(n);
  const s = Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0$/, "");
  return arDigits(s) + " ₪";
}

// ---- الجوال والواتساب ----
// بيحوّل 059xxxxxxx أو +970 59... لصيغة دولية أرقام بس: 97059xxxxxxx
export function normalizePhone(raw, countryCode = "970") {
  let d = String(raw ?? "").replace(/[^\d]/g, "");
  if (!d) return "";
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0")) d = countryCode + d.slice(1);
  return d;
}
// رابط واتساب برسالة جاهزة
export function waLink(phone, text, countryCode = "970") {
  const p = normalizePhone(phone, countryCode);
  const q = text ? "?text=" + encodeURIComponent(text) : "";
  return "https://wa.me/" + p + q;
}
// تعبئة قالب رسالة: "أهلاً {الاسم}" مع { الاسم: "أم محمد" }
export function fillTemplate(tpl, vars) {
  return String(tpl ?? "").replace(/\{([^{}]+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

// ---- معرفات عشوائية (رابط تتبع الطلب) ----
export function randomId(len = 24) {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const a = new Uint32Array(len);
  crypto.getRandomValues(a);
  let s = "";
  for (let i = 0; i < len; i++) s += chars[a[i] % chars.length];
  return s;
}

// ---- تواريخ ----
// "2026-10-11" بتوقيت الجهاز
export function ymd(d = new Date()) {
  const x = new Date(d);
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return `${x.getFullYear()}-${m}-${day}`;
}
export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const x = new Date(y, m - 1, d);
  x.setDate(x.getDate() + n);
  return ymd(x);
}
const DAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
export function dayName(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return DAYS[new Date(y, m - 1, d).getDay()];
}
// "الأحد ١١ أكتوبر"
export function prettyDate(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  return `${dayName(dateStr)} ${arDigits(d)} ${MONTHS[m - 1]}`;
}

// ---- slug للروابط (بيقبل عربي) ----
export function slugify(s) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^؀-ۿa-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
