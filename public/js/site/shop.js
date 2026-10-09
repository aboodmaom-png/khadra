import { esc } from "../util.js";
import { renderChrome, productCard, minPrice, availability, loadCatalog, netError } from "./common.js";

renderChrome("shop");

const params = new URLSearchParams(location.search);
let cat = params.get("cat") || "";
let products = [], cats = [];

const $grid = document.getElementById("grid");
const $filters = document.getElementById("filters");
const $q = document.getElementById("q");
const $sort = document.getElementById("sort");

function render() {
  const term = $q.value.trim();
  let list = products.filter((p) => (!cat || p.categoryId === cat) && (!term || p.name.includes(term)));
  if ($sort.value === "low") list.sort((a, b) => minPrice(a) - minPrice(b));
  if ($sort.value === "high") list.sort((a, b) => minPrice(b) - minPrice(a));
  // اللي خلص بينزل لآخر القائمة
  list.sort((a, b) => (availability(a, a.sizes?.[0]).state === "out") - (availability(b, b.sizes?.[0]).state === "out"));
  $grid.innerHTML = list.map(productCard).join("") || `<p class="empty" style="grid-column:1/-1">ما في أصناف هون حالياً.</p>`;

  $filters.innerHTML = [{ id: "", name: "الكل" }, ...cats].map((c) =>
    `<button class="chip" type="button" data-cat="${esc(c.id)}" aria-pressed="${c.id === cat}">${esc(c.name)}</button>`).join("");
  const c = cats.find((x) => x.id === cat);
  document.getElementById("title").textContent = c ? c.name : "المتجر";
  document.title = (c ? c.name : "المتجر") + " · خضرة براند";
}

$filters.addEventListener("click", (e) => {
  const b = e.target.closest("[data-cat]");
  if (!b) return;
  cat = b.dataset.cat;
  const u = new URL(location.href);
  if (cat) u.searchParams.set("cat", cat); else u.searchParams.delete("cat");
  history.replaceState(null, "", u);
  render();
});
$q.addEventListener("input", render);
$sort.addEventListener("change", render);

const apply = (d) => { cats = d.cats || []; products = d.products || []; render(); };
const { cached, fresh } = loadCatalog();
if (cached) apply(cached);
fresh.then(apply).catch((e) => { console.warn(e); if (!cached) $grid.innerHTML = netError(); });
