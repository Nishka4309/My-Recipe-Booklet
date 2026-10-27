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

  // The recipe's numbers as a food-label style panel.
  const facts = (r) => {
    const rows = [["Protein", r.protein], ["Fibre", r.fibre], ["Time", r.time], ["Makes", r.makes]].filter(([, v]) => v);
    return rows.length ? `<dl class="facts">${rows.map(([k, v], i) =>
      `<div class="fact${i === 0 ? " fact-lead" : ""}"><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>` : "";
  };

  // "~20–25g per wrap" → "20–25g"; used where protein is shown as a headline number.
  const proteinShort = (r) => {
    const m = String(r.protein || "").match(/(\d+)(?:\s*[–-]\s*(\d+))?\s*g/);
    return m ? `${m[1]}${m[2] ? "–" + m[2] : ""}g` : "";
  };

  const metaLine = (r) => [r.cuisine, r.time].filter(Boolean).map(esc).join(" · ");

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

  // Interface icons as inline SVG (stroke follows the text colour), never emoji.
  const svg = (d) => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${d}"/></svg>`;
  const icon = {
    plus: svg("M12 5v14M5 12h14"),
    check: svg("M5 12.5l4.5 4.5L19 7.5"),
    left: svg("M19 12H5M11 6l-6 6 6 6"),
    right: svg("M5 12h14M13 6l6 6-6 6"),
    close: svg("M6 6l12 12M18 6L6 18"),
    share: svg("M12 15V3M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"),
  };

  g.RecipeKit = { icon, esc, slugify, RESERVED, withSlugs, facts, proteinShort, metaLine, ingredientList, stepTexts, bodyHtml };
})(globalThis);
