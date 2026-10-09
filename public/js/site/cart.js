import { doc, runTransaction, serverTimestamp } from "../fb.js";
import { esc, escAttr, money, arDigits, round2, randomId } from "../util.js";
import { PAY_METHODS } from "../constants.js";
import { store, renderChrome, cart, availability, cld, myOrders, ICON, loadCatalog, loadAreas, onSettings, loadSettings, netError } from "./common.js";

renderChrome("cart");
const $root = document.getElementById("root");

let settings = {};
let products = {};        // productId -> data (الظاهرة بالمتجر بس)
let areas = [];
let loaded = false;       // في بيانات (محفوظة أو جديدة) نرسم فيها
const form = { name: "", phone: "", areaId: "", address: "", slot: "", note: "", pay: "" };

// ---------------- البيانات: بنرسم من آخر نسخة محفوظة، وبنحدّث لما توصل الجديدة ----------------
const catalog = loadCatalog();
const areasL = loadAreas();
const setCatalog = (d) => { products = Object.fromEntries((d.products || []).map((x) => [x.id, x])); };
if (catalog.cached) setCatalog(catalog.cached);
if (areasL.cached) areas = areasL.cached;
loaded = !!(catalog.cached && areasL.cached);

// قبل ما نبعت الطلب لازم تكون الأسعار والمناطق والإعدادات جديدة من النت
const ready = Promise.all([
  catalog.fresh.then(setCatalog),
  areasL.fresh.then((a) => { areas = a; }),
  loadSettings().then((s) => { settings = s; }),
]);

// كل سطر بالسلة مع سعره الحالي من الداتابيز (مش من جهاز الزبون)
function lines() {
  return cart.items().map((it) => {
    const p = products[it.productId];
    const size = p?.sizes?.find((s) => s.id === it.sizeId);
    if (!p || !size || p.visible === false) return { it, ok: false, reason: "هاد الصنف مش متوفر بالمتجر هلأ" };
    const a = availability(p, size, it.qty);
    if (a.state === "out") return { it, p, size, ok: false, reason: "خلص، شيله من السلة" };
    return { it, p, size, a, ok: true, price: Number(size.price) || 0, total: round2((Number(size.price) || 0) * it.qty) };
  });
}

function totals(ls) {
  const subtotal = round2(ls.filter((l) => l.ok).reduce((s, l) => s + l.total, 0));
  const area = areas.find((a) => a.id === form.areaId);
  const freeMin = Number(settings.freeDeliveryMin) || 0;
  const free = freeMin > 0 && subtotal >= freeMin;
  const deliveryFee = area ? (free ? 0 : Number(area.fee) || 0) : 0;
  return { subtotal, area, freeMin, free, deliveryFee, total: round2(subtotal + deliveryFee) };
}

// ---------------- الرسم ----------------
function render() {
  if (!loaded && cart.items().length) { $root.innerHTML = `<div class="skeleton" style="height:200px"></div>`; return; }
  const ls = lines();
  if (!ls.length) {
    $root.innerHTML = `<div class="empty"><p>سلتك فاضية.</p><a class="btn" href="shop.html">روح للمتجر</a></div>`;
    return;
  }
  const t = totals(ls);
  const blocked = ls.some((l) => !l.ok);
  const closed = settings.storeOpen === false;
  const pays = Object.entries(settings.payMethods || { cash: true }).filter(([, on]) => on).map(([k]) => k);
  if (!form.pay || !pays.includes(form.pay)) form.pay = pays[0] || "cash";
  const slots = settings.timeSlots || [];

  $root.innerHTML = `
    <div class="cols">
      <div class="stack">
        ${t.freeMin > 0 ? `<div class="free">${t.free ? "التوصيل مجاني لهالطلب" : `باقي ${money(t.freeMin - t.subtotal)} وبصير التوصيل مجاني`}
          <div class="bar"><i style="width:${Math.min(100, Math.round((t.subtotal / t.freeMin) * 100))}%"></i></div></div>` : ""}
        <section class="panel-card" aria-label="الأصناف">
          ${ls.map((l) => `
            <div class="item">
              <img src="${escAttr(cld(l.p?.images?.[0] || l.it.image, 160))}" alt="">
              <div class="bd">
                <div class="top"><span class="nm">${esc(l.p?.name || l.it.name)}</span>
                  <button class="rm" type="button" data-rm="${escAttr(l.it.key)}" aria-label="احذف">${ICON.trash}</button></div>
                <span class="muted" style="font-size:13px">${esc(l.size?.label || l.it.sizeLabel || "")}</span>
                ${!l.ok ? `<span class="err">${esc(l.reason)}</span>` :
                  l.a.state === "preorder" ? `<span class="tagline b-pre">طلب مسبق${l.a.days ? ` · بيجهز خلال ${arDigits(l.a.days)} أيام` : ""}</span>` : ""}
                ${l.ok ? `<div class="row"><span class="price">${money(l.total)}</span>
                  <div class="qty"><button type="button" data-inc="${escAttr(l.it.key)}" aria-label="زيد">${ICON.plus}</button>
                  <b>${arDigits(l.it.qty)}</b>
                  <button type="button" data-dec="${escAttr(l.it.key)}" aria-label="نقّص">${ICON.minus}</button></div></div>` : ""}
              </div>
            </div>`).join("")}
        </section>

        <form class="panel-card stack" id="f" novalidate>
          <p class="h3">بياناتك</p>
          <div class="field"><label for="name">الاسم</label><input class="input" id="name" autocomplete="name" value="${escAttr(form.name)}" placeholder="اسمك الكامل"><span class="err" data-e="name"></span></div>
          <div class="field"><label for="phone">رقم الجوال (واتساب)</label><input class="input" id="phone" type="tel" inputmode="tel" autocomplete="tel" dir="ltr" style="text-align:right" value="${escAttr(form.phone)}" placeholder="059 000 0000"><span class="err" data-e="phone"></span></div>
          <div class="field"><label for="area">المنطقة</label>
            <select class="input" id="area" data-title="المنطقة"><option value="">اختار منطقتك</option>
              ${areas.map((a) => `<option value="${escAttr(a.id)}" ${a.id === form.areaId ? "selected" : ""}>${esc(a.name)} · توصيل ${money(a.fee)}</option>`).join("")}
            </select><span class="err" data-e="area"></span></div>
          <div class="field"><label for="address">العنوان بالتفصيل</label><textarea class="input" id="address" rows="2" placeholder="الحي، الشارع، أقرب معلم">${esc(form.address)}</textarea><span class="err" data-e="address"></span></div>
          ${slots.length ? `<div class="field"><span style="font-weight:600;font-size:14px">الوقت اللي بيناسبك (اختياري)</span>
            <div class="chips" id="slots">${slots.map((s) => `<button type="button" class="chip" data-slot="${escAttr(s)}" aria-pressed="${s === form.slot}">${esc(s)}</button>`).join("")}</div></div>` : ""}
          <p class="notice" style="margin:0">بعد ما يوصلنا طلبك، بنتواصل معك عالواتساب ونحدد موعد التوصيل.</p>
          <p class="h3" style="margin-top:6px">طريقة الدفع</p>
          <div class="pays">${pays.map((k) => `<label class="pay"><input type="radio" name="pay" value="${k}" ${k === form.pay ? "checked" : ""}>
            <span class="pay-ic" aria-hidden="true">${k === "cash" ? ICON.cash : ICON.bank}</span>
            <span><b>${esc(PAY_METHODS[k]?.label || k)}</b><span class="muted">${esc(PAY_METHODS[k]?.hint || "")}</span></span></label>`).join("")}</div>
          <div class="field"><label for="note">ملاحظة (اختياري)</label><textarea class="input" id="note" rows="2" placeholder="مثلاً: اتصلوا قبل ما توصلوا">${esc(form.note)}</textarea></div>
        </form>
      </div>

      <aside class="side panel-card stack" aria-label="الملخص">
        <div class="sumrow"><span>المجموع</span><span>${money(t.subtotal)}</span></div>
        <div class="sumrow"><span>التوصيل</span><span>${t.area ? (t.free ? "مجاني" : money(t.deliveryFee)) : "اختار المنطقة"}</span></div>
        <div class="sumrow total"><span>الإجمالي</span><span class="price">${money(t.total)}</span></div>
        ${closed ? `<p class="notice" style="margin:0">${esc(settings.closedMessage || "المتجر مسكّر هالفترة")}</p>` : ""}
        ${blocked ? `<p class="err" style="margin:0">في صنف بالسلة مش متوفر، شيله عشان تكمّل.</p>` : ""}
        <button class="btn block" type="button" id="send" ${closed || blocked ? "disabled" : ""}>أكّد الطلب</button>
        <p class="err" id="sendErr" style="margin:0" hidden></p>
      </aside>
    </div>`;
}

// ---------------- التفاعل ----------------
function readForm() {
  const v = (id) => document.getElementById(id)?.value ?? "";
  form.name = v("name").trim();
  form.phone = v("phone").trim();
  form.areaId = v("area");
  form.address = v("address").trim();
  form.note = v("note").trim();
  form.pay = document.querySelector('input[name="pay"]:checked')?.value || form.pay;
}

$root.addEventListener("click", (e) => {
  const t = e.target.closest("button");
  if (!t) return;
  if (t.dataset.rm || t.dataset.inc || t.dataset.dec || t.dataset.slot !== undefined) readForm();
  if (t.dataset.rm) { cart.remove(t.dataset.rm); render(); }
  else if (t.dataset.inc) { const i = cart.items().find((x) => x.key === t.dataset.inc); cart.setQty(i.key, i.qty + 1); render(); }
  else if (t.dataset.dec) { const i = cart.items().find((x) => x.key === t.dataset.dec); cart.setQty(i.key, i.qty - 1); render(); }
  else if (t.dataset.slot !== undefined) { form.slot = form.slot === t.dataset.slot ? "" : t.dataset.slot; render(); }
  else if (t.id === "send") send();
});
// أول ما الزبون يصلّح الخانة بتختفي رسالة الخطأ تبعها
$root.addEventListener("input", (e) => {
  const er = e.target.id && $root.querySelector(`[data-e="${e.target.id}"]`);
  if (er) er.textContent = "";
});
$root.addEventListener("change", (e) => { if (e.target.id === "area" || e.target.name === "pay") { readForm(); render(); } });

function validate() {
  const errs = {};
  if (form.name.length < 2) errs.name = "اكتب اسمك";
  const digits = form.phone.replace(/\D/g, "");
  if (digits.length < 9 || digits.length > 15) errs.phone = "اكتب رقم جوال صحيح";
  if (!form.areaId) errs.area = "اختار منطقتك";
  if (form.address.length < 3) errs.address = "اكتب العنوان";
  document.querySelectorAll("[data-e]").forEach((el) => (el.textContent = errs[el.dataset.e] || ""));
  const first = Object.keys(errs)[0];
  if (first) document.getElementById(first)?.focus();
  return !first;
}

let sending = false;
async function send() {
  if (sending) return;
  readForm();
  if (!validate()) return;
  const $btn = document.getElementById("send");
  const $err = document.getElementById("sendErr");
  sending = true; $btn.disabled = true; $btn.textContent = "عم نبعت الطلب…"; $err.hidden = true;
  const fail = (msg) => { sending = false; $btn.disabled = false; $btn.textContent = "أكّد الطلب"; $err.hidden = false; $err.textContent = msg; };
  // بنتأكد إن الأسعار والمخزون جديدة قبل ما نبعت
  try { await ready; } catch { fail("النت ضعيف، تأكد منه وجرّب كمان مرة."); return; }
  const ls = lines();
  if (ls.some((l) => !l.ok) || settings.storeOpen === false) { sending = false; rerender(); return; }
  const t = totals(ls);
  if (!t.area) { sending = false; rerender(); return; }

  const trackId = randomId(24);
  const pre = ls.filter((l) => l.a.state === "preorder");
  const data = {
    trackId,
    customer: { name: form.name.slice(0, 80), phone: form.phone.slice(0, 20) },
    areaId: t.area.id, areaName: String(t.area.name).slice(0, 60),
    address: form.address.slice(0, 300),
    items: ls.map((l) => ({
      productId: l.p.id, name: l.p.name, sizeId: l.size.id, sizeLabel: l.size.label,
      price: l.price, qty: l.it.qty, use: Number(l.size.use) || 1, preorder: l.a.state === "preorder",
    })),
    subtotal: t.subtotal, deliveryFee: t.deliveryFee, discount: 0, total: t.total,
    payMethod: form.pay,
    hasPreorder: pre.length > 0,
    maxPrepDays: Math.max(0, ...pre.map((l) => Math.round(l.a.days || 0))),
    status: "new", source: "website", createdAt: serverTimestamp(),
  };
  if (form.note) data.note = form.note.slice(0, 500);
  if (form.slot) data.preferredSlot = form.slot.slice(0, 20);

  try {
    const counterRef = doc(store, "counters", "orders");
    const { number, orderId } = await runTransaction(store, async (tx) => {
      const c = await tx.get(counterRef);
      if (!c.exists()) throw new Error("no-counter");
      const n = c.data().next;
      const id = "KH-" + n;
      tx.set(doc(store, "orders", id), { ...data, number: n });
      tx.set(doc(store, "orderStatus", trackId), { orderId: id, number: n, status: "new", createdAt: serverTimestamp() });
      tx.update(counterRef, { next: n + 1 });
      return { number: n, orderId: id };
    });
    const summary = [
      `مرحبا، عملت طلب رقم ${orderId} من الموقع:`,
      ...ls.map((l) => `- ${l.p.name} (${l.size.label}) × ${l.it.qty}`),
      `الإجمالي: ${t.total} ₪`,
      `الاسم: ${form.name}`,
      `المنطقة: ${t.area.name}`,
    ].join("\n");
    myOrders.add({ trackId, orderId, number, total: t.total, summary, at: Date.now() });
    cart.clear();
    location.href = `track.html?t=${encodeURIComponent(trackId)}&new=1`;
  } catch (e) {
    console.error(e);
    fail(e?.message === "no-counter"
      ? "المتجر لسا بيتجهّز لاستقبال الطلبات. جرّب بعد شوي أو اطلب عالواتساب."
      : e?.code === "permission-denied"
        ? "صار تغيير بالأسعار أو المناطق أو المتجر مسكّر. حدّث الصفحة وجرّب كمان مرة."
        : "ما قدرنا نبعت الطلب، تأكد من النت وجرّب كمان مرة.");
  }
}

// إعادة الرسم بدون ما يضيع اللي الزبون عم يكتبه
function rerender() {
  if (document.getElementById("f")) readForm();
  const a = document.activeElement;
  const focusId = a && a.id && $root.contains(a) ? a.id : "";
  const sel = focusId && "selectionStart" in a ? [a.selectionStart, a.selectionEnd] : null;
  render();
  if (focusId) {
    const el = document.getElementById(focusId);
    el?.focus({ preventScroll: true });
    if (sel && el?.setSelectionRange) try { el.setSelectionRange(...sel); } catch {}
  }
}

onSettings((s) => { settings = s; if (loaded) rerender(); });
ready.then(() => { loaded = true; rerender(); })
  .catch((e) => { console.warn(e); if (!loaded && cart.items().length) $root.innerHTML = netError(); });
render();
