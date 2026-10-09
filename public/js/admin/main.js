import { doc, getDoc, setDoc, serverTimestamp } from "../fb.js";
import { auth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "../fb-auth.js";
import { DEFAULT_SETTINGS, DEFAULT_STORY } from "../constants.js";
import { adb, S, startLive } from "./state.js";
import { ICONS, closeSheet } from "./ui.js";
import "../fancy-select.js";
import * as home from "./home.js";
import * as orders from "./orders.js";
import * as products from "./products.js";
import * as catalog from "./catalog.js";
import * as settings from "./settings.js";

const views = {
  home: { title: "الرئيسية", mod: home },
  orders: { title: "الطلبات", mod: orders },
  products: { title: "المنتجات", mod: products },
  catalog: { title: "الأقسام والمناطق", mod: catalog },
  settings: { title: "الإعدادات", mod: settings },
};
const inited = new Set();

document.querySelectorAll("[data-ic]").forEach((el) => (el.innerHTML = ICONS[el.dataset.ic] || ""));

// ---------------- الدخول ----------------
const $login = document.getElementById("login");
const $app = document.getElementById("app");
const $err = document.getElementById("loginErr");

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  $err.hidden = true;
  const btn = e.target.querySelector("button");
  btn.disabled = true;
  try {
    await signInWithEmailAndPassword(auth, document.getElementById("email").value.trim(), document.getElementById("pass").value);
  } catch (err) {
    $err.hidden = false;
    $err.textContent = ["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found", "auth/invalid-email"].includes(err.code)
      ? "الإيميل أو كلمة السر غلط"
      : "ما قدرنا ندخل، تأكد من النت وجرّب كمان مرة";
  } finally {
    btn.disabled = false;
  }
});
document.getElementById("logout").addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    S.user = null;
    $app.hidden = true;
    $login.hidden = false;
    return;
  }
  let ok = false;
  try { ok = (await getDoc(doc(adb, "admins", user.uid))).exists(); } catch {}
  if (!ok) {
    $err.hidden = false;
    $err.textContent = "هالحساب مش إله صلاحية على لوحة التحكم";
    $login.hidden = false;
    $app.hidden = true;
    await signOut(auth);
    return;
  }
  S.user = user;
  ensureBasics();
  $login.hidden = true;
  $app.hidden = false;
  startLive();
  orders.boot(); // الطلبات الجديدة بتنسمع من أول ما يدخل، حتى لو فاتح قسم ثاني
  route();
});

// الأساسيات اللي المتجر ما بيشتغل بدونها (عدّاد الطلبات والإعدادات ونصوص المشاهد).
// إذا ناقص اشي بنعمله بالقيم الافتراضية، وما بنكتب فوق اشي موجود.
async function ensureBasics() {
  const make = async (path, data) => {
    try {
      const ref = doc(adb, ...path);
      if (!(await getDoc(ref)).exists()) await setDoc(ref, data);
    } catch (e) { console.warn("ensureBasics", path.join("/"), e); }
  };
  await make(["counters", "orders"], { next: 1001 });
  await make(["settings", "main"], { ...DEFAULT_SETTINGS, updatedAt: serverTimestamp() });
  await make(["media", "story"], { ...DEFAULT_STORY, updatedAt: serverTimestamp() });
}

// ---------------- التنقل ----------------
function route() {
  if (!S.user) return;
  const [key, param] = (location.hash || "#home").slice(1).split("/");
  const v = views[key] ? key : "home";
  closeSheet();
  document.querySelectorAll("[data-view]").forEach((s) => (s.hidden = s.dataset.view !== v));
  document.querySelectorAll("[data-nav]").forEach((a) => (a.dataset.nav === v ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
  document.getElementById("viewTitle").textContent = views[v].title;
  const el = document.getElementById("v-" + v);
  if (!inited.has(v)) { inited.add(v); views[v].mod.init(el); }
  views[v].mod.show?.(param);
  scrollTo(0, 0);
}
addEventListener("hashchange", route);

// ---------------- النت ----------------
const $net = document.getElementById("net");
const net = () => ($net.hidden = navigator.onLine);
addEventListener("online", net);
addEventListener("offline", net);
net();

// ---------------- تثبيت كتطبيق ----------------
if ("serviceWorker" in navigator) {
  // النطاق "admin" بس، عشان ما يأثر على صفحات المتجر
  navigator.serviceWorker.register("admin-sw.js", { scope: "./admin" }).catch(() => {});
}
