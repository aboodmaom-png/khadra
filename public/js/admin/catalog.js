// الأقسام ومناطق التوصيل
import { doc, collection, setDoc, updateDoc, deleteDoc, serverTimestamp } from "../fb.js";
import { adb, S, subscribe } from "./state.js";
import { toast, openSheet, closeSheet, num } from "./ui.js";
import { upload } from "./upload.js";
import { esc, escAttr, money, arDigits, slugify, safeUrl } from "../util.js";

let el = null;
const thumb = (u) => (u && u.includes("res.cloudinary.com") ? u.replace("/upload/", "/upload/f_auto,q_auto,c_fill,w_120,h_120/") : safeUrl(u));

export function init(root) {
  el = root;
  subscribe((k) => { if (["cats", "areas", "products"].includes(k)) render(); });
  el.addEventListener("click", (e) => {
    const t = e.target.closest("button");
    if (!t) return;
    if (t.id === "catNew") editCat(null);
    if (t.dataset.cat) editCat(S.cats.find((c) => c.id === t.dataset.cat));
    if (t.id === "areaNew") editArea(null);
    if (t.dataset.area) editArea(S.areas.find((a) => a.id === t.dataset.area));
  });
  el.addEventListener("change", async (e) => {
    const s = e.target.closest("[data-togglecat],[data-togglearea]");
    if (!s) return;
    const [col, id, field] = s.dataset.togglecat ? ["categories", s.dataset.togglecat, "visible"] : ["areas", s.dataset.togglearea, "active"];
    try { await updateDoc(doc(adb, col, id), { [field]: s.checked, updatedAt: serverTimestamp() }); }
    catch { s.checked = !s.checked; toast("ما زبطت", true); }
  });
  render();
}

function render() {
  if (!el) return;
  const count = (id) => S.products.filter((p) => p.categoryId === id).length;
  el.innerHTML = `
    <div class="group-h" style="margin-top:4px"><span>الأقسام</span><button class="btn sm" type="button" id="catNew">+ قسم</button></div>
    <div class="list">${S.cats.map((c) => `<div class="prow">
      <img src="${escAttr(thumb(c.image))}" alt="">
      <div class="main"><div class="nm">${esc(c.name)}</div><div class="hint">${arDigits(count(c.id))} منتج · الترتيب ${arDigits(c.order ?? 0)}</div></div>
      <div class="acts"><label class="switch" title="ظاهر"><input type="checkbox" data-togglecat="${escAttr(c.id)}" ${c.visible ? "checked" : ""} aria-label="ظاهر بالمتجر"><span></span></label>
      <button class="btn ghost sm" type="button" data-cat="${escAttr(c.id)}">تعديل</button></div></div>`).join("") || `<p class="empty">ما في أقسام.</p>`}</div>

    <div class="group-h" style="margin-top:28px"><span>مناطق التوصيل</span><button class="btn sm" type="button" id="areaNew">+ منطقة</button></div>
    <div class="list">${S.areas.map((a) => `<div class="prow">
      <div class="main"><div class="nm">${esc(a.name)} ${a.demo ? `<span class="pill">تجريبي</span>` : ""}</div><div class="hint">رسوم التوصيل ${money(a.fee)}</div></div>
      <div class="acts"><label class="switch" title="مفعّلة"><input type="checkbox" data-togglearea="${escAttr(a.id)}" ${a.active ? "checked" : ""} aria-label="مفعّلة"><span></span></label>
      <button class="btn ghost sm" type="button" data-area="${escAttr(a.id)}">تعديل</button></div></div>`).join("") || `<p class="empty">ما في مناطق. الزبون ما بيقدر يطلب قبل ما تضيف منطقة.</p>`}</div>`;
}

// ---------------- قسم ----------------
function editCat(c) {
  const st = { image: c?.image || "", del: false };
  const draw = () => {
    const b = document.getElementById("sheetBody");
    const used = c ? S.products.filter((p) => p.categoryId === c.id).length : 0;
    b.innerHTML = `
      <div class="field"><label for="cn">اسم القسم</label><input class="input" id="cn" value="${escAttr(document.getElementById("cn")?.value ?? c?.name ?? "")}"></div>
      <div class="field"><label for="co">الترتيب</label><input class="input" id="co" type="number" inputmode="numeric" value="${escAttr(document.getElementById("co")?.value ?? c?.order ?? S.cats.length + 1)}"></div>
      <div class="field"><span class="lbl">الصورة</span><div class="imgs">
        ${st.image ? `<div class="im"><img src="${escAttr(thumb(st.image))}" alt=""></div>` : ""}
        <label class="upl">${st.image ? "غيّر" : "+ صورة"}<input type="file" accept="image/*" id="cu"></label></div>
        <div class="progress" id="cprog" hidden><i></i></div></div>
      <p class="err" id="cerr" hidden></p>
      <button class="btn block" type="button" id="csave">احفظ</button>
      ${c ? `<button class="btn danger ghost block" type="button" id="cdel" ${used ? "disabled" : ""}>${used ? `ما بينحذف، فيه ${arDigits(used)} منتج` : st.del ? "أكيد؟ اكبس كمان مرة" : "احذف القسم"}</button>` : ""}`;
  };
  const b = openSheet(c ? "تعديل قسم" : "قسم جديد", "");
  draw();
  b.onchange = async (e) => {
    if (e.target.id !== "cu" || !e.target.files[0]) return;
    const prog = document.getElementById("cprog"); prog.hidden = false;
    try { st.image = await upload(e.target.files[0], (p) => (prog.firstElementChild.style.width = Math.round(p * 100) + "%")); draw(); }
    catch { toast("ما ارتفعت الصورة", true); prog.hidden = true; }
  };
  b.onclick = async (e) => {
    if (e.target.id === "csave") {
      const name = document.getElementById("cn").value.trim();
      const order = num(document.getElementById("co").value, 0);
      const err = document.getElementById("cerr");
      if (!name) { err.hidden = false; err.textContent = "اكتب اسم القسم"; return; }
      e.target.disabled = true;
      try {
        const ref = c ? doc(adb, "categories", c.id) : doc(collection(adb, "categories"));
        await setDoc(ref, { name, slug: slugify(name), image: st.image, order, visible: c ? !!c.visible : true, updatedAt: serverTimestamp() }, { merge: true });
        toast("انحفظ"); closeSheet();
      } catch { e.target.disabled = false; toast("ما انحفظ", true); }
    }
    if (e.target.id === "cdel" && c) {
      if (!st.del) { st.del = true; draw(); return; }
      try { await deleteDoc(doc(adb, "categories", c.id)); toast("انحذف"); closeSheet(); } catch { toast("ما انحذف", true); }
    }
  };
}

// ---------------- منطقة ----------------
function editArea(a) {
  let del = false;
  const b = openSheet(a ? "تعديل منطقة" : "منطقة جديدة", `
    <div class="field"><label for="an">اسم المنطقة</label><input class="input" id="an" value="${escAttr(a?.name || "")}" placeholder="مثلاً: الرمال"></div>
    <div class="row2">
      <div class="field"><label for="af">رسوم التوصيل ₪</label><input class="input" id="af" type="number" inputmode="decimal" step="0.5" min="0" value="${escAttr(a?.fee ?? "")}"></div>
      <div class="field"><label for="ao">الترتيب</label><input class="input" id="ao" type="number" inputmode="numeric" value="${escAttr(a?.order ?? S.areas.length + 1)}"></div>
    </div>
    <p class="err" id="aerr" hidden></p>
    <button class="btn block" type="button" id="asave">احفظ</button>
    ${a ? `<button class="btn danger ghost block" type="button" id="adel">احذف المنطقة</button>` : ""}`);
  b.onclick = async (e) => {
    if (e.target.id === "asave") {
      const name = document.getElementById("an").value.trim();
      const fee = num(document.getElementById("af").value, -1);
      const err = document.getElementById("aerr");
      if (!name || fee < 0) { err.hidden = false; err.textContent = "اكتب الاسم والرسوم (صفر إذا مجاني)"; return; }
      e.target.disabled = true;
      try {
        const ref = a ? doc(adb, "areas", a.id) : doc(collection(adb, "areas"));
        await setDoc(ref, { name, fee, order: num(document.getElementById("ao").value, 0), active: a ? !!a.active : true, updatedAt: serverTimestamp() }, { merge: true });
        toast("انحفظ"); closeSheet();
      } catch { e.target.disabled = false; toast("ما انحفظ", true); }
    }
    if (e.target.id === "adel" && a) {
      if (!del) { del = true; e.target.textContent = "أكيد؟ اكبس كمان مرة"; return; }
      try { await deleteDoc(doc(adb, "areas", a.id)); toast("انحذفت"); closeSheet(); } catch { toast("ما انحذفت", true); }
    }
  };
}

export function show() { render(); }
