// إعدادات المتجر
import { doc, setDoc, serverTimestamp } from "../fb.js";
import { adb, S, subscribe } from "./state.js";
import { toast, num } from "./ui.js";
import { esc, escAttr } from "../util.js";
import { DEFAULT_WA_TEMPLATES } from "../constants.js";

let el = null;
let dirty = false;

const TPL_LABELS = {
  confirmed: "رسالة التأكيد",
  out: "طلع للتوصيل",
  delivered: "بعد التوصيل",
  cancelled: "الإلغاء",
  transfer: "بيانات التحويل البنكي",
};

export function init(root) {
  el = root;
  subscribe((k) => { if (k === "settings" && !dirty) render(); });
  el.addEventListener("input", () => { dirty = true; });
  el.addEventListener("change", () => { dirty = true; });
  el.addEventListener("click", (e) => { if (e.target.id === "sSave") save(e.target); });
  render();
}

function render() {
  if (!el) return;
  const s = S.settings || {};
  const tpls = { ...DEFAULT_WA_TEMPLATES, ...(s.waTemplates || {}) };
  el.innerHTML = `
    <div class="stack">
      <div class="box stack">
        <h3>المتجر</h3>
        <label class="check"><input type="checkbox" id="sOpen" ${s.storeOpen !== false ? "checked" : ""}> المتجر فاتح ويستقبل طلبات</label>
        <div class="field"><label for="sClosed">الرسالة لما يكون مسكّر</label><input class="input" id="sClosed" value="${escAttr(s.closedMessage || "")}"></div>
        <label class="check"><input type="checkbox" id="sAnnOn" ${s.announcement?.active ? "checked" : ""}> شريط إعلان فوق الموقع</label>
        <div class="field"><label for="sAnn">نص الإعلان</label><input class="input" id="sAnn" value="${escAttr(s.announcement?.text || "")}" placeholder="مثلاً: التوصيل مجاني لآخر الأسبوع"></div>
      </div>

      <div class="box stack">
        <h3>الواتساب والتوصيل</h3>
        <div class="row2">
          <div class="field"><label for="sWa">رقم واتساب المتجر</label><input class="input" id="sWa" dir="ltr" inputmode="tel" value="${escAttr(s.whatsapp || "")}" placeholder="0599000000"></div>
          <div class="field"><label for="sCc">مفتاح الدولة</label><input class="input" id="sCc" dir="ltr" inputmode="numeric" value="${escAttr(s.countryCode || "970")}"></div>
        </div>
        <div class="field"><label for="sFree">التوصيل مجاني فوق (₪) · صفر = بدون</label><input class="input" id="sFree" type="number" inputmode="decimal" min="0" value="${escAttr(s.freeDeliveryMin ?? 0)}"></div>
        <div class="field"><label for="sSlots">أوقات التوصيل (افصل بفاصلة)</label><input class="input" id="sSlots" value="${escAttr((s.timeSlots || []).join("، "))}" placeholder="الصبح، العصر"></div>
      </div>

      <div class="box stack">
        <h3>الدفع</h3>
        <label class="check"><input type="checkbox" id="sCash" ${s.payMethods?.cash !== false ? "checked" : ""}> كاش عند الاستلام</label>
        <label class="check"><input type="checkbox" id="sTr" ${s.payMethods?.transfer ? "checked" : ""}> تحويل بنكي</label>
        <div class="field"><label for="sTrInfo">بيانات الحساب البنكي (بتنبعت للزبون عالواتساب)</label><textarea class="input" id="sTrInfo" rows="3" placeholder="اسم البنك، اسم صاحب الحساب، رقم الحساب أو IBAN">${esc(s.transferInfo || "")}</textarea></div>
      </div>

      <div class="box stack">
        <h3>رسائل الواتساب الجاهزة</h3>
        <p class="hint">المتغيرات: {الاسم} {رقم_الطلب} {الموعد} {المجموع} {رابط_التتبع} {السبب} {تفاصيل_التحويل}</p>
        ${Object.entries(TPL_LABELS).map(([k, l]) => `<div class="field"><label for="t-${k}">${l}</label><textarea class="input" id="t-${k}" rows="3">${esc(tpls[k] || "")}</textarea></div>`).join("")}
      </div>

      <p class="err" id="sErr" hidden></p>
      <button class="btn block" type="button" id="sSave">احفظ الإعدادات</button>
    </div>`;
  dirty = false;
}

async function save(btn) {
  const v = (id) => document.getElementById(id).value;
  const c = (id) => document.getElementById(id).checked;
  const err = document.getElementById("sErr");
  const cash = c("sCash"), transfer = c("sTr");
  if (!cash && !transfer) { err.hidden = false; err.textContent = "لازم طريقة دفع وحدة على الأقل"; return; }
  err.hidden = true;
  btn.disabled = true;
  const waTemplates = {};
  Object.keys(TPL_LABELS).forEach((k) => (waTemplates[k] = v("t-" + k)));
  try {
    await setDoc(doc(adb, "settings", "main"), {
      storeOpen: c("sOpen"),
      closedMessage: v("sClosed").trim(),
      announcement: { active: c("sAnnOn"), text: v("sAnn").trim() },
      whatsapp: v("sWa").trim(),
      countryCode: v("sCc").replace(/\D/g, "") || "970",
      freeDeliveryMin: Math.max(0, num(v("sFree"), 0)),
      timeSlots: v("sSlots").split(/[,،]/).map((x) => x.trim()).filter(Boolean),
      payMethods: { cash, transfer },
      transferInfo: v("sTrInfo").trim(),
      waTemplates,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    dirty = false;
    toast("انحفظت الإعدادات");
  } catch (e) {
    console.error(e);
    toast("ما انحفظت", true);
  } finally {
    btn.disabled = false;
  }
}

export function show() { if (!dirty) render(); }
