import { db, doc, getDoc, setDoc, writeBatch, collection, query, where, getDocs, serverTimestamp } from "../js/fb.js";
import { auth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "../js/fb-auth.js";
import { esc, slugify } from "../js/util.js";
import { SETTINGS, STORY, CATEGORIES, AREAS, PRODUCTS, BOXES } from "./seed-data.js";

const $ = (s) => document.querySelector(s);
const store = db();

function log(msg, ok = true) {
  const li = document.createElement("li");
  li.className = ok ? "ok" : "err";
  li.innerHTML = esc(msg);
  $("#log").prepend(li);
}
function busy(on) {
  document.querySelectorAll("button").forEach((b) => (b.disabled = on));
}

// ---- الدخول ----
$("#loginBox").addEventListener("submit", async (e) => {
  e.preventDefault();
  busy(true);
  try {
    await signInWithEmailAndPassword(auth, $("#email").value.trim(), $("#pass").value);
  } catch (err) {
    log("فشل الدخول: " + err.code, false);
  } finally {
    busy(false);
  }
});
$("#logout").addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
  $("#loginBox").hidden = !!user;
  $("#panel").hidden = true;
  if (!user) return;
  const adm = await getDoc(doc(store, "admins", user.uid)).catch(() => null);
  if (!adm || !adm.exists()) {
    log(`الحساب ${user.email} مش أدمن. ضيف مستند بـ admins اسمه ${user.uid}`, false);
    $("#loginBox").hidden = false;
    return;
  }
  $("#who").textContent = user.email;
  $("#panel").hidden = false;
  refreshStatus();
});

async function refreshStatus() {
  const s = await getDoc(doc(store, "settings", "main"));
  const c = await getDoc(doc(store, "counters", "orders"));
  const demo = await getDocs(query(collection(store, "products"), where("demo", "==", true)));
  $("#status").innerHTML = `
    <li>الإعدادات: ${s.exists() ? "موجودة ✓" : "مش موجودة"}</li>
    <li>عدّاد الطلبات: ${c.exists() ? "موجود، الرقم الجاي " + esc(c.data().next) : "مش موجود"}</li>
    <li>منتجات تجريبية: ${demo.size}</li>`;
}

// ---- ١. الأساس: الإعدادات + العدّاد + نصوص القصة (ما بيكتب فوق الموجود) ----
$("#seedBase").addEventListener("click", async () => {
  busy(true);
  try {
    const sRef = doc(store, "settings", "main");
    const cRef = doc(store, "counters", "orders");
    const mRef = doc(store, "media", "story");
    if (!(await getDoc(sRef)).exists()) {
      await setDoc(sRef, { ...SETTINGS, updatedAt: serverTimestamp() });
      log("انعملت الإعدادات");
    } else log("الإعدادات موجودة، ما لمستها");
    if (!(await getDoc(cRef)).exists()) {
      await setDoc(cRef, { next: 1001 });
      log("انعمل عدّاد الطلبات (أول طلب KH-1001)");
    } else log("العدّاد موجود، ما لمسته");
    if (!(await getDoc(mRef)).exists()) {
      await setDoc(mRef, { ...STORY, updatedAt: serverTimestamp() });
      log("انعملت نصوص القصة");
    } else log("نصوص القصة موجودة، ما لمستها");
  } catch (err) {
    log("خطأ: " + err.code + " " + err.message, false);
  } finally {
    busy(false);
    refreshStatus();
  }
});

// ---- ٢. الأقسام + المنتجات والمناطق والعلبة التجريبية ----
$("#seedDemo").addEventListener("click", async () => {
  busy(true);
  try {
    const b = writeBatch(store);
    const now = serverTimestamp();
    for (const c of CATEGORIES) {
      const { id, ...data } = c;
      b.set(doc(store, "categories", id), { ...data, updatedAt: now }, { merge: true });
    }
    for (const a of AREAS) {
      const { id, ...data } = a;
      b.set(doc(store, "areas", id), { ...data, updatedAt: now });
    }
    for (const p of PRODUCTS) {
      const { id, ...data } = p;
      b.set(doc(store, "products", id), {
        ...data, slug: slugify(data.name), visible: true, lastBatch: null,
        demo: true, createdAt: now, updatedAt: now,
      });
    }
    for (const x of BOXES) {
      const { id, ...data } = x;
      b.set(doc(store, "boxes", id), { ...data, demo: true, updatedAt: now });
    }
    await b.commit();
    log(`انضاف ${CATEGORIES.length} أقسام، ${PRODUCTS.length} منتجات، ${AREAS.length} مناطق، وعلبة تجريبية`);
  } catch (err) {
    log("خطأ: " + err.code + " " + err.message, false);
  } finally {
    busy(false);
    refreshStatus();
  }
});

// ---- ٣. مسح كل إشي تجريبي (demo == true) ----
$("#wipeDemo").addEventListener("click", async () => {
  if (!confirm("أكيد بدك تمسح كل المنتجات والمناطق والعلب التجريبية؟")) return;
  busy(true);
  try {
    let n = 0;
    for (const col of ["products", "areas", "boxes"]) {
      const snap = await getDocs(query(collection(store, col), where("demo", "==", true)));
      const b = writeBatch(store);
      snap.forEach((d) => { b.delete(d.ref); n++; });
      await b.commit();
    }
    log(`انمسح ${n} مستند تجريبي`);
  } catch (err) {
    log("خطأ: " + err.code + " " + err.message, false);
  } finally {
    busy(false);
    refreshStatus();
  }
});
