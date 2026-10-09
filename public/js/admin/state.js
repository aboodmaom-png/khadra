// حالة مشتركة للوحة التحكم: الإعدادات والأقسام والمناطق والمنتجات، بتتحدث لحالها
import { db, doc, onSnapshot, collection, query, orderBy } from "../fb.js";

export const adb = db({ offline: true });

export const S = { user: null, settings: {}, cats: [], areas: [], products: [] };

const subs = new Set();
export function subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }
function emit(k) { subs.forEach((f) => { try { f(k); } catch (e) { console.error(e); } }); }

const rows = (q) => q.docs.map((d) => ({ id: d.id, ...d.data() }));
let started = false;
export function startLive() {
  if (started) return;
  started = true;
  onSnapshot(doc(adb, "settings", "main"), (s) => { S.settings = s.data() || {}; emit("settings"); });
  onSnapshot(query(collection(adb, "categories"), orderBy("order")), (q) => { S.cats = rows(q); emit("cats"); });
  onSnapshot(query(collection(adb, "areas"), orderBy("order")), (q) => { S.areas = rows(q); emit("areas"); });
  onSnapshot(query(collection(adb, "products"), orderBy("order")), (q) => { S.products = rows(q); emit("products"); });
}

export function by(email) {
  return S.user?.email || "admin";
}
