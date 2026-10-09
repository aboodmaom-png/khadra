// أدوات واجهة مشتركة للوحة التحكم
import { arDigits } from "../util.js";

const I = (p) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
export const ICONS = {
  home: I('<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>'),
  orders: I('<path d="M6 3h12l1 4H5z"/><path d="M5 7h14v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z"/><path d="M9 11h6M9 15h4"/>'),
  products: I('<path d="M7 3h10l-1 4H8z"/><rect x="6" y="7" width="12" height="14" rx="3"/><path d="M9 12h6"/>'),
  catalog: I('<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>'),
  settings: I('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
};

export function toast(msg, bad = false) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.toggle("bad", bad);
  t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), bad ? 4000 : 2400);
}

// نافذة (من تحت عالموبايل، بالنص عاللابتوب)
let onCloseCb = null;
export function openSheet(title, html, onClose) {
  const wrap = document.getElementById("sheet");
  document.getElementById("sheetTitle").textContent = title;
  const body = document.getElementById("sheetBody");
  body.innerHTML = html;
  body.scrollTop = 0;
  wrap.hidden = false;
  document.body.style.overflow = "hidden";
  onCloseCb = onClose || null;
  return body;
}
export function closeSheet() {
  const wrap = document.getElementById("sheet");
  if (wrap.hidden) return;
  wrap.hidden = true;
  document.body.style.overflow = "";
  const cb = onCloseCb; onCloseCb = null;
  if (cb) cb();
}
document.getElementById("sheet").addEventListener("click", (e) => {
  if (e.target.id === "sheet" || e.target.closest("[data-close]")) closeSheet();
});
addEventListener("keydown", (e) => { if (e.key === "Escape") closeSheet(); });

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch {}
    ta.remove();
    return ok;
  }
}

// "قبل ٥ دقايق"
export function timeAgo(ts) {
  const d = ts?.toDate ? ts.toDate() : ts ? new Date(ts) : null;
  if (!d) return "هلأ";
  const s = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (s < 60) return "هلأ";
  if (s < 3600) return `قبل ${arDigits(Math.floor(s / 60))} د`;
  if (s < 86400) return `قبل ${arDigits(Math.floor(s / 3600))} س`;
  return `قبل ${arDigits(Math.floor(s / 86400))} يوم`;
}

// صوت تنبيه قصير لطلب جديد
let actx = null;
export function beep() {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = "sine"; o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.25, actx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + 0.5);
    o.connect(g).connect(actx.destination);
    o.start(); o.stop(actx.currentTime + 0.55);
  } catch {}
}

// رقم من input بأمان
export function num(v, def = 0) {
  const n = parseFloat(String(v ?? "").replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(",", "."));
  return Number.isFinite(n) ? n : def;
}
