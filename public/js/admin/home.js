// الرئيسية: أول شاشة بتفتح. بتجاوب على ٣ أسئلة بنظرة وحدة:
// شو مستنيني هلأ؟ شو لازم أجهّز اليوم وبكرة؟ وكيف ماشي البيع؟
// كل سطر فيها بيوديك عالمكان اللي بتشتغل فيه.
import { collection, query, where, onSnapshot, doc, setDoc, serverTimestamp } from "../fb.js";
import { adb, S, subscribe } from "./state.js";
import { onOrders, ordersNow } from "./orders.js";
import { isLow } from "./products.js";
import { toast, copyText } from "./ui.js";
import { esc, escAttr, money, arDigits, prettyDate, ymd, addDays, dayName } from "../util.js";

const I = (p) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const IC = {
  bell: I('<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>'),
  clock: I('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
  truck: I('<path d="M3 6h11v10H3z"/><path d="M14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>'),
  cash: I('<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/>'),
  box: I('<path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9"/>'),
  alert: I('<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4M12 17.2v.1"/>'),
  gear: I('<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M4.2 7l2.6 1.5M17.2 15.5l2.6 1.5M4.2 17l2.6-1.5M17.2 8.5 19.8 7"/>'),
  plus: I('<path d="M12 5v14M5 12h14"/>'),
  ext: I('<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'),
  link: I('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
  chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>',
};

let el = null;
let prepDay = "today";
let sales = [];          // المبيعات المقبوضة من بداية الشهر (أو آخر ٧ أيام إذا أبعد)
let unpaid = [];         // وصلت ولسا ما انقبضت
let listening = false;

export function init(root) {
  el = root;
  el.addEventListener("click", onClick);
  if (!listening) {
    listening = true;
    const now = new Date();
    const from = new Date(Math.min(new Date(now.getFullYear(), now.getMonth(), 1).getTime(), new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6).getTime()));
    onSnapshot(query(collection(adb, "sales"), where("paidAt", ">=", from)), (q) => {
      sales = q.docs.map((d) => d.data());
      render();
    }, (e) => console.warn("sales", e));
    onSnapshot(query(collection(adb, "orders"), where("status", "==", "delivered"), where("payStatus", "==", "unpaid")), (q) => {
      unpaid = q.docs.map((d) => ({ id: d.id, ...d.data() }));
      render();
    }, (e) => console.warn("unpaid", e));
    onOrders(render);
    subscribe(() => render());
  }
  render();
}
export function show() { render(); }

const toDate = (t) => (t?.toDate ? t.toDate() : t instanceof Date ? t : null);
function greet() {
  const h = new Date().getHours();
  return h < 12 ? "صباح الخير" : "مسا الخير";
}

function todoRows() {
  const { lists } = ordersNow();
  const today = ymd();
  const rows = [];
  const add = (href, icon, tone, title, sub, n) => rows.push({ href, icon, tone, title, sub, n });

  const late = lists.confirmed.filter((o) => o.deliveryDate && o.deliveryDate < today);
  const todayDel = lists.confirmed.filter((o) => o.deliveryDate === today);
  const lowP = S.products.filter((p) => p.visible !== false && isLow(p));
  const unpaidSum = unpaid.reduce((s, o) => s + (Number(o.total) || 0), 0);

  if (lists.new.length) add("#orders/new", IC.bell, "warm", "طلبات جديدة", "أكّدها وحدد موعد التوصيل", arDigits(lists.new.length));
  if (late.length) add("#orders/confirmed", IC.alert, "red", "طلبات فات موعدها", "طلّعها للتوصيل أو غيّر الموعد", arDigits(late.length));
  if (todayDel.length) add("#orders/confirmed", IC.clock, "olive", "توصيل اليوم", "جهّزها وطلّعها للتوصيل", arDigits(todayDel.length));
  if (lists.out.length) add("#orders/out", IC.truck, "blue", "بالطريق", "لما توصل سجّلها وصلت", arDigits(lists.out.length));
  if (unpaid.length) add("#orders/delivered", IC.cash, "warm", "وصلت ولسا ما انقبضت", money(unpaidSum), arDigits(unpaid.length));
  if (lowP.length) add("#products/low", IC.box, "red", "أصناف قرّبت تخلص", lowP.slice(0, 3).map((p) => p.name).join("، ") + (lowP.length > 3 ? "…" : ""), arDigits(lowP.length));

  // تجهيزات المتجر لسا ناقصة
  const st = S.settings || {};
  const realAreas = S.areas.filter((a) => a.active && !a.demo);
  if (!st.whatsapp) add("#settings", IC.gear, "plain", "حط رقم الواتساب", "عشان يوصلك الزبون وتطلع رسائل الطلبات صح", "");
  if (!realAreas.length) add("#catalog", IC.gear, "plain", "ضيف مناطق التوصيل", "كل منطقة وسعر توصيلها", "");
  if (st.payMethods?.transfer && !st.transferInfo) add("#settings", IC.gear, "plain", "اكتب بيانات الحساب البنكي", "بتنبعت للزبون اللي بيختار تحويل بنكي", "");
  if (S.products.some((p) => p.demo)) add("#products", IC.gear, "plain", "في منتجات تجريبية", "بدّلها بالمنتجات الحقيقية أو امسحها قبل النشر", "");
  return rows;
}

function prepFor(dateStr) {
  const { lists } = ordersNow();
  const os = lists.confirmed.filter((o) => o.deliveryDate === dateStr);
  const map = new Map();
  os.forEach((o) => (o.items || []).forEach((i) => {
    const k = i.productId + "|" + i.sizeLabel;
    const cur = map.get(k) || { name: i.name, size: i.sizeLabel, qty: 0, pre: false };
    cur.qty += Number(i.qty) || 0;
    cur.pre = cur.pre || !!i.preorder;
    map.set(k, cur);
  }));
  return { count: os.length, items: [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "ar")) };
}

function stats() {
  const now = new Date();
  const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const w0 = t0 - 6 * 864e5;
  const m0 = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const sum = (from) => {
    const l = sales.filter((s) => (toDate(s.paidAt)?.getTime() ?? now.getTime()) >= from);   // اللي لسا بيتحفظ بنعدّه هلأ
    return { total: l.reduce((a, s) => a + (Number(s.total) || 0), 0), n: l.length };
  };
  return { today: sum(t0), week: sum(w0), month: sum(m0), unpaid: { total: unpaid.reduce((a, o) => a + (Number(o.total) || 0), 0), n: unpaid.length } };
}

function render() {
  if (!el || el.hidden) return;
  const today = ymd();
  const open = S.settings?.storeOpen !== false;
  const rows = todoRows();
  const st = stats();
  const target = prepDay === "today" ? today : addDays(today, 1);
  const prep = prepFor(target);
  const { dayCounts, lists } = ordersNow();
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));

  const tile = (label, v, sub, tone = "") => `<div class="tile ${tone}"><span class="lab">${label}</span><b class="money">${money(v)}</b><span class="hint">${sub}</span></div>`;

  el.innerHTML = `
  <div class="home">
    <section class="hello">
      <div><h2>${greet()}</h2><p class="muted">${esc(prettyDate(today))}</p></div>
      <button class="store-state ${open ? "on" : ""}" type="button" id="hStore" aria-pressed="${open}">
        <span class="txt"><b>${open ? "المتجر مفتوح" : "المتجر مسكّر"}</b><small>${open ? "الزباين بيقدروا يطلبوا" : "الطلبات موقّفة"}</small></span>
        <span class="sw" aria-hidden="true"><i></i></span>
      </button>
    </section>

    <div class="hgrid">
      <section class="box todo">
        <h3>مستنيك هلأ</h3>
        ${rows.length ? rows.map((r) => `
          <a class="todo-row t-${r.tone}" href="${r.href}">
            <span class="ic">${r.icon}</span>
            <span class="t"><b>${esc(r.title)}</b><small>${esc(r.sub)}</small></span>
            ${r.n ? `<span class="n">${r.n}</span>` : ""}
            <span class="chev">${IC.chev}</span>
          </a>`).join("") : `<p class="calm">كله تمام، ما في اشي مستنيك هلأ.</p>`}
      </section>

      <section class="box stats">
        <h3>البيع</h3>
        <div class="tiles">
          ${tile("اليوم", st.today.total, `${arDigits(st.today.n)} طلب انقبض`)}
          ${tile("آخر ٧ أيام", st.week.total, `${arDigits(st.week.n)} طلب`)}
          ${tile("هالشهر", st.month.total, `${arDigits(st.month.n)} طلب`)}
          ${tile("لسا ما انقبض", st.unpaid.total, `${arDigits(st.unpaid.n)} طلب`, st.unpaid.n ? "warm" : "")}
        </div>
      </section>

      <section class="box prep">
        <div class="box-h"><h3>شو لازم يتجهّز</h3>
          <div class="seg" role="group" aria-label="اليوم">
            <button type="button" data-prep="today" aria-pressed="${prepDay === "today"}">اليوم</button>
            <button type="button" data-prep="tomorrow" aria-pressed="${prepDay === "tomorrow"}">بكرة</button>
          </div></div>
        <p class="hint" style="margin:0 0 8px">${esc(prettyDate(target))} · ${arDigits(prep.count)} طلب مأكد${lists.new.length ? ` · و${arDigits(lists.new.length)} جديد لسا ما تأكد` : ""}</p>
        ${prep.items.length ? `<div class="prep-list">${prep.items.map((i) => `
          <div class="prep-row"><span class="q">${arDigits(i.qty)}×</span><span class="nm">${esc(i.name)}</span><span class="sz">${esc(i.size || "")}</span>${i.pre ? `<span class="pill new">عالطلب</span>` : ""}</div>`).join("")}</div>`
          : `<p class="calm">ما في طلبات مأكدة لهاليوم.</p>`}
      </section>

      <section class="box week">
        <h3>التوصيل بالأيام الجاية</h3>
        <div class="days7">${days.map((d, i) => `
          <a class="d7 ${dayCounts[d] ? "has" : ""}" href="#orders/confirmed">
            <small>${i === 0 ? "اليوم" : i === 1 ? "بكرة" : esc(dayName(d))}</small>
            <b>${arDigits(Number(d.slice(8)))}</b>
            <span>${dayCounts[d] ? arDigits(dayCounts[d]) + " طلب" : "—"}</span>
          </a>`).join("")}</div>
      </section>

      <section class="box quick">
        <h3>اختصارات</h3>
        <div class="qgrid">
          <a class="q-btn" href="#products/new">${IC.plus}<span>منتج جديد</span></a>
          <a class="q-btn" href="index.html" target="_blank" rel="noopener">${IC.ext}<span>افتح المتجر</span></a>
          <button class="q-btn" type="button" id="hCopy">${IC.link}<span>انسخ رابط المتجر</span></button>
          <a class="q-btn" href="#settings">${IC.gear}<span>الإعدادات</span></a>
        </div>
      </section>
    </div>
  </div>`;
}

async function onClick(e) {
  const p = e.target.closest("[data-prep]");
  if (p) { prepDay = p.dataset.prep; render(); return; }
  if (e.target.closest("#hCopy")) {
    const url = new URL("index.html", location.href).href;
    toast((await copyText(url)) ? "انتسخ رابط المتجر" : url);
    return;
  }
  const s = e.target.closest("#hStore");
  if (s) {
    const open = S.settings?.storeOpen !== false;
    s.disabled = true;
    try {
      await setDoc(doc(adb, "settings", "main"), { storeOpen: !open, updatedAt: serverTimestamp() }, { merge: true });
      toast(!open ? "المتجر انفتح" : "المتجر تسكّر، والزباين بيشوفوا رسالة الإغلاق");
    } catch { toast("ما زبطت، جرّب كمان مرة", true); }
    s.disabled = false;
  }
}
