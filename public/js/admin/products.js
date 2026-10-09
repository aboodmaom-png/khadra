// المنتجات: إضافة وتعديل، الصور، الأحجام، المخزون والدفعات
import {
  doc, collection, setDoc, updateDoc, deleteDoc, runTransaction, serverTimestamp, writeBatch
} from "../fb.js";
import { adb, S, subscribe } from "./state.js";
import { toast, openSheet, closeSheet, num } from "./ui.js";
import { upload } from "./upload.js";
import { esc, escAttr, money, arDigits, ymd, slugify, prettyDate, safeUrl } from "../util.js";
import { STOCK_UNITS } from "../constants.js";

let el = null;
let term = "", catF = "", lowOnly = false;
const r3 = (n) => Math.round(n * 1000) / 1000;
const thumb = (u) => (u && u.includes("res.cloudinary.com") ? u.replace("/upload/", "/upload/f_auto,q_auto,c_fill,w_160,h_160/") : safeUrl(u));

function availabilityText(p) {
  if (p.madeToOrder) return ["عالطلب", "new"];
  if ((Number(p.stock) || 0) > 0) return ["متوفر", "ok"];
  return p.whenOut === "preorder" ? ["طلب مسبق", "new"] : ["خلص", "red"];
}

export function init(root) {
  el = root;
  subscribe((k) => { if (k === "products" || k === "cats") render(); });
  el.addEventListener("input", (e) => {
    if (e.target.id === "pq") { term = e.target.value.trim(); renderList(); }
  });
  el.addEventListener("change", async (e) => {
    if (e.target.id === "pcat") { catF = e.target.value; renderList(); }
    const vis = e.target.closest("[data-vis]");
    if (vis) {
      try { await updateDoc(doc(adb, "products", vis.dataset.vis), { visible: vis.checked, updatedAt: serverTimestamp() }); toast(vis.checked ? "صار ظاهر بالمتجر" : "انخفى من المتجر"); }
      catch { toast("ما زبطت", true); vis.checked = !vis.checked; }
    }
  });
  el.addEventListener("click", (e) => {
    if (e.target.closest("#pnew")) editProduct(null);
    if (e.target.closest("#plow")) { lowOnly = false; renderList(); }
    const ed = e.target.closest("[data-edit]");
    if (ed) editProduct(S.products.find((p) => p.id === ed.dataset.edit));
    const bt = e.target.closest("[data-batch]");
    if (bt) addBatch(S.products.find((p) => p.id === bt.dataset.batch));
  });
  render();
}

function render() {
  if (!el) return;
  if (!el.querySelector("#plist")) {
    el.innerHTML = `
      <div class="stack" style="margin-bottom:12px">
        <div class="row2">
          <input class="input" id="pq" type="search" placeholder="دوّر على منتج…" aria-label="بحث">
          <select class="input" id="pcat" aria-label="القسم"></select>
        </div>
        <button class="btn" type="button" id="pnew">+ منتج جديد</button>
        <button class="filter-note" type="button" id="plow" hidden>عم تشوف الأصناف اللي قرّبت تخلص بس <b>✕ اعرض الكل</b></button>
      </div>
      <div class="list" id="plist"></div>`;
  }
  const sel = el.querySelector("#pcat");
  sel.innerHTML = `<option value="">كل الأقسام</option>` + S.cats.map((c) => `<option value="${escAttr(c.id)}" ${c.id === catF ? "selected" : ""}>${esc(c.name)}</option>`).join("");
  renderList();
}

export const isLow = (p) => !p.madeToOrder && (Number(p.stock) || 0) <= (Number(p.lowAlert) || 0);

function renderList() {
  const list = S.products.filter((p) => (!catF || p.categoryId === catF) && (!term || (p.name || "").includes(term)) && (!lowOnly || isLow(p)));
  const lf = el.querySelector("#plow");
  if (lf) lf.hidden = !lowOnly;
  const catName = (id) => S.cats.find((c) => c.id === id)?.name || "بدون قسم";
  el.querySelector("#plist").innerHTML = list.map((p) => {
    const [txt, cls] = availabilityText(p);
    const low = !p.madeToOrder && Number(p.lowAlert) > 0 && Number(p.stock) <= Number(p.lowAlert);
    return `<div class="prow">
      <img src="${escAttr(thumb(p.images?.[0]))}" alt="">
      <div class="main">
        <div class="nm">${esc(p.name)} ${p.demo ? `<span class="pill">تجريبي</span>` : ""}</div>
        <div class="hint">${esc(catName(p.categoryId))} · ${(p.sizes || []).map((s) => esc(s.label) + " " + money(s.price)).join(" · ")}</div>
        <div class="pills" style="margin-top:4px"><span class="pill ${cls}">${txt}</span>
          ${p.madeToOrder ? "" : `<span class="pill ${low ? "red" : ""}">المخزون: ${arDigits(r3(Number(p.stock) || 0))} ${esc(STOCK_UNITS[p.unit] || "")}</span>`}
          ${p.lastBatch?.date ? `<span class="pill">آخر تعبئة ${esc(prettyDate(p.lastBatch.date))}</span>` : ""}</div>
      </div>
      <div class="acts">
        <label class="switch" title="ظاهر بالمتجر"><input type="checkbox" data-vis="${escAttr(p.id)}" ${p.visible ? "checked" : ""} aria-label="ظاهر بالمتجر"><span></span></label>
        ${p.madeToOrder ? "" : `<button class="btn ghost sm" type="button" data-batch="${escAttr(p.id)}" title="عبّيت أو جهّزت كمية جديدة؟ زيدها عالمخزون">+ كمية</button>`}
        <button class="btn ghost sm" type="button" data-edit="${escAttr(p.id)}">تعديل</button>
      </div>
    </div>`;
  }).join("") || `<p class="empty">ما في منتجات${term || catF ? " بهالبحث" : ". ضيف أول منتج"}.</p>`;
}

// ---------------- نموذج المنتج ----------------
let f = null;   // نسخة العمل من المنتج

function editProduct(p) {
  f = p ? JSON.parse(JSON.stringify({ ...p, createdAt: null, updatedAt: null })) : {
    id: null, name: "", categoryId: S.cats[0]?.id || "", description: "", images: [], video: "",
    unit: "kg", stock: 0, lowAlert: 0, whenOut: "soldout", prepDays: 0, madeToOrder: false,
    sizes: [{ id: "s1", label: "", price: 0, use: 1 }], pairsWith: [], ingredients: "", storage: "",
    featured: false, order: (S.products.length + 1), visible: true,
  };
  f._origStock = Number(p?.stock) || 0;
  f._delStep = false;
  openSheet(p ? "تعديل: " + p.name : "منتج جديد", "", () => { f = null; });
  renderForm();
}

function renderForm() {
  const b = document.getElementById("sheetBody");
  b.innerHTML = `
    <div class="field"><label for="pf-name">الاسم</label><input class="input" id="pf-name" value="${escAttr(f.name)}"></div>
    <div class="row2">
      <div class="field"><label for="pf-cat">القسم</label><select class="input" id="pf-cat">${S.cats.map((c) => `<option value="${escAttr(c.id)}" ${c.id === f.categoryId ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></div>
      <div class="field"><label for="pf-order">الترتيب</label><input class="input" id="pf-order" type="number" inputmode="numeric" value="${escAttr(f.order)}"></div>
    </div>
    <div class="field"><label for="pf-desc">وصف قصير</label><textarea class="input" id="pf-desc" rows="2">${esc(f.description)}</textarea></div>

    <div class="field"><span class="lbl">الصور (الأولى هي الرئيسية)</span>
      <div class="imgs" id="pf-imgs">
        ${f.images.map((u, i) => `<div class="im"><img src="${escAttr(thumb(u))}" alt="">${i === 0 ? `<span class="first">رئيسية</span>` : `<button type="button" data-first="${i}" aria-label="خليها الرئيسية" style="inset-inline-end:auto;inset-inline-start:4px">★</button>`}<button type="button" data-rmimg="${i}" aria-label="احذف الصورة">✕</button></div>`).join("")}
        <label class="upl">+ صورة<input type="file" accept="image/*" multiple id="pf-up"></label>
      </div>
      <div class="progress" id="pf-prog" hidden><i></i></div>
    </div>
    <div class="field"><span class="lbl">فيديو قصير (اختياري)</span>
      ${f.video ? `<div class="row2"><a class="btn ghost sm" href="${escAttr(f.video)}" target="_blank" rel="noopener">شوف الفيديو</a><button class="btn danger ghost sm" type="button" id="pf-rmvid">احذف الفيديو</button></div>` :
        `<label class="btn ghost sm" style="width:fit-content">+ ارفع فيديو<input type="file" accept="video/*" id="pf-vid" hidden></label>`}
    </div>

    <div class="field sizes-ed"><span class="lbl">الأحجام والأسعار</span>
      <div class="srow hint"><span>الحجم</span><span>السعر ₪</span><span>قبل الخصم</span><span>بيخصم من المخزون</span><span></span></div>
      ${f.sizes.map((s, i) => `<div class="srow">
        <input class="input" data-s="${i}" data-k="label" value="${escAttr(s.label)}" placeholder="مثلاً ٥٠٠ غ" aria-label="الحجم">
        <input class="input" data-s="${i}" data-k="price" type="number" inputmode="decimal" step="0.5" value="${escAttr(s.price)}" aria-label="السعر">
        <input class="input" data-s="${i}" data-k="oldPrice" type="number" inputmode="decimal" step="0.5" value="${escAttr(s.oldPrice || "")}" aria-label="السعر قبل الخصم">
        <input class="input" data-s="${i}" data-k="use" type="number" inputmode="decimal" step="0.05" value="${escAttr(s.use)}" aria-label="بيخصم من المخزون">
        <button class="btn danger ghost sm" type="button" data-rmsize="${i}" aria-label="احذف الحجم" ${f.sizes.length < 2 ? "disabled" : ""}>✕</button></div>`).join("")}
      <button class="btn ghost sm" type="button" id="pf-addsize" style="width:fit-content">+ حجم</button>
      <p class="hint">"قبل الخصم" اختياري: إذا عبّيته بيبين السعر القديم مشطوب. "بيخصم من المخزون" يعني لما ينباع هالحجم قديش بينقص من المخزون، بنفس وحدة المخزون. مثال: المخزون بالكيلو، فمرطبان ٥٠٠ غ بيخصم ٠.٥</p>
    </div>

    <div class="box stack">
      <h3>المخزون</h3>
      <label class="check"><input type="checkbox" id="pf-mto" ${f.madeToOrder ? "checked" : ""}> بيتعمل عالطلب دايماً (ما إله مخزون)</label>
      <p class="hint" style="margin-top:-6px">للأصناف اللي بتنعمل بس لما حدا يطلبها (زي الحلويات). الزبون بيشوفها "طلب مسبق" والموعد بتحدده إنت لما تأكد الطلب.</p>
      <div class="row3" ${f.madeToOrder ? "hidden" : ""}>
        <div class="field"><label for="pf-unit">بشو بتعدّه</label><select class="input" id="pf-unit">${Object.entries(STOCK_UNITS).map(([k, l]) => `<option value="${k}" ${k === f.unit ? "selected" : ""}>${l}</option>`).join("")}</select></div>
        <div class="field"><label for="pf-stock">الكمية الموجودة</label><input class="input" id="pf-stock" type="number" inputmode="decimal" step="0.25" value="${escAttr(f.stock)}"></div>
        <div class="field"><label for="pf-low">نبّهني لما يوصل</label><input class="input" id="pf-low" type="number" inputmode="decimal" step="0.25" value="${escAttr(f.lowAlert)}"></div>
      </div>
      <p class="hint" ${f.madeToOrder ? "hidden" : ""} style="margin-top:-6px">المخزون بينقص لحاله لما تأكد الطلبات، وبيرجع إذا لغيت طلب. لما يوصل لرقم "نبّهني" بيطلعلك تنبيه بالرئيسية.</p>
      <div class="row2">
        <div class="field" ${f.madeToOrder ? "hidden" : ""}><label for="pf-out">لما يخلص</label><select class="input" id="pf-out">
          <option value="soldout" ${f.whenOut === "soldout" ? "selected" : ""}>بيبين خلص</option>
          <option value="preorder" ${f.whenOut === "preorder" ? "selected" : ""}>بيصير طلب مسبق</option></select></div>
        <div class="field"><label for="pf-prep">كم يوم بياخد تحضيره</label><input class="input" id="pf-prep" type="number" inputmode="numeric" min="0" value="${escAttr(f.prepDays)}"></div>
      </div>
    </div>

    <div class="field"><label for="pf-pairs">بيزبط مع (افصل بفاصلة)</label><input class="input" id="pf-pairs" value="${escAttr((f.pairsWith || []).join("، "))}" placeholder="الفلافل، المجدرة"></div>
    <div class="field"><label for="pf-ing">المكونات</label><textarea class="input" id="pf-ing" rows="2">${esc(f.ingredients)}</textarea></div>
    <div class="field"><label for="pf-sto">طريقة الحفظ</label><textarea class="input" id="pf-sto" rows="2">${esc(f.storage)}</textarea></div>
    <label class="check"><input type="checkbox" id="pf-feat" ${f.featured ? "checked" : ""}> بالأكثر طلباً بالرئيسية</label>
    <label class="check"><input type="checkbox" id="pf-vis" ${f.visible ? "checked" : ""}> ظاهر بالمتجر</label>
    <p class="err" id="pf-err" hidden></p>
    <button class="btn block" type="button" id="pf-save">احفظ</button>
    ${f.id ? `<button class="btn danger ghost block" type="button" id="pf-del">${f._delStep ? "أكيد؟ اكبس كمان مرة للحذف النهائي" : "احذف المنتج"}</button>` : ""}`;

  b.oninput = onFormInput;
  b.onchange = onFormChange;
  b.onclick = onFormClick;
}

function readForm() {
  const v = (id) => document.getElementById(id)?.value ?? "";
  f.name = v("pf-name").trim();
  f.categoryId = v("pf-cat");
  f.order = num(v("pf-order"), f.order);
  f.description = v("pf-desc").trim();
  if (document.getElementById("pf-unit")) f.unit = v("pf-unit");
  if (document.getElementById("pf-stock")) f.stock = num(v("pf-stock"), 0);
  if (document.getElementById("pf-low")) f.lowAlert = num(v("pf-low"), 0);
  if (document.getElementById("pf-out")) f.whenOut = v("pf-out");
  f.prepDays = Math.max(0, Math.round(num(v("pf-prep"), 0)));
  f.pairsWith = v("pf-pairs").split(/[,،]/).map((x) => x.trim()).filter(Boolean);
  f.ingredients = v("pf-ing").trim();
  f.storage = v("pf-sto").trim();
  f.featured = document.getElementById("pf-feat").checked;
  f.visible = document.getElementById("pf-vis").checked;
}

function onFormInput(e) {
  const s = e.target.dataset.s;
  if (s !== undefined) {
    const k = e.target.dataset.k;
    f.sizes[s][k] = k === "label" ? e.target.value : num(e.target.value, 0);
  }
}

async function onFormChange(e) {
  if (e.target.id === "pf-mto") { readForm(); f.madeToOrder = e.target.checked; renderForm(); }
  if (e.target.id === "pf-up" && e.target.files.length) { readForm(); await uploadMany([...e.target.files], "img"); }
  if (e.target.id === "pf-vid" && e.target.files.length) { readForm(); await uploadMany([e.target.files[0]], "vid"); }
}

async function uploadMany(files, kind) {
  const prog = document.getElementById("pf-prog");
  prog.hidden = false;
  try {
    for (let i = 0; i < files.length; i++) {
      const url = await upload(files[i], (p) => (prog.firstElementChild.style.width = Math.round(((i + p) / files.length) * 100) + "%"));
      if (kind === "img") f.images.push(url); else f.video = url;
    }
    toast(kind === "img" ? "ارتفعت الصور" : "ارتفع الفيديو");
  } catch (err) {
    console.error(err);
    toast(err.message === "cloudinary-not-configured" ? "إعدادات Cloudinary ناقصة" : "ما ارتفع الملف، جرّب كمان مرة", true);
  }
  renderForm();
}

async function onFormClick(e) {
  const t = e.target;
  if (t.id === "pf-addsize") { readForm(); f.sizes.push({ id: "s" + Date.now().toString(36), label: "", price: 0, use: 1 }); renderForm(); return; }
  if (t.dataset.rmsize !== undefined) { readForm(); f.sizes.splice(Number(t.dataset.rmsize), 1); renderForm(); return; }
  if (t.dataset.rmimg !== undefined) { readForm(); f.images.splice(Number(t.dataset.rmimg), 1); renderForm(); return; }
  if (t.dataset.first !== undefined) { readForm(); const [x] = f.images.splice(Number(t.dataset.first), 1); f.images.unshift(x); renderForm(); return; }
  if (t.id === "pf-rmvid") { readForm(); f.video = ""; renderForm(); return; }
  if (t.id === "pf-save") { readForm(); await save(t); return; }
  if (t.id === "pf-del") {
    if (!f._delStep) { readForm(); f._delStep = true; renderForm(); return; }
    try { await deleteDoc(doc(adb, "products", f.id)); toast("انحذف المنتج"); closeSheet(); }
    catch { toast("ما انحذف", true); }
  }
}

async function save(btn) {
  const err = document.getElementById("pf-err");
  const sizes = f.sizes.map((s) => ({
    id: s.id || "s" + Math.random().toString(36).slice(2, 7),
    label: String(s.label || "").trim(),
    price: Number(s.price) || 0,
    ...(Number(s.oldPrice) > 0 ? { oldPrice: Number(s.oldPrice) } : {}),
    use: Number(s.use) > 0 ? Number(s.use) : 1,
  }));
  const problem = !f.name ? "اكتب اسم المنتج"
    : !f.categoryId ? "اختار القسم (ضيف قسم من الأقسام والمناطق)"
    : sizes.some((s) => !s.label || s.price <= 0) ? "كل حجم بدّه اسم وسعر"
    : !f.images.length ? "ضيف صورة وحدة على الأقل" : "";
  if (problem) { err.hidden = false; err.textContent = problem; return; }
  err.hidden = true;
  btn.disabled = true;

  const data = {
    name: f.name, slug: slugify(f.name), categoryId: f.categoryId, description: f.description,
    images: f.images, video: f.video || "", unit: f.unit, lowAlert: Number(f.lowAlert) || 0,
    whenOut: f.whenOut, prepDays: Number(f.prepDays) || 0, madeToOrder: !!f.madeToOrder, sizes,
    pairsWith: f.pairsWith, ingredients: f.ingredients, storage: f.storage,
    featured: !!f.featured, order: Number(f.order) || 0, visible: !!f.visible, updatedAt: serverTimestamp(),
  };
  const newStock = r3(Number(f.stock) || 0);
  try {
    if (!f.id) {
      const ref = doc(collection(adb, "products"));
      const b = writeBatch(adb);
      b.set(ref, { ...data, stock: newStock, lastBatch: null, createdAt: serverTimestamp() });
      if (newStock) b.set(doc(collection(adb, "stockLog")), { productId: ref.id, productName: f.name, delta: newStock, reason: "manual", note: "كمية البداية", after: newStock, at: serverTimestamp(), by: S.user?.email || "" });
      await b.commit();
    } else {
      const b = writeBatch(adb);
      const delta = r3(newStock - f._origStock);
      b.update(doc(adb, "products", f.id), { ...data, ...(delta ? { stock: newStock } : {}) });
      if (delta) b.set(doc(collection(adb, "stockLog")), { productId: f.id, productName: f.name, delta, reason: "manual", note: "تعديل من نموذج المنتج", after: newStock, at: serverTimestamp(), by: S.user?.email || "" });
      await b.commit();
    }
    toast("انحفظ");
    closeSheet();
  } catch (e) {
    console.error(e);
    btn.disabled = false;
    err.hidden = false; err.textContent = navigator.onLine ? "ما انحفظ، جرّب كمان مرة" : "انحفظ على الجهاز، وبيترفع لما يرجع النت";
  }
}

// ---------------- دفعة جديدة ----------------
function addBatch(p) {
  if (!p) return;
  const unit = STOCK_UNITS[p.unit] || "";
  const b = openSheet("كمية جديدة: " + p.name, `
    <p class="note" style="margin:0">عبّيت أو جهّزت كمية جديدة من هالصنف؟ اكتبها هون: بتنزاد عالمخزون، وبيبين للزبون بصفحة المنتج "عُبّي بتاريخ…" فبيعرف إنه طازة.</p>
    <p class="hint">الموجود هلأ: ${arDigits(r3(Number(p.stock) || 0))} ${esc(unit)}</p>
    <div class="row2">
      <div class="field"><label for="bq">الكمية (${esc(unit)})</label><input class="input" id="bq" type="number" inputmode="decimal" step="0.25" min="0"></div>
      <div class="field"><label for="bd">تاريخ التعبئة</label><input class="input" id="bd" type="date" value="${ymd()}"></div>
    </div>
    <div class="field"><label for="bn">ملاحظة (اختياري)</label><input class="input" id="bn"></div>
    <p class="err" id="berr" hidden></p>
    <button class="btn block" type="button" id="bsave">زيد عالمخزون</button>`);
  b.onclick = async (e) => {
    if (e.target.id !== "bsave") return;
    const qty = r3(num(document.getElementById("bq").value, 0));
    const date = document.getElementById("bd").value || ymd();
    const note = document.getElementById("bn").value.trim().slice(0, 200);
    if (qty <= 0) { const er = document.getElementById("berr"); er.hidden = false; er.textContent = "اكتب الكمية"; return; }
    e.target.disabled = true;
    try {
      const pRef = doc(adb, "products", p.id);
      await runTransaction(adb, async (tx) => {
        const s = await tx.get(pRef);
        const after = r3((Number(s.data()?.stock) || 0) + qty);
        const bRef = doc(collection(adb, "batches"));
        tx.update(pRef, { stock: after, lastBatch: { id: bRef.id, date, qty }, updatedAt: serverTimestamp() });
        tx.set(bRef, { productId: p.id, productName: p.name, qty, date, note, createdAt: serverTimestamp(), by: S.user?.email || "" });
        tx.set(doc(collection(adb, "stockLog")), { productId: p.id, productName: p.name, delta: qty, reason: "batch", batchId: bRef.id, after, note, at: serverTimestamp(), by: S.user?.email || "" });
      });
      toast("انزادت الكمية عالمخزون");
      closeSheet();
    } catch (err) {
      console.error(err);
      e.target.disabled = false;
      toast(navigator.onLine ? "ما انزادت، جرّب كمان مرة" : "هاي العملية بدها نت", true);
    }
  };
}

// #products/new بيفتح منتج جديد، #products/low بيعرض اللي قرّب يخلص
export function show(param) {
  lowOnly = param === "low";
  render();
  if (param === "new") editProduct(null);
}
