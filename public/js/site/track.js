import { doc, onSnapshot } from "../fb.js";
import { esc, escAttr, money, prettyDate, waLink } from "../util.js";
import { store, renderChrome, myOrders, ICON, onSettings } from "./common.js";

renderChrome("track");
let settings = {};
const $root = document.getElementById("root");
const params = new URLSearchParams(location.search);
const trackId = params.get("t");
const isNew = params.get("new") === "1";

if (!trackId) {
  const list = myOrders.list();
  $root.innerHTML = list.length
    ? `<h1 style="margin:6px 0 4px;font-size:26px">طلباتي</h1>
       <div class="panel-card stack">${list.map((o) => `<a href="track.html?t=${encodeURIComponent(o.trackId)}" style="display:flex;justify-content:space-between;text-decoration:none;font-weight:600"><span>${esc(o.orderId || "")}</span><span class="price">${money(o.total || 0)}</span></a>`).join("")}</div>`
    : `<div class="empty"><p>ما في طلبات محفوظة على هالجهاز. إذا عندك رابط التتبع من رسالة الواتساب، افتحه من هناك.</p><a class="btn" href="shop.html">روح للمتجر</a></div>`;
} else {
  const mine = myOrders.list().find((o) => o.trackId === trackId);
  const steps = [
    { key: "new", title: "وصلنا طلبك", sub: "بنراجعه وبنتواصل معك عالواتساب" },
    { key: "confirmed", title: "تأكد الطلب", sub: "" },
    { key: "out", title: "طلع للتوصيل", sub: "المندوب بالطريق إلك" },
    { key: "delivered", title: "وصل", sub: "صحتين وعافية" },
  ];
  const order = { new: 0, confirmed: 1, out: 2, delivered: 3 };

  let lastSnap = null;
  onSettings((s) => { settings = s; if (lastSnap) draw(lastSnap); });
  onSnapshot(doc(store, "orderStatus", trackId), (snap) => { lastSnap = snap; draw(snap); }, () => {
    $root.innerHTML = `<div class="empty"><p>ما قدرنا نحمّل حالة الطلب، تأكد من النت وحدّث الصفحة.</p></div>`;
  });

  function draw(snap) {
    if (!snap.exists() && snap.metadata?.fromCache) {
      $root.innerHTML = `<div class="empty"><p>عم نستنى النت عشان نجيب حالة طلبك…</p></div>`;
      return;
    }
    if (!snap.exists()) {
      $root.innerHTML = `<div class="empty"><p>ما لقينا هالطلب. تأكد من الرابط.</p><a class="btn" href="shop.html">روح للمتجر</a></div>`;
      return;
    }
    const s = snap.data();
    const at = order[s.status] ?? 0;
    const when = s.deliveryDate ? prettyDate(s.deliveryDate) + (s.deliverySlot ? " · " + s.deliverySlot : "") : "";
    const wa = settings.whatsapp && mine?.summary ? waLink(settings.whatsapp, mine.summary, settings.countryCode || "970") : "";

    $root.innerHTML = `
      ${isNew && s.status === "new" ? `
        <section class="panel-card done">
          <div class="ok">${ICON.check}</div>
          <h1>وصلنا طلبك</h1>
          <p class="muted" style="margin:6px 0 2px">رقم طلبك</p>
          <p class="num" style="margin:0" dir="ltr">${esc(s.orderId)}</p>
          <p class="muted">بنراجع الطلب وبنبعتلك عالواتساب موعد التوصيل.</p>
          ${wa ? `<a class="btn wa block" href="${escAttr(wa)}" target="_blank" rel="noopener">${ICON.wa} ابعتلنا طلبك عالواتساب</a>
                  <p class="hint" style="margin:8px 0 0">بتوصلنا رسالة جاهزة فيها تفاصيل طلبك، فبنأكده أسرع.</p>` : ""}
        </section>` : ""}
      <section class="panel-card stack" aria-label="حالة الطلب">
        <div style="display:flex;justify-content:space-between;align-items:baseline">
          <b>حالة الطلب</b><span class="num" style="font-size:16px" dir="ltr">${esc(s.orderId)}</span>
        </div>
        ${s.status === "cancelled"
          ? `<p class="notice" style="margin:0">انلغى هالطلب. إذا عندك سؤال تواصل معنا عالواتساب.</p>`
          : `<ol class="steps">${steps.map((st, i) => `
              <li class="${i < at || s.status === "delivered" ? "done-step" : ""} ${i === at && s.status !== "delivered" ? "now" : ""}">
                <span class="dot">${i < at || s.status === "delivered" ? "✓" : ""}</span>
                <div><b>${esc(st.title)}</b><span>${esc(st.key === "confirmed" && when ? "موعد التوصيل: " + when : st.sub)}</span></div>
              </li>`).join("")}</ol>`}
      </section>
      <a class="btn ghost" href="shop.html">رجوع للمتجر</a>`;
  }
}
