// مشترك بين صفحات المتجر: الهيدر والفوتر، السلة، الإعدادات، حالة المنتج، روابط الصور
//
// القاعدة: الصفحة ما بتستنى النت عشان تبين. الهيدر والفوتر بيطلعوا فوراً،
// والبيانات (الإعدادات، الأقسام، المنتجات، المناطق) بتنعرض من آخر نسخة محفوظة على الجهاز،
// وبنفس اللحظة بنجيب الجديد من Firestore وبنحدّث الصفحة لما يوصل.
import { db, doc, getDoc, collection, query, where, orderBy, getDocs } from "../fb.js";
import { esc, escAttr, safeUrl, money, arDigits, waLink } from "../util.js";
import "../fancy-select.js";

export const store = db();

// ---------------- أيقونات ----------------
const I = (p, extra = "") => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${p}</svg>`;
export const ICON = {
  home: I('<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>'),
  shop: I('<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>'),
  bag: I('<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>'),
  truck: I('<path d="M3 6h11v10H3z"/><path d="M14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>'),
  plus: I('<path d="M12 5v14M5 12h14"/>', 'width="20" height="20" stroke-width="2.2"'),
  minus: I('<path d="M5 12h14"/>', 'width="20" height="20" stroke-width="2.2"'),
  back: I('<path d="M5 12h14M13 6l6 6-6 6"/>', 'width="22" height="22"'),
  trash: I('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>', 'width="20" height="20"'),
  wa: I('<path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5"/>', 'width="20" height="20"'),
  ig: I('<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".8" fill="currentColor"/>', 'width="20" height="20"'),
  play: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>',
  cash: I('<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6 9.5v5M18 9.5v5"/>', 'width="24" height="24"'),
  bank: I('<path d="M3 9.5 12 4l9 5.5"/><path d="M5 10v7M9.5 10v7M14.5 10v7M19 10v7"/><path d="M3 20h18"/>', 'width="24" height="24"'),
  check: I('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 'width="28" height="28" stroke-width="2.4"'),
};

export const INSTAGRAM_URL = "https://www.instagram.com/khadra_brand25.4/";

// ---------------- النسخة المحفوظة على الجهاز ----------------
const CK = "khadra_c1:";
function cacheGet(k) { try { const v = localStorage.getItem(CK + k); return v ? JSON.parse(v) : null; } catch { return null; } }
function cacheSet(k, v) { try { localStorage.setItem(CK + k, JSON.stringify(v)); } catch {} }
const plain = (v) => JSON.parse(JSON.stringify(v));   // نفس الشكل سواء جاي من النت أو من النسخة المحفوظة

// أي طلب للنت إله مهلة، عشان الصفحة ما تضل معلّقة إذا النت ضعيف
export function withTimeout(p, ms = 15000) {
  let t;
  return Promise.race([p, new Promise((_, rej) => { t = setTimeout(() => rej(new Error("timeout")), ms); })]).finally(() => clearTimeout(t));
}

// إذا Firestore ما وصل للسيرفر بيرجّع نتيجة فاضية من الذاكرة، وهاي ما لازم تمسح النسخة المحفوظة
function fromServer(snap) {
  if (snap?.metadata?.fromCache) throw new Error("offline");
  return snap;
}

/**
 * بيرجّع { cached, fresh }:
 * cached = آخر نسخة محفوظة (أو null)، بتنعرض فوراً.
 * fresh  = Promise بالبيانات الجديدة من النت (وبتنحفظ للمرة الجاية).
 */
function swr(key, fetcher, ms) {
  const cached = cacheGet(key);
  const fresh = withTimeout(fetcher(), ms).then((v) => { const pv = plain(v); cacheSet(key, pv); return pv; });
  fresh.catch(() => {});
  return { cached, fresh };
}

const asList = (snap) => fromServer(snap).docs.map((d) => ({ id: d.id, ...d.data() }));

// الأقسام والمنتجات الظاهرة (طلب واحد لكل الصفحات)
let _catalog = null;
export function loadCatalog() {
  if (!_catalog) {
    _catalog = swr("catalog", async () => {
      const [cs, ps] = await Promise.all([
        getDocs(query(collection(store, "categories"), where("visible", "==", true), orderBy("order"))),
        getDocs(query(collection(store, "products"), where("visible", "==", true), orderBy("order"))),
      ]);
      return { cats: asList(cs), products: asList(ps) };
    });
  }
  return _catalog;
}

export function loadAreas() {
  return swr("areas", async () =>
    asList(await getDocs(query(collection(store, "areas"), where("active", "==", true), orderBy("order")))));
}

export function loadStory() {
  return swr("story", async () => {
    const s = fromServer(await getDoc(doc(store, "media", "story")));
    return s.exists() ? s.data() : {};
  });
}

// ---------------- الإعدادات ----------------
let _settings = cacheGet("settings") || {};
const _settingsListeners = [];
const _settingsFresh = withTimeout(getDoc(doc(store, "settings", "main")))
  .then((s) => {
    fromServer(s);
    _settings = s.exists() ? plain(s.data()) : {};
    cacheSet("settings", _settings);
    _settingsListeners.forEach((fn) => fn(_settings));
    return _settings;
  })
  .catch((e) => { console.warn("settings", e); return _settings; });

/** الإعدادات الحالية فوراً (آخر نسخة معروفة) */
export const settingsNow = () => _settings;
/** بتنادي fn هلأ بالنسخة الحالية، وكمان لما توصل الجديدة من النت */
export function onSettings(fn) { _settingsListeners.push(fn); fn(_settings); }
/** بتستنى الجديدة من النت (أو المحفوظة إذا النت مش زابط) */
export const loadSettings = () => _settingsFresh;

// ---------------- صور Cloudinary بحجم مناسب ----------------
// إذا الرابط من Cloudinary بنطلب نسخة مضغوطة على قد العرض المطلوب. غير هيك بيرجع زي ما هو
export function cld(url, w = 600) {
  const u = safeUrl(url);
  if (!u) return "";
  if (u.includes("res.cloudinary.com") && u.includes("/upload/") && !u.includes("/upload/f_auto")) {
    return u.replace("/upload/", `/upload/f_auto,q_auto,c_limit,w_${w}/`);
  }
  return u;
}

// ---------------- حالة المنتج ----------------
// in = متوفر، preorder = طلب مسبق (بيتعمل خلال days)، out = خلص
export function availability(p, size, qty = 1) {
  const need = (Number(size?.use) || 1) * qty;
  if (p.madeToOrder) return { state: "preorder", days: Number(p.prepDays) || 0 };
  if ((Number(p.stock) || 0) >= need) return { state: "in" };
  if (p.whenOut === "preorder") return { state: "preorder", days: Number(p.prepDays) || 0 };
  return { state: "out" };
}
export function availabilityLabel(a) {
  if (a.state === "in") return { text: "متوفر", cls: "b-in" };
  if (a.state === "preorder") return { text: a.days ? `طلب مسبق · ${arDigits(a.days)} أيام` : "طلب مسبق", cls: "b-pre" };
  return { text: "خلص", cls: "b-out" };
}
export function minPrice(p) {
  const prices = (p.sizes || []).map((s) => Number(s.price) || 0).filter((x) => x > 0);
  return prices.length ? Math.min(...prices) : 0;
}

// كرت منتج
export function productCard(p) {
  const sizes = p.sizes || [];
  const a = availability(p, sizes[0]);
  const lab = availabilityLabel(a);
  const img = cld((p.images || [])[0], 520);
  const many = sizes.length > 1;
  return `<a class="card ${a.state === "out" ? "is-out" : ""}" href="product.html?id=${encodeURIComponent(p.id)}">
    <div class="ph">${img ? `<img src="${escAttr(img)}" alt="${escAttr(p.name)}" loading="lazy">` : ""}
      ${a.state !== "in" || p.lastBatch ? `<span class="badge ${lab.cls}">${esc(a.state === "in" ? "طازة" : lab.text)}</span>` : ""}</div>
    <div class="bd">
      <span class="nm">${esc(p.name)}</span>
      <span class="mt">${esc(sizes.map((s) => s.label).join(" · "))}</span>
      <div class="rw"><span class="price">${many ? "<small>من</small> " : ""}${money(minPrice(p))}</span><span class="go" aria-hidden="true">${ICON.plus}</span></div>
    </div>
  </a>`;
}

// ---------------- السلة (على جهاز الزبون) ----------------
const CART_KEY = "khadra_cart_v1";
function readCart() {
  try { return JSON.parse(localStorage.getItem(CART_KEY) || "[]"); } catch { return []; }
}
function writeCart(items) {
  try { localStorage.setItem(CART_KEY, JSON.stringify(items)); } catch {}
  document.dispatchEvent(new CustomEvent("cart:change"));
}
export const cart = {
  items: readCart,
  count: () => readCart().reduce((n, i) => n + (Number(i.qty) || 0), 0),
  add(item) {
    const items = readCart();
    const key = item.productId + "|" + item.sizeId;
    const found = items.find((i) => i.key === key);
    if (found) found.qty = Math.min(50, found.qty + item.qty);
    else items.push({ ...item, key });
    writeCart(items);
  },
  setQty(key, qty) {
    const items = readCart().map((i) => (i.key === key ? { ...i, qty: Math.max(1, Math.min(50, qty)) } : i));
    writeCart(items);
  },
  remove(key) { writeCart(readCart().filter((i) => i.key !== key)); },
  clear() { writeCart([]); },
};

// آخر طلبات الزبون على هالجهاز (لزر "طلبي")
const ORDERS_KEY = "khadra_my_orders";
export const myOrders = {
  list() { try { return JSON.parse(localStorage.getItem(ORDERS_KEY) || "[]"); } catch { return []; } },
  add(o) {
    const l = myOrders.list().filter((x) => x.trackId !== o.trackId);
    l.unshift(o);
    try { localStorage.setItem(ORDERS_KEY, JSON.stringify(l.slice(0, 10))); } catch {}
  },
};

// ---------------- الهيدر والفوتر ----------------
// بيترسموا فوراً بدون ما نستنى النت. الأشياء اللي من الإعدادات (شريط الإعلان، المتجر مسكّر، الواتساب)
// بتتحدث لحالها لما توصل الإعدادات.
export function renderChrome(active) {
  const top = document.getElementById("chrome-top");
  const bottom = document.getElementById("chrome-bottom");
  const last = myOrders.list()[0];
  const trackHref = last ? `track.html?t=${encodeURIComponent(last.trackId)}` : "track.html";
  const cur = (k) => (k === active ? 'aria-current="page"' : "");
  const n = cart.count();

  // بنبدّل العنصر المؤقت بالهيدر نفسه، عشان الهيدر يكون ابن مباشر للـ body ويضل ثابت فوق وإحنا نازلين
  if (top) {
    top.outerHTML = `
      <div id="bars"></div>
      <header class="topbar"><div class="wrap"><div class="inner">
        <a class="logo" href="index.html" aria-label="خضرة براند، الرئيسية"><img src="assets/brand/wordmark.png" alt="خضرة براند" width="240" height="106"></a>
        <nav class="topnav" aria-label="القائمة">
          <a href="index.html" ${cur("home")}>الرئيسية</a>
          <a href="shop.html" ${cur("shop")}>المتجر</a>
          <a href="${trackHref}" ${cur("track")}>تتبع طلبي</a>
        </nav>
        <div class="top-actions">
          <a class="icon-btn" id="topContact" href="${INSTAGRAM_URL}" target="_blank" rel="noopener" aria-label="انستغرام خضرة">${ICON.ig}</a>
          <a class="cart-btn" href="cart.html" aria-label="السلة">${ICON.bag}<span class="lbl">السلة</span><span class="count" data-cart-count ${n ? "" : "hidden"}>${arDigits(n)}</span></a>
        </div>
      </div></div></header>`;
  }
  if (bottom) {
    bottom.outerHTML = `
      <nav class="bottomnav" aria-label="التنقل">
        <a href="index.html" ${cur("home")}>${ICON.home}<span>الرئيسية</span></a>
        <a href="shop.html" ${cur("shop")}>${ICON.shop}<span>المتجر</span></a>
        <a href="cart.html" ${cur("cart")}>${ICON.bag}<span>السلة</span><span class="count" data-cart-count ${n ? "" : "hidden"}>${arDigits(n)}</span></a>
        <a href="${trackHref}" ${cur("track")}>${ICON.truck}<span>طلبي</span></a>
      </nav>
      <footer class="footer"><div class="wrap">
        <div class="cols">
          <div class="brand">
            <img src="assets/brand/logo.png" alt="خضرة براند" loading="lazy" width="112" height="112">
            <p class="muted" style="margin:0">خضرة براند، عالم من النكهات الطبيعية والابتكارات المميزة، من غزة.</p>
          </div>
          <nav aria-label="روابط"><b>المتجر</b><a href="shop.html">كل المنتجات</a><a href="cart.html">السلة</a><a href="${trackHref}">تتبع طلبي</a></nav>
          <div class="contact"><b>تواصل معنا</b>
            <span id="footWa"></span>
            <a class="ig-link" href="${INSTAGRAM_URL}" target="_blank" rel="noopener">${ICON.ig}<span dir="ltr">@khadra_brand25.4</span></a>
          </div>
        </div>
        <div class="copy">© خضرة براند · غزة</div>
      </div></footer>
      <div class="toast" id="toast" role="status" aria-live="polite"></div>`;
    document.body.classList.add("has-bottomnav");
  }

  onSettings((s) => {
    const bars = document.getElementById("bars");
    if (bars) bars.innerHTML =
      (s.storeOpen === false ? `<div class="closed-bar">${esc(s.closedMessage || "المتجر مسكّر هالفترة")}</div>` : "") +
      (s.announcement?.active && s.announcement?.text ? `<div class="announce">${esc(s.announcement.text)}</div>` : "");
    const wa = s.whatsapp ? waLink(s.whatsapp, "", s.countryCode || "970") : "";
    const foot = document.getElementById("footWa");
    if (foot) foot.innerHTML = wa ? `<a class="btn wa" href="${escAttr(wa)}" target="_blank" rel="noopener">${ICON.wa} اسألنا عالواتساب</a>` : "";
    const tc = document.getElementById("topContact");
    if (tc && wa) { tc.href = wa; tc.innerHTML = ICON.wa; tc.setAttribute("aria-label", "واتساب خضرة"); }
  });

  const upd = () => {
    const c = cart.count();
    document.querySelectorAll("[data-cart-count]").forEach((el) => { el.textContent = arDigits(c); el.hidden = !c; });
  };
  document.addEventListener("cart:change", upd);
  addEventListener("storage", upd);
}

export function toast(msg) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), 2200);
}

// رسالة لما ما في نت ولا في نسخة محفوظة
export function netError(retry = true) {
  return `<div class="empty" style="grid-column:1/-1"><p>ما قدرنا نحمّل البيانات، النت ضعيف أو مقطوع.</p>${retry ? `<button class="btn ghost" type="button" onclick="location.reload()">جرّب كمان مرة</button>` : ""}</div>`;
}
