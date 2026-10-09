// قوائم الاختيار (select) بشكل البراند بدل شكل ويندوز/أندرويد العادي.
// عاللابتوب بتفتح قائمة صغيرة تحت الخانة، وعالموبايل بتطلع من تحت كـ "شيت".
// الـ <select> الأصلي بيضل موجود ومخفي، فكل الكود اللي بيقرأ .value أو بيسمع change بيضل شغّال زي ما هو.
// بيشتغل لحاله على أي select بالصفحة (حتى اللي بينضاف بعدين). لو بدك واحد يضل عادي حطله data-native.
import { esc } from "./util.js";

const STYLE = `
.fs{position:relative;display:block;min-width:0}
.fs-native{position:absolute!important;inset:0;width:100%!important;height:100%!important;opacity:0;pointer-events:none}
.fs-btn{display:flex!important;align-items:center;justify-content:space-between;gap:10px;text-align:start;cursor:pointer;width:100%}
.fs-btn:disabled{opacity:.55;cursor:not-allowed}
.fs-val{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fs-btn.is-ph .fs-val{color:var(--ink-soft,#6B6150)}
.fs-chev{flex:none;width:30px;height:30px;border-radius:10px;display:flex;align-items:center;justify-content:center;background:rgba(79,107,42,.09);color:var(--olive-deep,#33461B);transition:transform .2s,background .2s;margin-inline-end:-6px}
.fs-chev svg{width:16px;height:16px}
.fs-btn[aria-expanded="true"]{border-color:var(--olive,#4F6B2A);box-shadow:0 0 0 3px rgba(79,107,42,.15)}
.fs-btn[aria-expanded="true"] .fs-chev{transform:rotate(180deg);background:var(--olive,#4F6B2A);color:#FBF8F1}
.fs-pop{position:fixed;z-index:1000;box-sizing:border-box;background:var(--paper,var(--card,#FBF8F1));border:1px solid var(--line-strong,var(--line-2,#D9C9AC));border-radius:16px;box-shadow:0 18px 50px rgba(42,36,24,.18),0 2px 6px rgba(42,36,24,.06);padding:6px;overflow:auto;overscroll-behavior:contain;max-height:320px;animation:fs-in .16s ease-out;color:var(--ink,#2A2418)}
.fs-opt{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:44px;padding:8px 12px;border:0;border-radius:11px;background:transparent;color:inherit;font:inherit;font-weight:500;text-align:start;cursor:pointer;line-height:1.45}
.fs-opt+.fs-opt{margin-top:2px}
.fs-opt:hover,.fs-opt:focus-visible{background:rgba(79,107,42,.08);outline:none}
.fs-opt[aria-selected="true"]{background:var(--leaf-soft,#DDE8C4);color:var(--olive-deep,#33461B);font-weight:700}
.fs-opt .tick{flex:none;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:1.5px solid var(--line-strong,var(--line-2,#D9C9AC))}
.fs-opt .tick svg{width:13px;height:13px;opacity:0}
.fs-opt[aria-selected="true"] .tick{background:var(--olive,#4F6B2A);border-color:var(--olive,#4F6B2A);color:#FBF8F1}
.fs-opt[aria-selected="true"] .tick svg{opacity:1}
.fs-opt:disabled{opacity:.45;cursor:not-allowed}
.fs-backdrop{position:fixed;inset:0;z-index:999;background:rgba(29,25,18,.4);animation:fs-fade .2s ease-out}
.fs-pop.is-sheet{inset:auto 0 0 0;width:auto!important;max-height:72vh;border:0;border-radius:24px 24px 0 0;padding:6px 12px calc(16px + env(safe-area-inset-bottom,0px));animation:fs-up .24s cubic-bezier(.2,.8,.2,1)}
.fs-pop.is-sheet::before{content:"";display:block;width:42px;height:4px;border-radius:2px;background:var(--line-strong,var(--line-2,#D9C9AC));margin:6px auto 4px}
.fs-head{font-weight:700;font-size:17px;padding:8px 6px 12px}
.fs-pop.is-sheet .fs-opt{min-height:54px;font-size:16px;padding-inline:14px;border-radius:14px}
@keyframes fs-in{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
@keyframes fs-up{from{transform:translateY(100%)}to{transform:none}}
@keyframes fs-fade{from{opacity:0}to{opacity:1}}
@media (prefers-reduced-motion:reduce){.fs-pop,.fs-backdrop{animation:none}}
`;

const CHEV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
const TICK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

const VALUE = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
const INDEX = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "selectedIndex");

let styled = false;
let current = null;   // القائمة المفتوحة هلأ
let uid = 0;

function addStyle() {
  if (styled) return;
  styled = true;
  const s = document.createElement("style");
  s.textContent = STYLE;
  document.head.append(s);
}

function titleOf(sel) {
  if (sel.dataset.title) return sel.dataset.title;
  if (sel.id) {
    const l = document.querySelector(`label[for="${CSS.escape(sel.id)}"]`);
    if (l) return l.textContent.trim();
  }
  return sel.getAttribute("aria-label") || "";
}

export function enhance(sel) {
  if (!(sel instanceof HTMLSelectElement) || sel.dataset.fancy || sel.multiple || sel.size > 1 || sel.hasAttribute("data-native")) return;
  sel.dataset.fancy = "1";
  addStyle();

  const wrap = document.createElement("div");
  wrap.className = "fs";
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "fs-btn " + sel.className;
  btn.setAttribute("aria-haspopup", "listbox");
  btn.setAttribute("aria-expanded", "false");
  btn.id = "fs" + ++uid;
  btn.innerHTML = `<span class="fs-val"></span><span class="fs-chev">${CHEV}</span>`;
  sel.parentNode.insertBefore(wrap, sel);
  wrap.append(sel, btn);
  sel.classList.add("fs-native");
  sel.tabIndex = -1;
  sel.setAttribute("aria-hidden", "true");
  const t = titleOf(sel);
  if (t) btn.setAttribute("aria-label", t);

  const sync = () => {
    const o = sel.options[sel.selectedIndex];
    btn.querySelector(".fs-val").textContent = o ? o.textContent : "";
    btn.classList.toggle("is-ph", !o || o.value === "");
    btn.disabled = sel.disabled;
  };
  // لما الكود يغيّر القيمة بنفسه (sel.value = ...) الزر بيتحدث كمان
  Object.defineProperty(sel, "value", { configurable: true, get() { return VALUE.get.call(this); }, set(v) { VALUE.set.call(this, v); sync(); } });
  Object.defineProperty(sel, "selectedIndex", { configurable: true, get() { return INDEX.get.call(this); }, set(v) { INDEX.set.call(this, v); sync(); } });
  new MutationObserver(sync).observe(sel, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["disabled", "selected"] });
  sel.addEventListener("change", sync);

  btn.addEventListener("click", () => (current?.sel === sel ? close() : open(sel, btn)));
  btn.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); open(sel, btn); }
  });
  if (sel.id) {
    document.querySelectorAll(`label[for="${CSS.escape(sel.id)}"]`).forEach((l) => {
      l.htmlFor = btn.id;   // كبسة على العنوان بتروح عالزر
    });
  }
  sel.focus = (o) => btn.focus(o);   // لو الكود عمل focus عالـ select (زي رسالة خطأ) بيروح عالزر
  sync();
}

function place(pop, btn) {
  const r = btn.getBoundingClientRect();
  const w = Math.max(r.width, 200);
  pop.style.width = w + "px";
  const rtl = getComputedStyle(btn).direction === "rtl";
  const left = Math.max(8, Math.min(rtl ? r.right - w : r.left, innerWidth - w - 8));
  pop.style.left = left + "px";
  const below = innerHeight - r.bottom - 12;
  const above = r.top - 12;
  const h = Math.min(pop.scrollHeight, 320);
  if (below >= h || below >= above) {
    pop.style.top = r.bottom + 6 + "px";
    pop.style.maxHeight = Math.min(320, below) + "px";
  } else {
    const mh = Math.min(320, above);
    pop.style.maxHeight = mh + "px";
    pop.style.top = r.top - 6 - Math.min(h, mh) + "px";
  }
}

function open(sel, btn) {
  close();
  const sheet = matchMedia("(max-width: 640px)").matches;
  const pop = document.createElement("div");
  pop.className = "fs-pop" + (sheet ? " is-sheet" : "");
  pop.setAttribute("role", "listbox");
  const title = titleOf(sel);
  if (title) pop.setAttribute("aria-label", title);
  const opts = [...sel.options].map((o, i) => {
    if (o.hidden || (o.value === "" && i === 0 && sel.options.length > 1)) return "";   // خيار "اختار..." ما بينعرض بالقائمة
    return `<button type="button" role="option" class="fs-opt" data-i="${i}" aria-selected="${i === sel.selectedIndex}" ${o.disabled ? "disabled" : ""}><span>${esc(o.textContent)}</span><span class="tick">${TICK}</span></button>`;
  }).join("");
  pop.innerHTML = (sheet && title ? `<div class="fs-head">${esc(title)}</div>` : "") + opts;

  let back = null;
  if (sheet) {
    back = document.createElement("div");
    back.className = "fs-backdrop";
    back.addEventListener("click", close);
    document.body.append(back);
  }
  document.body.append(pop);
  if (!sheet) place(pop, btn);
  btn.setAttribute("aria-expanded", "true");

  pop.addEventListener("click", (e) => {
    const o = e.target.closest(".fs-opt");
    if (!o || o.disabled) return;
    const i = Number(o.dataset.i);
    const changed = i !== sel.selectedIndex;
    sel.selectedIndex = i;
    close();
    btn.focus({ preventScroll: true });
    if (changed) {
      sel.dispatchEvent(new Event("input", { bubbles: true }));
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
  pop.addEventListener("keydown", (e) => {
    const items = [...pop.querySelectorAll(".fs-opt:not(:disabled)")];
    const k = items.indexOf(document.activeElement);
    if (e.key === "ArrowDown") { e.preventDefault(); items[Math.min(items.length - 1, k + 1)]?.focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); items[Math.max(0, k - 1)]?.focus(); }
    else if (e.key === "Home") { e.preventDefault(); items[0]?.focus(); }
    else if (e.key === "End") { e.preventDefault(); items[items.length - 1]?.focus(); }
    else if (e.key === "Escape") { e.preventDefault(); close(); btn.focus(); }
    else if (e.key === "Tab") { close(); }
  });

  const onDown = (e) => { if (!pop.contains(e.target) && !btn.contains(e.target)) close(); };
  // لو الصفحة تحركت: القائمة بتلحق الخانة، وإذا الخانة طلعت برا الشاشة بتتسكّر
  const onScroll = (e) => {
    if (sheet || pop.contains(e.target)) return;
    const r = btn.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) close(); else place(pop, btn);
  };
  const onResize = () => close();
  document.addEventListener("pointerdown", onDown, true);
  addEventListener("scroll", onScroll, true);
  addEventListener("resize", onResize);
  if (sheet) document.documentElement.style.overflow = "hidden";

  current = {
    sel,
    close() {
      document.removeEventListener("pointerdown", onDown, true);
      removeEventListener("scroll", onScroll, true);
      removeEventListener("resize", onResize);
      if (sheet) document.documentElement.style.overflow = "";
      pop.remove();
      back?.remove();
      btn.setAttribute("aria-expanded", "false");
    },
  };
  const selOpt = pop.querySelector('.fs-opt[aria-selected="true"]');
  if (selOpt && selOpt.offsetTop + selOpt.offsetHeight > pop.clientHeight) pop.scrollTop = selOpt.offsetTop - pop.clientHeight / 2;
  (selOpt || pop.querySelector(".fs-opt:not(:disabled)"))?.focus({ preventScroll: true });
}

function close() {
  if (!current) return;
  const c = current;
  current = null;
  c.close();
}

// أي select موجود أو بينضاف بعدين
function scan(root) {
  if (root.tagName === "SELECT") enhance(root);
  else root.querySelectorAll?.("select").forEach(enhance);
}
scan(document);
new MutationObserver((muts) => {
  for (const m of muts) for (const n of m.addedNodes) if (n.nodeType === 1) scan(n);
}).observe(document.documentElement, { childList: true, subtree: true });
