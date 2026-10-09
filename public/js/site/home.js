import { esc, escAttr } from "../util.js";
import { renderChrome, productCard, cld, loadCatalog, loadStory, onSettings, netError } from "./common.js";
import { PAY_METHODS } from "../constants.js";

renderChrome("home");

// ---------------- المشاهد: أي قسم بنص الشاشة، مشهده بيظهر ----------------
const scenes = [...document.querySelectorAll(".scene")];
const sections = [...document.querySelectorAll("[data-scene]")];
const copies = [...document.querySelectorAll("[data-scene] .copy")];
const mobile = matchMedia("(max-width: 899px)");
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
let active = 1;
let ticking = false;

function onScroll() {
  ticking = false;
  const vh = innerHeight;
  // آخر قسم مشهد بلّش يطلع لفوق نص الشاشة هو المشهد الحالي (الألواح بينهم بتحافظ على المشهد اللي قبلها)
  let cur = 1, curSec = sections[0];
  for (const s of sections) {
    if (s.getBoundingClientRect().top < vh * (mobile.matches ? 0.72 : 0.55)) { cur = Number(s.dataset.scene); curSec = s; }
  }
  if (cur !== active) {
    scenes.forEach((el) => el.classList.toggle("on", Number(el.dataset.s) === cur));
    active = cur;
  }
  // زوم خفيف على المشهد الحالي حسب قديش نزلنا فيه
  if (!reduced) {
    const r = curSec.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (vh - r.top) / (r.height + vh)));
    const img = scenes[cur - 1]?.querySelector("img");
    if (img) img.style.transform = `scale(${(1 + p * 0.07).toFixed(4)})`;
  }
  // عالموبايل الكلام بيضل تحت (بالمساحة الفاضية من الصورة)، ولما يطلع لفوق باتجاه الصورة بيختفي بهدوء
  for (const c of copies) {
    if (!mobile.matches) { c.style.opacity = ""; continue; }
    const r = c.getBoundingClientRect();
    const o = Math.min(1, Math.max(0, (r.bottom - vh * 0.55) / (vh * 0.28)));
    c.style.opacity = o.toFixed(3);
  }
}
addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
addEventListener("resize", onScroll);
onScroll();

// ---------------- ذرات ضو طايرة (خفيفة، وبتوقف لما الصفحة مش ظاهرة) ----------------
const cv = document.getElementById("motes");
const ctx = cv.getContext("2d");
let dots = [];
function sizeMotes() {
  const dpr = Math.min(2, devicePixelRatio || 1);
  cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const n = innerWidth < 600 ? 22 : 40;
  dots = Array.from({ length: n }, () => ({
    x: innerWidth * (0.1 + Math.random() * 0.85), y: Math.random() * innerHeight * 0.8,
    r: 0.8 + Math.random() * 2, s: 0.08 + Math.random() * 0.2, a: 0.25 + Math.random() * 0.45, p: Math.random() * 6.28,
  }));
}
function tick(t) {
  if (!document.hidden) {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const d of dots) {
      d.y -= d.s; d.x += Math.sin(t / 2400 + d.p) * 0.12;
      if (d.y < -10) { d.y = innerHeight * 0.85; d.x = innerWidth * (0.1 + Math.random() * 0.85); }
      ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, 6.283);
      ctx.fillStyle = `rgba(255, 248, 232, ${(d.a * (0.6 + 0.4 * Math.sin(t / 900 + d.p))).toFixed(3)})`;
      ctx.fill();
    }
  }
  requestAnimationFrame(tick);
}
if (!reduced) { sizeMotes(); addEventListener("resize", sizeMotes); requestAnimationFrame(tick); }

// ---------------- نصوص المشاهد (بتتعدّل من لوحة التحكم) ----------------
function applyStory(st) {
  (st?.scenes || []).forEach((sc, i) => {
    const n = i + 1;
    const line = document.querySelector(`[data-line="${n}"]`);
    const tag = document.querySelector(`[data-tag="${n}"]`);
    if (line && sc.line) line.textContent = sc.line;
    if (tag && sc.tag) tag.textContent = sc.tag;
  });
}
const story = loadStory();
if (story.cached) applyStory(story.cached);
story.fresh.then(applyStory).catch(() => {});

// ---------------- طرق الدفع ----------------
onSettings((settings) => {
  const pm = Object.entries(settings.payMethods || {}).filter(([, on]) => on).map(([k]) => PAY_METHODS[k]?.label).filter(Boolean);
  document.getElementById("payLine").textContent = pm.length ? "الدفع: " + pm.join(" أو ") : "";
});

// ---------------- الأقسام والأكثر طلباً ----------------
function applyCatalog({ cats = [], products = [] }) {
  document.getElementById("cats").innerHTML = cats.map((c) =>
    `<a class="cat" href="shop.html?cat=${encodeURIComponent(c.id)}"><img src="${escAttr(cld(c.image, 240))}" alt="" loading="lazy"><span>${esc(c.name)}</span></a>`
  ).join("") || `<p class="muted">الأقسام بتنضاف قريب.</p>`;

  let feat = products.filter((p) => p.featured);
  if (feat.length < 4) feat = feat.concat(products.filter((p) => !p.featured)).slice(0, 4);
  document.getElementById("featured").innerHTML = feat.slice(0, 8).map(productCard).join("") ||
    `<p class="muted">المنتجات بتنضاف قريب.</p>`;
}
const catalog = loadCatalog();
if (catalog.cached) applyCatalog(catalog.cached);
catalog.fresh.then(applyCatalog).catch((e) => {
  console.warn(e);
  if (!catalog.cached) { document.getElementById("featured").innerHTML = netError(); document.getElementById("cats").innerHTML = ""; }
});
