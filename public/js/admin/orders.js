// الطلبات: جديد ← مؤكد ← طلع للتوصيل ← وصل (أو ملغي)
import {
  collection, query, where, orderBy, limit, onSnapshot, doc, runTransaction, writeBatch,
  serverTimestamp, arrayUnion, increment
} from "../fb.js";
import { adb, S, subscribe } from "./state.js";
import { toast, openSheet, closeSheet, copyText, timeAgo, beep } from "./ui.js";
import { esc, escAttr, money, arDigits, prettyDate, ymd, addDays, waLink, fillTemplate, round2, normalizePhone } from "../util.js";
import { PAY_METHODS, DEFAULT_WA_TEMPLATES } from "../constants.js";

const TABS = [["new", "جديد"], ["confirmed", "مؤكد"], ["out", "طلع للتوصيل"], ["delivered", "وصل"], ["cancelled", "ملغي"]];
const STATUS_LABEL = { new: "جديد", confirmed: "مؤكد", out: "طلع للتوصيل", delivered: "وصل", cancelled: "ملغي" };

let el = null;
let tab = "new";
const lists = { new: [], confirmed: [], out: [], delivered: [], cancelled: [] };
let dayCounts = {};
let selected = new Set();
let lastNew = null;
let histUnsub = null;
let booted = false;

// الرئيسية بتسمع لنفس القوائم (بدون ما نفتح استماع ثاني لنفس الطلبات)
const watchers = new Set();
export function onOrders(fn) { watchers.add(fn); fn(); return () => watchers.delete(fn); }
export const ordersNow = () => ({ lists, dayCounts });
const emitOrders = () => watchers.forEach((f) => { try { f(); } catch (e) { console.error(e); } });

const r3 = (n) => Math.round(n * 1000) / 1000;
const cc = () => S.settings.countryCode || "970";
const history = (status, extra = {}) => arrayUnion({ status, at: new Date(), by: S.user?.email || "admin", ...extra });
const trackUrl = (t) => new URL("track.html?t=" + encodeURIComponent(t), location.href).href;
const tpl = (k) => (S.settings.waTemplates || {})[k] || DEFAULT_WA_TEMPLATES[k] || "";
function waVars(o, extra = {}) {
  return {
    "الاسم": o.customer?.name || "",
    "رقم_الطلب": o.id,
    "الموعد": o.deliveryDate ? prettyDate(o.deliveryDate) + (o.deliverySlot ? " · " + o.deliverySlot : "") : "",
    "المجموع": money(o.total),
    "رابط_التتبع": trackUrl(o.trackId),
    "تفاصيل_التحويل": S.settings.transferInfo || "",
    "السبب": "",
    ...extra,
  };
}
const waTo = (o, key, extra) => waLink(o.customer?.phone, fillTemplate(tpl(key), waVars(o, extra)), cc());

// ---------------- الاستماع للطلبات ----------------
export function boot() {
  if (booted) return;
  booted = true;
  onSnapshot(query(collection(adb, "orders"), where("status", "==", "new"), orderBy("createdAt", "desc"), limit(100)), (q) => {
    lists.new = q.docs.map((d) => ({ id: d.id, ...d.data() }));
    const n = lists.new.length;
    if (lastNew !== null && n > lastNew) { beep(); toast("وصل طلب جديد"); }
    lastNew = n;
    const b = document.getElementById("newCount");
    b.textContent = arDigits(n); b.hidden = !n;
    document.title = (n ? `(${n}) ` : "") + "لوحة خضرة";
    emitOrders();
    if (tab === "new") render();
  }, (e) => console.error(e));
  onSnapshot(query(collection(adb, "orders"), where("status", "in", ["confirmed", "out"])), (q) => {
    const all = q.docs.map((d) => ({ id: d.id, ...d.data() }));
    const sortFn = (a, b) => (a.deliveryDate || "").localeCompare(b.deliveryDate || "") || a.number - b.number;
    lists.confirmed = all.filter((o) => o.status === "confirmed").sort(sortFn);
    lists.out = all.filter((o) => o.status === "out").sort(sortFn);
    dayCounts = {};
    all.forEach((o) => { if (o.deliveryDate) dayCounts[o.deliveryDate] = (dayCounts[o.deliveryDate] || 0) + 1; });
    emitOrders();
    if (tab === "confirmed" || tab === "out") render();
  }, (e) => console.error(e));
}

export function init(root) {
  el = root;
  boot();
  el.addEventListener("click", onClick);
  el.addEventListener("change", onChange);
  subscribe((k) => { if (k === "products" && !document.getElementById("sheet").hidden) refreshSheet(); });
  render();
}

function listenHistory() {
  histUnsub?.();
  histUnsub = null;
  if (tab !== "delivered" && tab !== "cancelled") return;
  histUnsub = onSnapshot(query(collection(adb, "orders"), where("status", "==", tab), orderBy("createdAt", "desc"), limit(60)), (q) => {
    lists[tab] = q.docs.map((d) => ({ id: d.id, ...d.data() }));
    render();
  });
}

// ---------------- القائمة ----------------
function card(o, withCheck) {
  const pills = [];
  if (o.hasPreorder) pills.push(`<span class="pill new">فيه طلب مسبق</span>`);
  if (o.deliveryDate) pills.push(`<span class="pill ok">${esc(prettyDate(o.deliveryDate))}${o.deliverySlot ? " · " + esc(o.deliverySlot) : ""}</span>`);
  if (o.status === "delivered" && o.payStatus !== "paid") pills.push(`<span class="pill red">الدفع لسا</span>`);
  if (o.payMethod === "transfer") pills.push(`<span class="pill blue">بنكي</span>`);
  return `<div class="ocard" data-open="${escAttr(o.id)}" role="button" tabindex="0">
    ${withCheck ? `<input type="checkbox" data-sel="${escAttr(o.id)}" aria-label="حدد ${escAttr(o.id)}" ${selected.has(o.id) ? "checked" : ""}>` : ""}
    <div class="main">
      <div class="l1"><span class="num">${esc(o.id)}</span><span class="money">${money(o.total)}</span></div>
      <div>${esc(o.customer?.name || "")} · ${esc(o.areaName || "")}</div>
      <div class="l2">${esc(timeAgo(o.createdAt))} · ${esc(PAY_METHODS[o.payMethod]?.label || "")} · ${arDigits(o.items?.length || 0)} صنف</div>
      ${pills.length ? `<div class="pills">${pills.join("")}</div>` : ""}
    </div>
  </div>`;
}

function render() {
  if (!el) return;
  const counts = { new: lists.new.length, confirmed: lists.confirmed.length, out: lists.out.length };
  const list = lists[tab] || [];
  let body = "";
  if (!list.length) {
    body = `<p class="empty">${tab === "new" ? "ما في طلبات جديدة هلأ." : "ما في طلبات هون."}</p>`;
  } else if (tab === "confirmed") {
    const groups = {};
    list.forEach((o) => (groups[o.deliveryDate || "بدون موعد"] ||= []).push(o));
    body = Object.entries(groups).map(([d, os]) => `
      <div class="group-h"><span>${d === "بدون موعد" ? d : esc(prettyDate(d))} · ${arDigits(os.length)} طلب</span>
        <button class="btn ghost sm" type="button" data-selday="${escAttr(d)}">حدد الكل</button></div>
      <div class="list">${os.map((o) => card(o, true)).join("")}</div>`).join("");
  } else {
    body = `<div class="list">${list.map((o) => card(o, false)).join("")}</div>`;
  }
  const sel = [...selected].filter((id) => lists.confirmed.some((o) => o.id === id));
  el.innerHTML = `
    <div class="tabs" role="group" aria-label="حالة الطلب">${TABS.map(([k, l]) =>
      `<button class="tab" type="button" data-tab="${k}" aria-pressed="${k === tab}">${l}${counts[k] ? ` <span class="n">${arDigits(counts[k])}</span>` : ""}</button>`).join("")}</div>
    ${body}
    ${tab === "confirmed" && sel.length ? `<div class="bulk"><b>${arDigits(sel.length)} محدد</b>
      <button class="btn sm" type="button" data-bulk="out">طلع للتوصيل</button>
      <button class="btn sm" type="button" data-bulk="copy">نسخ قائمة السائق</button>
      <button class="btn sm" type="button" data-bulk="clear">إلغاء التحديد</button></div>` : ""}`;
}

function onChange(e) {
  const c = e.target.closest("[data-sel]");
  if (!c) return;
  if (c.checked) selected.add(c.dataset.sel); else selected.delete(c.dataset.sel);
  render();
}

async function onClick(e) {
  const t = e.target;
  if (t.matches("input[type=checkbox]")) return;
  const tb = t.closest("[data-tab]");
  if (tb) { tab = tb.dataset.tab; selected.clear(); listenHistory(); render(); return; }
  const sd = t.closest("[data-selday]");
  if (sd) { lists.confirmed.filter((o) => (o.deliveryDate || "بدون موعد") === sd.dataset.selday).forEach((o) => selected.add(o.id)); render(); return; }
  const bk = t.closest("[data-bulk]");
  if (bk) {
    const os = lists.confirmed.filter((o) => selected.has(o.id));
    if (bk.dataset.bulk === "clear") { selected.clear(); render(); }
    if (bk.dataset.bulk === "copy") { (await copyText(driverList(os))) ? toast("انسخت القائمة، الصقها للسائق") : toast("ما قدرنا ننسخ", true); }
    if (bk.dataset.bulk === "out") { await markOut(os); selected.clear(); render(); }
    return;
  }
  const op = t.closest("[data-open]");
  if (op) openOrder(op.dataset.open);
}
// فتح بالكيبورد
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.matches?.(".ocard[data-open]")) openOrder(e.target.dataset.open);
});

function driverList(os) {
  const lines = os.map((o, i) =>
    `${i + 1}) ${o.id} · ${o.customer?.name} · ${o.customer?.phone}\n   ${o.areaName} · ${o.address}\n   ${o.payMethod === "cash" ? `المطلوب كاش: ${o.total} ₪` : "تحويل بنكي (تأكد إنه وصل)"}`);
  const day = os[0]?.deliveryDate ? prettyDate(os[0].deliveryDate) : "";
  return `قائمة التوصيل${day ? " · " + day : ""}\n\n` + lines.join("\n\n");
}

// ---------------- تفاصيل الطلب ----------------
let current = null;       // الطلب المفتوح
let sheetUnsub = null;
const ui = { date: "", slot: "", priceMode: "order", step: "", reason: "", restock: true, done: null };

function openOrder(id) {
  ui.date = ""; ui.slot = ""; ui.priceMode = "order"; ui.step = ""; ui.reason = ""; ui.restock = true; ui.done = null;
  openSheet(id, `<p class="empty">عم نحمّل…</p>`, () => { sheetUnsub?.(); sheetUnsub = null; current = null; });
  sheetUnsub?.();
  sheetUnsub = onSnapshot(doc(adb, "orders", id), (s) => {
    if (!s.exists()) { closeSheet(); return; }
    current = { id: s.id, ...s.data() };
    refreshSheet();
  });
}

function verify(o) {
  const rows = (o.items || []).map((it) => {
    const p = S.products.find((x) => x.id === it.productId);
    const size = p?.sizes?.find((z) => z.id === it.sizeId);
    const now = size ? Number(size.price) : null;
    return { ...it, p, missing: !p || !size, now, changed: now !== null && now !== Number(it.price) };
  });
  const sumOrder = round2(rows.reduce((s, r) => s + Number(r.price) * r.qty, 0));
  const sumNow = round2(rows.reduce((s, r) => s + (r.now ?? Number(r.price)) * r.qty, 0));
  return {
    rows, sumOrder, sumNow,
    changed: rows.some((r) => r.changed), missing: rows.some((r) => r.missing),
    tampered: Math.abs(sumOrder - Number(o.subtotal)) > 0.01 ||
      Math.abs(round2(Number(o.subtotal) + Number(o.deliveryFee) - Number(o.discount || 0)) - Number(o.total)) > 0.01,
  };
}

function suggestedDate(o) {
  const today = ymd();
  return o.hasPreorder ? addDays(today, Math.max(1, Number(o.maxPrepDays) || 1)) : addDays(today, 1);
}

function dayPicker(o) {
  const today = ymd();
  const days = Array.from({ length: 10 }, (_, i) => addDays(today, i));
  if (!ui.date) ui.date = o.deliveryDate || suggestedDate(o);
  const earliest = o.hasPreorder ? addDays(today, Number(o.maxPrepDays) || 0) : today;
  return `
    <div class="days" role="group" aria-label="يوم التوصيل">${days.map((d) => {
      const [, m, dd] = d.split("-");
      return `<button type="button" class="day" data-day="${d}" aria-pressed="${d === ui.date}">
        <small>${esc(prettyDate(d).split(" ")[0])}</small><b>${arDigits(Number(dd))}</b><small>${arDigits(dayCounts[d] || 0)} طلب</small></button>`;
    }).join("")}</div>
    <div class="row2"><div class="field"><label for="dDate">تاريخ ثاني</label><input class="input" type="date" id="dDate" value="${escAttr(ui.date)}" min="${today}"></div>
    ${(S.settings.timeSlots || []).length ? `<div class="field"><span class="lbl">الوقت</span><div class="chips">${S.settings.timeSlots.map((s) =>
      `<button type="button" class="chip" data-slot="${escAttr(s)}" aria-pressed="${s === ui.slot}">${esc(s)}</button>`).join("")}</div></div>` : ""}</div>
    ${ui.date < earliest ? `<p class="warn">الموعد قبل ما تجهز الأصناف اللي بتنعمل عالطلب (بتحتاج ${arDigits(o.maxPrepDays)} أيام).</p>` : ""}
    ${o.preferredSlot ? `<p class="hint">الزبون فضّل: ${esc(o.preferredSlot)}</p>` : ""}`;
}

function refreshSheet() {
  const o = current;
  if (!o) return;
  const body = document.getElementById("sheetBody");
  const v = verify(o);
  const newTotal = round2(v.sumNow + Number(o.deliveryFee) - Number(o.discount || 0));
  const statusPill = { new: "new", confirmed: "ok", out: "blue", delivered: "ok", cancelled: "red" }[o.status];
  const phone = o.customer?.phone || "";

  let actions = "";
  if (ui.done) {
    actions = `<div class="box stack"><h3>${esc(ui.done.title)}</h3>
      ${ui.done.links.map((l) => `<a class="btn ${l.cls || "wa"} block" href="${escAttr(l.href)}" target="_blank" rel="noopener">${esc(l.label)}</a>`).join("")}
      <button class="btn ghost block" type="button" data-act="close">تمام</button></div>`;
  } else if (ui.step === "cancel") {
    actions = `<div class="box stack"><h3>إلغاء الطلب</h3>
      <div class="field"><label for="reason">السبب (بيوصل للزبون برسالة الإلغاء)</label><textarea class="input" id="reason" rows="2">${esc(ui.reason)}</textarea></div>
      ${(o.stockApplied || []).length ? `<label class="check"><input type="checkbox" id="restock" ${ui.restock ? "checked" : ""}> رجّع الكمية للمخزون</label>` : ""}
      <div class="row2"><button class="btn danger" type="button" data-act="doCancel">أكّد الإلغاء</button><button class="btn ghost" type="button" data-act="back">رجوع</button></div></div>`;
  } else if (o.status === "new") {
    actions = `<div class="box stack"><h3>موعد التوصيل</h3>${dayPicker(o)}
      ${v.changed ? `<div class="stack"><span class="lbl">الأسعار تغيّرت من وقت الطلب</span>
        <label class="check"><input type="radio" name="pm" value="order" ${ui.priceMode === "order" ? "checked" : ""}> التزم بسعر الزبون (${money(o.total)})</label>
        <label class="check"><input type="radio" name="pm" value="now" ${ui.priceMode === "now" ? "checked" : ""}> السعر الجديد (${money(newTotal)})، وبلّغ الزبون</label></div>` : ""}
      <button class="btn block" type="button" data-act="confirm" ${v.missing ? "disabled" : ""}>أكّد الطلب</button>
      ${v.missing ? `<p class="err">في صنف انحذف من المتجر. اتصل بالزبون، أو ألغِ الطلب.</p>` : ""}
      <button class="btn danger ghost block" type="button" data-act="cancel">إلغاء الطلب</button></div>`;
  } else if (o.status === "confirmed") {
    actions = `<div class="stack">
      <button class="btn block" type="button" data-act="out">طلع للتوصيل</button>
      <details class="box"><summary class="lbl" style="cursor:pointer">تعديل الموعد</summary><div class="stack" style="margin-top:10px">${dayPicker(o)}
        <button class="btn ghost block" type="button" data-act="reschedule">احفظ الموعد الجديد</button></div></details>
      <a class="btn wa block" href="${escAttr(waTo(o, "confirmed"))}" target="_blank" rel="noopener">ابعت رسالة التأكيد كمان مرة</a>
      <button class="btn danger ghost block" type="button" data-act="cancel">إلغاء الطلب</button></div>`;
  } else if (o.status === "out") {
    actions = `<div class="stack">
      <button class="btn block" type="button" data-act="paid">وصل وانقبض ${money(o.total)}</button>
      <button class="btn ghost block" type="button" data-act="unpaid">وصل، والدفع لسا</button>
      <button class="btn ghost block" type="button" data-act="nobody">ما حدا كان موجود (رجّعه مؤكد)</button>
      <button class="btn danger ghost block" type="button" data-act="cancel">إلغاء الطلب</button></div>`;
  } else if (o.status === "delivered" && o.payStatus !== "paid") {
    actions = `<button class="btn block" type="button" data-act="markPaid">وصل الدفع (${money(o.total)})</button>`;
  } else if (o.status === "cancelled" && o.cancelReason) {
    actions = `<p class="note">سبب الإلغاء: ${esc(o.cancelReason)}</p>`;
  }

  body.innerHTML = `
    <div class="pills"><span class="pill ${statusPill}">${STATUS_LABEL[o.status]}</span>
      ${o.deliveryDate ? `<span class="pill ok">${esc(prettyDate(o.deliveryDate))}${o.deliverySlot ? " · " + esc(o.deliverySlot) : ""}</span>` : ""}
      ${o.status === "delivered" ? `<span class="pill ${o.payStatus === "paid" ? "ok" : "red"}">${o.payStatus === "paid" ? "مدفوع" : "الدفع لسا"}</span>` : ""}</div>
    <div class="box">
      <h3>${esc(o.customer?.name || "")}</h3>
      <div class="kv"><span>الجوال</span><a class="num" href="tel:${escAttr(phone)}">${esc(phone)}</a></div>
      <div class="kv"><span>المنطقة</span><span>${esc(o.areaName || "")}</span></div>
      <div class="kv"><span>العنوان</span><span style="text-align:start">${esc(o.address || "")}</span></div>
      ${o.preferredSlot ? `<div class="kv"><span>الوقت المفضّل</span><span>${esc(o.preferredSlot)}</span></div>` : ""}
      ${o.note ? `<p class="note" style="margin:8px 0 0">${esc(o.note)}</p>` : ""}
      <a class="btn wa block" style="margin-top:10px" href="${escAttr(waLink(phone, "", cc()))}" target="_blank" rel="noopener">محادثة واتساب</a>
    </div>
    <div class="box">
      <h3>الأصناف</h3>
      ${v.rows.map((r) => `<div class="line-item"><div><b>${esc(r.name)}</b> <span class="hint">${esc(r.sizeLabel)}</span> × ${arDigits(r.qty)}
        ${r.preorder ? `<span class="pill new">طلب مسبق</span>` : ""}
        ${r.missing ? `<div class="err">انحذف من المتجر</div>` : r.changed ? `<div class="err">السعر تغيّر: كان ${money(r.price)} وصار ${money(r.now)}</div>` : ""}</div>
        <span class="money">${money(Number(r.price) * r.qty)}</span></div>`).join("")}
      <div class="kv" style="border-top:1px solid var(--line);margin-top:6px;padding-top:8px"><span>المجموع</span><span>${money(o.subtotal)}</span></div>
      <div class="kv"><span>التوصيل</span><span>${Number(o.deliveryFee) ? money(o.deliveryFee) : "مجاني"}</span></div>
      <div class="kv"><b>الإجمالي</b><b class="money">${money(o.total)}</b></div>
      <div class="kv"><span>الدفع</span><span>${esc(PAY_METHODS[o.payMethod]?.label || o.payMethod)}</span></div>
      ${v.tampered ? `<p class="warn" style="margin-top:8px">المجموع اللي وصل مش مطابق للأصناف. السعر الصحيح حسب الأسعار الحالية: ${money(newTotal)}.</p>` : ""}
    </div>
    ${actions}
    ${(o.history || []).length ? `<div class="box"><h3>السجل</h3>${o.history.map((h) =>
      `<div class="kv"><span>${esc(STATUS_LABEL[h.status] || h.status)}</span><span class="hint">${esc((h.at?.toDate ? h.at.toDate() : new Date(h.at)).toLocaleString("ar-EG", { dateStyle: "short", timeStyle: "short" }))}</span></div>`).join("")}</div>` : ""}`;

  body.onclick = onSheetClick;
  body.onchange = (e) => {
    if (e.target.id === "dDate" && e.target.value) { ui.date = e.target.value; refreshSheet(); }
    if (e.target.name === "pm") { ui.priceMode = e.target.value; }
    if (e.target.id === "restock") ui.restock = e.target.checked;
  };
  body.oninput = (e) => { if (e.target.id === "reason") ui.reason = e.target.value; };
}

async function onSheetClick(e) {
  const o = current;
  if (!o) return;
  const day = e.target.closest("[data-day]");
  if (day) { ui.date = day.dataset.day; refreshSheet(); return; }
  const slot = e.target.closest("[data-slot]");
  if (slot) { ui.slot = ui.slot === slot.dataset.slot ? "" : slot.dataset.slot; refreshSheet(); return; }
  const b = e.target.closest("[data-act]");
  if (!b) return;
  const act = b.dataset.act;
  if (act === "close") { closeSheet(); return; }
  if (act === "cancel") { ui.step = "cancel"; refreshSheet(); return; }
  if (act === "back") { ui.step = ""; refreshSheet(); return; }
  b.disabled = true;
  try {
    if (act === "confirm") await confirmOrder(o);
    if (act === "reschedule") await reschedule(o);
    if (act === "out") await markOut([o], true);
    if (act === "paid") await markDelivered(o, true);
    if (act === "unpaid") await markDelivered(o, false);
    if (act === "nobody") await backToConfirmed(o);
    if (act === "markPaid") await markPaid(o);
    if (act === "doCancel") await cancelOrder(o);
    refreshSheet();
  } catch (err) {
    console.error(err);
    toast(err.message === "state" ? "حالة الطلب تغيّرت، شوفه من جديد" : !navigator.onLine ? "بدها نت، جرّب لما يرجع" : "ما زبطت، جرّب كمان مرة", true);
    b.disabled = false;
  }
}

// ---------------- العمليات ----------------
// تأكيد: بيخصم من المخزون، بيحدّد الموعد، وبيفعّل صفحة التتبع. كله بعملية وحدة
async function confirmOrder(o) {
  if (!ui.date) throw new Error("no date");
  const v = verify(o);
  const useNow = v.changed && ui.priceMode === "now";
  const newSubtotal = useNow ? v.sumNow : Number(o.subtotal);
  const total = round2(newSubtotal + Number(o.deliveryFee) - Number(o.discount || 0));
  const oRef = doc(adb, "orders", o.id);

  await runTransaction(adb, async (tx) => {
    const fresh = await tx.get(oRef);
    if (!fresh.exists() || fresh.data().status !== "new") throw new Error("state");
    const ids = [...new Set(o.items.map((i) => i.productId))];
    const prods = {};
    for (const id of ids) {
      const s = await tx.get(doc(adb, "products", id));
      prods[id] = s.exists() ? s.data() : null;
    }
    const stock = {};
    const applied = [];
    for (const it of o.items) {
      const p = prods[it.productId];
      if (!p || p.madeToOrder) continue;
      const need = (Number(it.use) || 1) * it.qty;
      const cur = stock[it.productId] ?? (Number(p.stock) || 0);
      const take = r3(Math.min(cur, need));      // ما بنخلي المخزون ينزل تحت الصفر
      if (take > 0) {
        stock[it.productId] = r3(cur - take);
        applied.push({ productId: it.productId, name: it.name, qty: take });
      }
    }
    for (const [pid, st] of Object.entries(stock)) tx.update(doc(adb, "products", pid), { stock: st, updatedAt: serverTimestamp() });
    for (const a of applied) {
      tx.set(doc(collection(adb, "stockLog")), {
        productId: a.productId, productName: a.name, delta: -a.qty, reason: "order", orderId: o.id,
        after: stock[a.productId], at: serverTimestamp(), by: S.user?.email || "",
      });
    }
    const upd = {
      status: "confirmed", confirmedAt: serverTimestamp(), deliveryDate: ui.date, deliverySlot: ui.slot || "",
      stockApplied: applied, history: history("confirmed"),
    };
    if (useNow) {
      upd.subtotal = newSubtotal; upd.total = total;
      upd.items = o.items.map((it) => { const r = v.rows.find((x) => x.productId === it.productId && x.sizeId === it.sizeId); return { ...it, price: r?.now ?? it.price }; });
    }
    tx.update(oRef, upd);
    tx.update(doc(adb, "orderStatus", o.trackId), { status: "confirmed", deliveryDate: ui.date, deliverySlot: ui.slot || "", updatedAt: serverTimestamp() });
  });

  const after = { ...o, deliveryDate: ui.date, deliverySlot: ui.slot, total };
  const links = [{ label: "ابعت رسالة التأكيد عالواتساب", href: waTo(after, "confirmed") }];
  if (o.payMethod === "transfer") links.push({ label: "ابعت بيانات الحساب البنكي", href: waTo(after, "transfer"), cls: "ghost" });
  ui.done = { title: "تأكد الطلب، وانخصم من المخزون", links };
  toast("تأكد " + o.id);
}

async function reschedule(o) {
  const b = writeBatch(adb);
  b.update(doc(adb, "orders", o.id), { deliveryDate: ui.date, deliverySlot: ui.slot || "", history: history("confirmed", { note: "تعديل الموعد" }) });
  b.update(doc(adb, "orderStatus", o.trackId), { deliveryDate: ui.date, deliverySlot: ui.slot || "", updatedAt: serverTimestamp() });
  await b.commit();
  ui.done = { title: "تعدّل الموعد", links: [{ label: "بلّغ الزبون بالموعد الجديد", href: waTo({ ...o, deliveryDate: ui.date, deliverySlot: ui.slot }, "confirmed") }] };
  toast("انحفظ الموعد");
}

async function markOut(os, single = false) {
  if (!os.length) return;
  const b = writeBatch(adb);
  for (const o of os) {
    b.update(doc(adb, "orders", o.id), { status: "out", outAt: serverTimestamp(), history: history("out") });
    b.update(doc(adb, "orderStatus", o.trackId), { status: "out", updatedAt: serverTimestamp() });
  }
  await b.commit();
  toast(os.length > 1 ? `طلع ${arDigits(os.length)} طلبات للتوصيل` : `${os[0].id} طلع للتوصيل`);
  if (single) ui.done = { title: "طلع للتوصيل", links: [{ label: "بلّغ الزبون (اختياري)", href: waTo(os[0], "out") }] };
}

async function markDelivered(o, paid) {
  const b = writeBatch(adb);
  b.update(doc(adb, "orders", o.id), {
    status: "delivered", deliveredAt: serverTimestamp(), payStatus: paid ? "paid" : "unpaid",
    ...(paid ? { paidAt: serverTimestamp() } : {}), history: history("delivered"),
  });
  b.update(doc(adb, "orderStatus", o.trackId), { status: "delivered", updatedAt: serverTimestamp() });
  const key = normalizePhone(o.customer?.phone, cc()) || "unknown";
  b.set(doc(adb, "customers", key), {
    name: o.customer?.name || "", phone: o.customer?.phone || "", areaName: o.areaName || "",
    lastOrderAt: serverTimestamp(), ordersCount: increment(1), totalSpent: increment(Number(o.total) || 0),
  }, { merge: true });
  if (paid) b.set(doc(adb, "sales", o.id), saleDoc(o));
  await b.commit();
  ui.done = { title: paid ? "وصل وانقبض" : "وصل، والدفع لسا", links: [{ label: "رسالة شكر للزبون (اختياري)", href: waTo(o, "delivered") }] };
  toast(o.id + " وصل");
}

function saleDoc(o) {
  return {
    orderId: o.id, number: o.number, total: Number(o.total) || 0, subtotal: Number(o.subtotal) || 0,
    deliveryFee: Number(o.deliveryFee) || 0, payMethod: o.payMethod, customerName: o.customer?.name || "",
    items: (o.items || []).map((i) => ({ productId: i.productId, name: i.name, sizeLabel: i.sizeLabel, qty: i.qty, price: i.price })),
    paidAt: serverTimestamp(),
  };
}

async function markPaid(o) {
  const b = writeBatch(adb);
  b.update(doc(adb, "orders", o.id), { payStatus: "paid", paidAt: serverTimestamp(), history: history("delivered", { note: "وصل الدفع" }) });
  b.set(doc(adb, "sales", o.id), saleDoc(o));
  await b.commit();
  toast("انسجل الدفع");
}

async function backToConfirmed(o) {
  const b = writeBatch(adb);
  b.update(doc(adb, "orders", o.id), { status: "confirmed", history: history("confirmed", { note: "ما حدا كان موجود" }) });
  b.update(doc(adb, "orderStatus", o.trackId), { status: "confirmed", updatedAt: serverTimestamp() });
  await b.commit();
  toast("رجع مؤكد، عدّل الموعد إذا بدك");
}

// إلغاء: إذا كان انخصم من المخزون بيرجع (إلا إذا اخترت لا)
async function cancelOrder(o) {
  const restock = ui.restock && (o.stockApplied || []).length;
  const oRef = doc(adb, "orders", o.id);
  await runTransaction(adb, async (tx) => {
    const fresh = await tx.get(oRef);
    if (!fresh.exists() || ["cancelled", "delivered"].includes(fresh.data().status)) throw new Error("state");
    const applied = fresh.data().stockApplied || [];
    if (restock) {
      for (const a of applied) {
        tx.update(doc(adb, "products", a.productId), { stock: increment(a.qty), updatedAt: serverTimestamp() });
        tx.set(doc(collection(adb, "stockLog")), {
          productId: a.productId, productName: a.name, delta: a.qty, reason: "cancel", orderId: o.id,
          at: serverTimestamp(), by: S.user?.email || "",
        });
      }
    }
    tx.update(oRef, {
      status: "cancelled", cancelledAt: serverTimestamp(), cancelReason: ui.reason.trim().slice(0, 300),
      stockApplied: restock ? [] : applied, history: history("cancelled"),
    });
    tx.update(doc(adb, "orderStatus", o.trackId), { status: "cancelled", updatedAt: serverTimestamp() });
  });
  ui.step = "";
  ui.done = { title: "انلغى الطلب" + (restock ? " ورجعت الكمية للمخزون" : ""), links: [{ label: "بلّغ الزبون", href: waTo(o, "cancelled", { "السبب": ui.reason.trim() }) }] };
  toast(o.id + " انلغى");
}

// #orders/confirmed مثلاً بيفتح على تبويب "مؤكد"
export function show(param) {
  if (param && TABS.some(([k]) => k === param) && param !== tab) { tab = param; selected.clear(); listenHistory(); }
  render();
}
