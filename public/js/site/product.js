import { esc, escAttr, money, arDigits, prettyDate } from "../util.js";
import { renderChrome, productCard, availability, availabilityLabel, cld, cart, toast, ICON, loadCatalog, netError } from "./common.js";

renderChrome("shop");

const $main = document.getElementById("main");
const id = new URLSearchParams(location.search).get("id");

let p = null;          // المنتج الحالي
let built = false;
const state = { size: 0, qty: 1, img: 0, video: false };
let imgs = [];

function notFound() {
  $main.innerHTML = `<div class="empty"><p>هاد الصنف مش موجود أو انشال.</p><a class="btn" href="shop.html">رجوع للمتجر</a></div>`;
}

function build(catName, related) {
  document.title = p.name + " · خضرة براند";
  imgs = (p.images || []).filter(Boolean);
  $main.innerHTML = `
    <div class="pgrid">
      <div class="gallery">
        <div class="main" id="mainMedia"></div>
        ${imgs.length > 1 ? `<div class="thumbs" id="thumbs">${imgs.map((u, i) =>
          `<button type="button" data-i="${i}" aria-label="صورة ${arDigits(i + 1)}"><img src="${escAttr(cld(u, 160))}" alt=""></button>`).join("")}</div>` : ""}
      </div>
      <div class="info">
        <a class="crumb" href="shop.html?cat=${encodeURIComponent(p.categoryId || "")}">${ICON.back}<span>${esc(catName || "المتجر")}</span></a>
        <h1>${esc(p.name)}</h1>
        <div class="pills" id="pills"></div>
        ${p.description ? `<p class="desc">${esc(p.description)}</p>` : ""}
        <div class="opt">
          <p class="lbl">الحجم</p>
          <div class="sizes" id="sizes" role="group" aria-label="الحجم"></div>
        </div>
        <div class="pricebox"><span class="price" id="price"></span><span class="old-price" id="old"></span></div>
        <div class="notice" id="preNote" hidden></div>
        <div class="buybar">
          <div class="stepper">
            <button type="button" id="inc" aria-label="زيد">${ICON.plus}</button>
            <output id="qty" aria-live="polite">١</output>
            <button type="button" id="dec" aria-label="نقّص">${ICON.minus}</button>
          </div>
          <button class="btn" type="button" id="add"></button>
        </div>
        ${(p.pairsWith || []).length ? `<div class="opt"><p class="lbl">بيزبط مع</p><div class="chips">${p.pairsWith.map((x) => `<span class="chip static">${esc(x)}</span>`).join("")}</div></div>` : ""}
        <div class="acc">
          ${p.ingredients ? `<details><summary>المكونات</summary><p>${esc(p.ingredients)}</p></details>` : ""}
          ${p.storage ? `<details open><summary>طريقة الحفظ</summary><p>${esc(p.storage)}</p></details>` : ""}
          <details><summary>التوصيل والدفع</summary><p>بعد ما يوصلنا طلبك، بنتواصل معك عالواتساب ونحدد موعد التوصيل. رسوم التوصيل بتنحسب حسب منطقتك بالسلة. الدفع كاش عند الاستلام أو تحويل بنكي.</p></details>
        </div>
      </div>
    </div>
    <section class="related" id="related" ${related.length ? "" : "hidden"}><div class="sec-h"><h2>كمان بتحب</h2></div>
      <div class="grid" id="relGrid">${related.map(productCard).join("")}</div></section>`;

  document.getElementById("thumbs")?.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-i]");
    if (!b) return;
    state.img = Number(b.dataset.i); state.video = false; renderMedia();
  });
  document.getElementById("sizes").addEventListener("click", (e) => {
    const b = e.target.closest("[data-i]");
    if (!b) return;
    state.size = Number(b.dataset.i); render();
  });
  document.getElementById("inc").addEventListener("click", () => { state.qty = Math.min(50, state.qty + 1); render(); });
  document.getElementById("dec").addEventListener("click", () => { state.qty = Math.max(1, state.qty - 1); render(); });
  document.getElementById("add").addEventListener("click", () => {
    const size = p.sizes[state.size];
    cart.add({ productId: p.id, sizeId: size.id, qty: state.qty, name: p.name, sizeLabel: size.label, image: imgs[0] || "" });
    toast(`انضاف للسلة: ${p.name} (${size.label})`);
  });
  renderMedia();
  render();
}

function renderMedia() {
  const $media = document.getElementById("mainMedia");
  if (state.video && p.video) {
    $media.innerHTML = `<video src="${escAttr(cld(p.video, 720))}" controls playsinline autoplay muted preload="metadata"></video>`;
  } else {
    const u = imgs[state.img];
    $media.innerHTML = (u ? `<img src="${escAttr(cld(u, 900))}" alt="${escAttr(p.name)}">` : "") +
      (p.video ? `<button class="vid-btn" type="button" id="vidBtn">${ICON.play} فيديو</button>` : "");
    document.getElementById("vidBtn")?.addEventListener("click", () => { state.video = true; renderMedia(); });
  }
  document.querySelectorAll("#thumbs button").forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.i) === state.img && !state.video)));
}

function render() {
  if (state.size >= p.sizes.length) state.size = 0;
  const size = p.sizes[state.size];
  const a = availability(p, size, state.qty);
  const lab = availabilityLabel(a);
  document.getElementById("pills").innerHTML =
    `<span class="pill ${lab.cls}">${esc(lab.text)}</span>` +
    (p.lastBatch?.date ? `<span class="pill batch">عُبّي ${esc(prettyDate(p.lastBatch.date))}</span>` : "");
  document.getElementById("sizes").innerHTML = p.sizes.map((s, i) =>
    `<button type="button" class="size" data-i="${i}" aria-pressed="${i === state.size}"><b>${esc(s.label)}</b><span>${money(s.price)}</span></button>`).join("");
  document.getElementById("price").textContent = money(size.price);
  document.getElementById("old").textContent = Number(size.oldPrice) > Number(size.price) ? money(size.oldPrice) : "";
  document.getElementById("qty").textContent = arDigits(state.qty);
  const pre = document.getElementById("preNote");
  pre.hidden = a.state !== "preorder";
  if (a.state === "preorder") pre.textContent = `هاد الصنف بيتعمل عالطلب${a.days ? ` وبياخد حوالي ${arDigits(a.days)} أيام` : ""}، والموعد بنأكده معك عالواتساب.`;
  const add = document.getElementById("add");
  add.disabled = a.state === "out";
  add.innerHTML = a.state === "out" ? "خلص حالياً" : `أضف للسلة <span class="sum">${money(size.price * state.qty)}</span>`;
}

function apply({ cats = [], products = [] }, final) {
  const np = products.find((x) => x.id === id);
  if (!np || !(np.sizes || []).length) { if (final || !built) { if (final) notFound(); } return; }
  p = np;
  if (!built) {
    built = true;
    const catName = cats.find((c) => c.id === p.categoryId)?.name || "";
    const related = products.filter((x) => x.categoryId === p.categoryId && x.id !== p.id).slice(0, 4);
    build(catName, related);
  } else {
    render();   // أسعار أو مخزون تغيّروا: بنحدّث بدون ما نخرب اختيار الزبون
  }
}

if (!id) notFound();
else {
  const { cached, fresh } = loadCatalog();
  if (cached) apply(cached, false);
  fresh.then((d) => apply(d, true)).catch((e) => { console.warn(e); if (!built) $main.innerHTML = netError(); });
}
