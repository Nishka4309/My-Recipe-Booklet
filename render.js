// Recipe helpers shared by the browser app (app.js) and the static page builder (build.mjs),
// so a recipe looks the same in the booklet and on its own page.
(function (g) {
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const slugify = (s) => String(s).toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  // Page ids the app already uses; a recipe may not take one of these as its slug.
  const RESERVED = ["cover", "contents", "list", "about", "add"];

  // Gives each recipe a unique slug, in list order. Builder and app call this with the same
  // recipes.js list first, so a recipe's static page and its booklet page share one slug.
  function withSlugs(list) {
    const used = new Set(RESERVED);
    return list.map((r, i) => {
      const base = slugify(r.title) || "recipe";
      let slug = base, k = 2;
      while (used.has(slug)) slug = `${base}-${k++}`;
      used.add(slug);
      return { ...r, n: i + 1, slug };
    });
  }

  const stats = (r) => [
    r.cuisine && `<span class="stat">${esc(r.cuisine)}</span>`,
    r.protein && `<span class="stat"><b>Protein</b> ${esc(r.protein)}</span>`,
    r.fibre && `<span class="stat"><b>Fibre</b> ${esc(r.fibre)}</span>`,
    r.time && `<span class="stat"><b>Time</b> ${esc(r.time)}</span>`,
    r.makes && `<span class="stat"><b>Makes</b> ${esc(r.makes)}</span>`,
  ].filter(Boolean).join("");

  const metaLine = (r) => [r.cuisine, r.protein && `${r.protein} protein`].filter(Boolean).map(esc).join(" · ");

  const ingredientList = (r) => (r.ingredients || []).filter((x) => !x.startsWith("## "));

  // Method steps as plain sentences, e.g. for search engines.
  const stepTexts = (r) => (r.method || []).map((x) =>
    typeof x === "string" ? x : `${x.step}: ${[].concat(x.text).join(" ")}`);

  const ingredientsHtml = (r) => (r.ingredients || []).map((x) => x.startsWith("## ")
    ? `<li class="ing-head">${esc(x.slice(3))}</li>`
    : `<li><label><input type="checkbox"><span>${esc(x)}</span></label></li>`).join("");

  const methodHtml = (r) => (r.method || []).map((x) => typeof x === "string" ? `<li>${esc(x)}</li>`
    : `<li><b class="step-title">${esc(x.step)}</b>${[].concat(x.text).map((t) => `<p>${esc(t)}</p>`).join("")}</li>`).join("");

  const bodyHtml = (r) => `<div class="cols">
        <div><h3>Ingredients</h3><ul class="ingredients">${ingredientsHtml(r)}</ul></div>
        <div><h3>Method</h3><ol class="method">${methodHtml(r)}</ol>
          ${r.tip ? `<div class="tip"><b>Tip:</b> ${esc(r.tip)}</div>` : ""}</div>
      </div>`;

  g.RecipeKit = { esc, slugify, RESERVED, withSlugs, stats, metaLine, ingredientList, stepTexts, bodyHtml };
})(globalThis);
