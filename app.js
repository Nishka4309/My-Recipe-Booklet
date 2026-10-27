(function () {
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const slugify = (s) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } };
  const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

  const book = document.getElementById("book");

  // Editing tools are hidden from visitors. Open the site once with ?owner to turn them on
  // in that browser (?owner=off turns them off again).
  const params = new URLSearchParams(location.search);
  if (params.has("owner")) {
    store("recipe-booklet-owner", params.get("owner") !== "off");
    history.replaceState(null, "", location.pathname + location.hash);
  }
  const owner = load("recipe-booklet-owner", false);
  const FILE = window.RECIPES || [];

  // Recipes added on the website live in this browser until exported into recipes.js.
  // Once a recipe with the same title is in the file, the browser copy is dropped.
  const ADDED = "recipe-booklet-added";
  const inFile = new Set(FILE.map((r) => r.title.trim().toLowerCase()));
  let added = load(ADDED, []).filter((r) => !inFile.has(r.title.trim().toLowerCase()));
  store(ADDED, added);

  const PICKED = "recipe-booklet-picked";
  let picked = new Set(load(PICKED, []));
  const savePicked = () => store(PICKED, [...picked]);

  let recipes = [], bySlug = {}, cuisines = [];
  let filter = { q: "", cuisine: "" };
  let editingId = null;

  const stats = (r) => [
    r.cuisine && `<span class="stat">${esc(r.cuisine)}</span>`,
    r.protein && `<span class="stat"><b>Protein</b> ${esc(r.protein)}</span>`,
    r.fibre && `<span class="stat"><b>Fibre</b> ${esc(r.fibre)}</span>`,
    r.time && `<span class="stat"><b>Time</b> ${esc(r.time)}</span>`,
    r.makes && `<span class="stat"><b>Makes</b> ${esc(r.makes)}</span>`,
  ].filter(Boolean).join("");

  const pickBtn = (r, small) =>
    `<button class="btn pick${small ? " pick-sm" : ""}" data-pick="${r.slug}" aria-pressed="false"></button>`;

  const proteinMax = (r) => Math.max(0, ...(String(r.protein || "").match(/\d+/g) || []).map(Number));

  const card = (r) => `<a class="card" href="#${r.slug}">
      <span class="card-emoji">${esc(r.emoji || "🍽️")}</span>
      <span class="card-title">${esc(r.title)}</span>
      <span class="card-meta">${[r.cuisine, r.protein && r.protein + " protein"].filter(Boolean).map(esc).join(" · ")}</span>
    </a>`;

  function coverPage() {
    const top = Math.max(0, ...recipes.map(proteinMax));
    const latest = recipes.slice(-3).reverse();
    return `<section class="page cover" id="p-cover" aria-labelledby="hero-title">
      <div class="hero">
        <p class="eyebrow">High-protein · vegetarian · weeknight-fast</p>
        <h1 id="hero-title">Eat well.<br>Hit your protein.</h1>
        <p class="lede">${recipes.length} simple recipes built around tofu, paneer, beans and Greek yogurt — with protein and fibre for every dish, up to ~${top}g a plate.</p>
        <div class="hero-cta">
          <button class="btn primary big" data-go="contents">Browse recipes →</button>
          <button class="btn big" data-go="list">Build a shopping list</button>
        </div>
      </div>
      <h2 class="section-title">Newest recipes</h2>
      <div class="cards">${latest.map(card).join("")}</div>
      <h2 class="section-title">How it works</h2>
      <ol class="how">
        <li><b>Pick your meals</b><span>Tap ＋ on any recipes you want to cook this week.</span></li>
        <li><b>Get one list</b><span>Ingredients are combined into a single shopping list you can copy or print.</span></li>
        <li><b>Cook</b><span>Short, numbered steps — most dishes take 15–20 minutes.</span></li>
      </ol>
    </section>`;
  }

  function aboutPage() {
    return `<section class="page" id="p-about">
      <div class="page-top"><button class="btn back" data-go="contents">← All recipes</button></div>
      <h2>About this booklet</h2>
      <div class="prose">
        <p>My Recipe Booklet is a growing collection of vegetarian meals that are quick to make and high in protein. Most recipes lean on tofu, paneer, beans, chickpeas and Greek yogurt, and borrow flavours from Indian, Mexican, Korean, Thai and Italian cooking.</p>
        <p>Every recipe lists an approximate protein and fibre figure, so you can plan meals around your goals. Pick a few recipes and the booklet builds one combined shopping list for you.</p>
        <p class="fine">Nutrition figures are estimates. They change with the brands, portions and swaps you use, so treat them as a guide rather than medical or dietary advice.</p>
      </div>
      <button class="btn primary" data-go="contents">Browse the recipes →</button>
    </section>`;
  }

  function contentsPage() {
    const chips = cuisines.map((c) =>
      `<button class="btn chip" data-cuisine="${esc(c)}">${esc(c)}</button>`).join("");
    const unsaved = owner && added.length ? `<div class="notice">
        <span><b>${added.length} recipe${added.length === 1 ? "" : "s"} you added</b> ${added.length === 1 ? "is" : "are"} saved in this browser only.
        To keep ${added.length === 1 ? "it" : "them"} for good, download <code>recipes.js</code> and replace the one in your recipes folder.</span>
        <button class="btn" data-export>Download recipes.js</button></div>` : "";
    return `<section class="page" id="p-contents">
      <div class="title-row"><h2>Recipes</h2>
        ${owner ? `<button class="btn primary" data-new>＋ Add a recipe</button>` : ""}</div>
      <p class="sub">Tap a recipe to open it, or <b>＋</b> to add it to your shopping list.</p>
      ${unsaved}
      <div class="controls">
        <input class="search" type="search" placeholder="Search recipes or ingredients…" aria-label="Search">
        <button class="btn chip on" data-cuisine="">All</button>${chips}
      </div>
      <ol class="toc"></ol>
    </section>`;
  }

  function renderToc() {
    const q = filter.q.toLowerCase();
    const list = recipes.filter((r) =>
      (!filter.cuisine || r.cuisine === filter.cuisine) &&
      (!q || [r.title, r.cuisine, ...(r.ingredients || [])].join(" ").toLowerCase().includes(q)));
    book.querySelector(".toc").innerHTML = list.length
      ? list.map((r) => `<li><a href="#${r.slug}">
          <span class="toc-emoji">${esc(r.emoji || "🍽️")}</span>
          <span><span class="toc-title">${esc(r.title)}</span>
            <span class="toc-meta">${[r.cuisine, r.protein && "Protein " + r.protein].filter(Boolean).map(esc).join(" · ")}</span></span>
          <span class="toc-num">${r.n}</span></a>${pickBtn(r, true)}</li>`).join("")
      : `<li class="empty">No recipes match.</li>`;
    syncPicks();
  }

  function recipePage(r) {
    const ing = (r.ingredients || []).map((x) => x.startsWith("## ")
      ? `<li class="ing-head">${esc(x.slice(3))}</li>`
      : `<li><label><input type="checkbox"><span>${esc(x)}</span></label></li>`).join("");
    const steps = (r.method || []).map((x) => typeof x === "string" ? `<li>${esc(x)}</li>`
      : `<li><b class="step-title">${esc(x.step)}</b>${[].concat(x.text).map((t) => `<p>${esc(t)}</p>`).join("")}</li>`).join("");
    const own = owner && r.custom ? `<span class="own">Added in this browser
        <button class="link" data-edit="${esc(r.id)}">Edit</button>
        <button class="link danger" data-delete="${esc(r.id)}">Delete</button></span>` : "";
    return `<section class="page" id="p-${r.slug}">
      <div class="page-top"><button class="btn back" data-go="contents">← All recipes</button>${own}</div>
      <div class="recipe-head">
        <div class="recipe-no">Recipe ${r.n}</div>
        <h2><span class="e">${esc(r.emoji || "🍽️")}</span>${esc(r.title)}</h2>
        <div class="stats">${stats(r)}</div>
        <div class="head-pick">${pickBtn(r)}</div>
      </div>
      <div class="cols">
        <div><h3>Ingredients</h3><ul class="ingredients">${ing}</ul></div>
        <div><h3>Method</h3><ol class="method">${steps}</ol>
          ${r.tip ? `<div class="tip"><b>Tip:</b> ${esc(r.tip)}</div>` : ""}</div>
      </div>
      <div class="folio">— ${r.n} —</div>
    </section>`;
  }

  // ── combining ingredients ──
  // "150–200g firm tofu" → { qty: "150–200g", name: "firm tofu" }
  const QTY = /^([\d¼½¾⅓⅔⅛.\/]+(?:\s*[–-]\s*[\d¼½¾⅓⅔⅛.\/]+)?\s*(?:g|kg|ml|l|cups?|tbsp|tsp|servings?|cans?|cloves?|pieces?|slices?|(?:large |small )?handfuls?)?)(?=\s)\s+(.*)$/i;
  const keyOf = (name) => name.toLowerCase().replace(/^((firm|cooked|chopped|fresh|canned|grated|large|small)\s+)+/, "").replace(/\s+cloves?$/, "").replace(/^rajma$/, "red kidney beans").trim();

  function shoppingList() {
    const items = new Map();
    recipes.filter((r) => picked.has(r.slug)).forEach((r) => {
      (r.ingredients || []).filter((line) => !line.startsWith("## ")).forEach((line) => {
        line.replace(/\s+—.*$/, "").split(/\s+\+\s+/).forEach((part) => {
          const m = part.trim().match(QTY);
          const qty = m ? m[1] : "";
          const name = (m ? m[2] : part).replace(/\s+—.*$|,.*$/, "").replace(/^(large|small|canned)\s+/i, "").trim();
          const key = keyOf(name);
          if (!items.has(key)) items.set(key, { name: cap(name), uses: [] });
          const it = items.get(key);
          if (name.length < it.name.length) it.name = cap(name);
          it.uses.push({ qty, r });
        });
      });
    });
    return [...items.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  function listPage() {
    return `<section class="page" id="p-list">
      <div class="page-top"><button class="btn back" data-go="contents">← All recipes</button></div>
      <h2>🛒 Shopping list</h2>
      <p class="sub">Everything you need for the recipes you picked, combined.</p>
      <div class="list-body"></div>
    </section>`;
  }

  function renderList() {
    const body = book.querySelector("#p-list .list-body");
    const chosen = recipes.filter((r) => picked.has(r.slug));
    if (!chosen.length) {
      body.innerHTML = `<div class="empty-list"><p>No recipes picked yet.</p>
        <button class="btn primary" data-go="contents">Choose recipes →</button></div>`;
      return;
    }
    const items = shoppingList();
    body.innerHTML = `
      <div class="chosen">${chosen.map((r) =>
        `<span class="chosen-chip">${esc(r.emoji || "🍽️")} ${esc(r.title)}
          <button data-pick="${r.slug}" aria-label="Remove ${esc(r.title)}">×</button></span>`).join("")}</div>
      <div class="list-actions">
        <span class="count">${items.length} items · ${chosen.length} recipe${chosen.length === 1 ? "" : "s"}</span>
        <span><button class="btn" id="copy">Copy list</button>
        <button class="btn" data-print>Print</button>
        <button class="btn" id="clear">Clear</button></span>
      </div>
      <ul class="ingredients shop">${items.map((it) => {
        const qtys = it.uses.map((u) => u.qty).filter(Boolean);
        return `<li><label><input type="checkbox"><span>
          <span class="shop-name">${esc(it.name)}</span>
          ${qtys.length ? `<span class="shop-qty">${esc(qtys.join(" + "))}</span>` : ""}
          <span class="shop-for">${it.uses.map((u) => `<span title="${esc(u.r.title)}">${esc(u.r.emoji || "🍽️")}</span>`).join("")}</span>
        </span></label></li>`;
      }).join("")}</ul>`;
  }

  function listAsText() {
    const chosen = recipes.filter((r) => picked.has(r.slug)).map((r) => r.title);
    const lines = shoppingList().map((it) => {
      const q = it.uses.map((u) => u.qty).filter(Boolean);
      return `- ${it.name}${q.length ? ` (${q.join(" + ")})` : ""}`;
    });
    return `Shopping list\nFor: ${chosen.join(", ")}\n\n${lines.join("\n")}`;
  }

  function syncPicks() {
    document.querySelectorAll("button.pick").forEach((b) => {
      const on = picked.has(b.dataset.pick);
      b.classList.toggle("on", on);
      b.setAttribute("aria-pressed", on);
      b.textContent = b.classList.contains("pick-sm") ? (on ? "✓" : "＋")
        : (on ? "✓ On shopping list" : "＋ Add to shopping list");
      b.title = on ? "Remove from shopping list" : "Add to shopping list";
    });
    const cart = document.getElementById("cart");
    cart.textContent = `🛒 List${picked.size ? ` (${picked.size})` : ""}`;
    cart.classList.toggle("has", picked.size > 0);
  }

  // ── adding recipes ──
  function addPage() {
    const f = (name, label, ph) =>
      `<label class="f"><span>${label}</span><input name="${name}" placeholder="${ph}"></label>`;
    return `<section class="page" id="p-add">
      <div class="page-top"><button class="btn back" data-go="contents">← All recipes</button></div>
      <h2 class="add-title">Add a recipe</h2>
      <p class="sub">Paste a recipe the way you'd send it in a message, tap <b>Fill in the form</b>, check it, then save.</p>
      <textarea id="paste" class="paste" rows="6" placeholder="Paste the whole recipe here…"></textarea>
      <div class="paste-row"><button class="btn" id="parse">Fill in the form ↓</button><span id="parse-msg" class="hint"></span></div>
      <form id="rform" class="rform" autocomplete="off">
        <div class="grid">
          <label class="f wide"><span>Title *</span><input name="title" required placeholder="Spicy Tofu Wrap"></label>
          ${f("emoji", "Emoji", "🌯")}
          ${f("cuisine", "Cuisine", "Indian")}
          ${f("protein", "Protein", "~25g")}
          ${f("fibre", "Fibre", "High")}
          ${f("time", "Time", "20 min")}
          ${f("makes", "Makes / serves", "2 wraps")}
        </div>
        <label class="f"><span>Ingredients</span>
          <small>One per line. Start a line with <code>##</code> for a heading, e.g. <code>## For the sauce</code></small>
          <textarea name="ingredients" rows="10" placeholder="200g firm tofu&#10;1 tomato&#10;## For the sauce&#10;2 tbsp Greek yogurt"></textarea></label>
        <label class="f"><span>Method</span>
          <small>One step per line. For a titled step, write <code>## Title</code>, its lines underneath, then a blank line.</small>
          <textarea name="method" rows="10" placeholder="## Make the filling&#10;Crumble the tofu.&#10;Fry with spices for 3 minutes.&#10;&#10;Warm the wrap.&#10;Fill and roll."></textarea></label>
        <label class="f"><span>Tip (optional)</span><input name="tip"></label>
        <div class="form-actions">
          <button type="button" class="btn" data-go="contents">Cancel</button>
          <button type="submit" class="btn primary">Save recipe</button>
        </div>
      </form>
    </section>`;
  }

  const methodToText = (m) => (m || []).map((x) => typeof x === "string" ? x
    : `## ${x.step}\n${[].concat(x.text).join("\n")}\n`).join("\n").trim();

  function textToMethod(t) {
    const out = []; let cur = null;
    t.split("\n").forEach((raw) => {
      const l = raw.trim();
      if (!l) { cur = null; return; }
      if (l.startsWith("## ")) { cur = { step: l.slice(3).trim(), text: [] }; out.push(cur); return; }
      cur ? cur.text.push(l) : out.push(l);
    });
    return tidySteps(out);
  }
  const tidySteps = (steps) => steps.map((x) => typeof x === "string" ? x
    : !x.text.length ? x.step : { step: x.step, text: x.text.length === 1 ? x.text[0] : x.text });

  function fillForm(r) {
    const form = book.querySelector("#rform");
    ["title", "emoji", "cuisine", "protein", "fibre", "time", "makes", "tip"].forEach((k) => (form[k].value = r[k] || ""));
    form.ingredients.value = (r.ingredients || []).join("\n");
    form.method.value = methodToText(r.method);
  }

  function readForm() {
    const form = book.querySelector("#rform");
    const r = {};
    ["title", "emoji", "cuisine", "protein", "fibre", "time", "makes", "tip"].forEach((k) => {
      const v = form[k].value.trim(); if (v) r[k] = v;
    });
    r.ingredients = form.ingredients.value.split("\n").map((l) => l.trim().replace(/^[*•-]\s+/, "")).filter(Boolean);
    r.method = textToMethod(form.method.value);
    return r;
  }

  // Turns a recipe pasted as plain text into fields. A best guess — the form is there to fix it.
  function parseRecipe(text) {
    const r = { ingredients: [], method: [] };
    const EMOJI = /^((?:\p{Regional_Indicator}{2}|\p{Extended_Pictographic})(?:️|‍\p{Extended_Pictographic})*️?)\s*/u;
    const BULLET = /^[*•\-–]\s+/;
    const NUM = /^\d+[.)]\s+/;
    const META = /^(cuisine|protein|fibre|fiber|time|makes|serves)\s*:\s*(.+)$/i;
    let mode = "head", cur = null;
    const startMethod = () => {
      if (mode !== "method" && r.ingredients.length && r.ingredients[r.ingredients.length - 1].startsWith("## ")) r.ingredients.pop();
      mode = "method";
    };
    const addText = (t) => { if (cur) cur.text.push(t); else r.method.push(cap(t)); };

    for (const l of text.split(/\r?\n/).map((x) => x.trim())) {
      if (!l || /^[↓→⬇]+$/.test(l)) continue;
      const parts = l.split(/\s*\|\s*/);
      if (parts.every((p) => META.test(p))) {
        parts.forEach((p) => {
          const [, k, v] = p.match(META);
          r[{ fiber: "fibre", serves: "makes" }[k.toLowerCase()] || k.toLowerCase()] = v.trim();
        });
        continue;
      }
      if (!r.title) {
        r.title = l.replace(NUM, "");
        const m = r.title.match(EMOJI);
        if (m) { r.emoji = m[1]; r.title = r.title.slice(m[0].length).trim(); }
        continue;
      }
      const lead = l.match(EMOJI);
      const plain = l.replace(EMOJI, "").trim();
      let m;
      if ((m = plain.match(/^(ingredients|what you need)\b\s*:?\s*(.*)$/i))) {
        mode = "ing";
        if (m[2]) m[2].split(/\s*\+\s*/).forEach((x) => r.ingredients.push(cap(x)));
        continue;
      }
      if ((m = plain.match(/^(method|steps|instructions|directions)\b\s*:?\s*(.*)$/i))) {
        startMethod(); cur = null;
        if (m[2]) m[2].replace(/\.$/, "").split(/\s*→\s*/).forEach((x) => r.method.push(cap(x) + "."));
        continue;
      }
      if ((m = plain.match(/^tip\s*:\s*(.+)$/i))) { r.tip = m[1]; continue; }

      if (mode !== "method") {
        if (BULLET.test(l)) { r.ingredients.push(l.replace(BULLET, "")); mode = "ing"; continue; }
        if ((m = plain.match(/^optional[^:]*:\s*(.+)$/i))) {
          r.ingredients.push("## Optional");
          m[1].split(/\s*,\s*/).forEach((x) => r.ingredients.push(cap(x)));
          continue;
        }
        if (mode === "ing" && !NUM.test(l)) { r.ingredients.push("## " + plain.replace(/:$/, "")); continue; }
        startMethod();
      }

      if (NUM.test(l)) {
        const body = l.replace(NUM, "");
        if (body.length <= 45 && !/[.!?]$/.test(body)) { cur = { step: body, text: [] }; r.method.push(cur); }
        else if (cur && cur.header) cur.text.push(body);
        else { cur = null; r.method.push(body); }
      } else if (lead && plain.length <= 45) {
        cur = { step: l, text: [], header: true }; r.method.push(cur);
      } else {
        addText(l.replace(BULLET, ""));
      }
    }
    r.method = tidySteps(r.method);
    return r;
  }

  function exportFile() {
    const all = recipes.map(({ n, slug, custom, id, ...r }) => r);
    const src = `// YOUR RECIPES — see README.md for how to add more.\n\nwindow.RECIPES = ${JSON.stringify(all, null, 2)};\n`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([src], { type: "text/javascript" }));
    a.download = "recipes.js";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // Recipe data search engines can read (schema.org/Recipe).
  function structuredData() {
    const base = location.origin + location.pathname;
    const steps = (m) => (m || []).flatMap((x) => typeof x === "string" ? [x] : [x.step + ": " + [].concat(x.text).join(" ")]);
    const data = {
      "@context": "https://schema.org",
      "@type": "ItemList",
      itemListElement: recipes.filter((r) => !r.custom).map((r, i) => ({
        "@type": "ListItem", position: i + 1, url: base + "#" + r.slug,
        item: {
          "@type": "Recipe", name: r.title, recipeCuisine: r.cuisine, keywords: "high protein, vegetarian",
          recipeYield: r.makes, recipeIngredient: (r.ingredients || []).filter((x) => !x.startsWith("## ")),
          recipeInstructions: steps(r.method).map((t) => ({ "@type": "HowToStep", text: t })),
          nutrition: { "@type": "NutritionInformation", proteinContent: r.protein, fiberContent: r.fibre },
        },
      })),
    };
    let el = document.getElementById("ld");
    if (!el) { el = document.createElement("script"); el.type = "application/ld+json"; el.id = "ld"; document.head.appendChild(el); }
    el.textContent = JSON.stringify(data);
  }

  // ── building & routing ──
  function build() {
    const used = new Set();
    recipes = [...FILE, ...(owner ? added : []).map((r) => ({ ...r, custom: true }))].map((r, i) => {
      const base = slugify(r.title) || "recipe";
      let slug = base, k = 2;
      while (used.has(slug)) slug = `${base}-${k++}`;
      used.add(slug);
      return { ...r, n: i + 1, slug };
    });
    bySlug = Object.fromEntries(recipes.map((r) => [r.slug, r]));
    cuisines = [...new Set(recipes.map((r) => r.cuisine).filter(Boolean))];
    picked = new Set([...picked].filter((s) => bySlug[s]));
    filter = { q: "", cuisine: "" };
    book.innerHTML = coverPage() + contentsPage() + recipes.map(recipePage).join("") + listPage() + aboutPage() + (owner ? addPage() : "");
    renderToc();
    structuredData();
  }

  function current() {
    const id = location.hash.slice(1);
    return bySlug[id] || ["contents", "list", "about"].includes(id) || (owner && id === "add") ? id : "cover";
  }
  function show() {
    const id = current();
    if (id === "list") renderList();
    document.body.classList.toggle("on-list", id === "list");
    book.querySelectorAll(".page").forEach((p) => p.classList.toggle("active", p.id === "p-" + id));
    const r = bySlug[id];
    const name = r ? r.title : { contents: "All recipes", list: "Shopping list", about: "About", add: "Add a recipe" }[id];
    document.title = name ? `${name} · My Recipe Booklet` : "My Recipe Booklet · High-protein vegetarian recipes";
    window.scrollTo(0, 0);
    if (navigated) book.focus({ preventScroll: true });
    navigated = true;
  }
  let navigated = false;
  const go = (id) => { if (location.hash.slice(1) === id || (id === "cover" && !location.hash)) show(); location.hash = id === "cover" ? "" : id; };

  function startForm(r) {
    editingId = r ? r.id : null;
    book.querySelector("#rform").reset();
    book.querySelector("#paste").value = "";
    book.querySelector("#parse-msg").textContent = "";
    book.querySelector(".add-title").textContent = r ? "Edit recipe" : "Add a recipe";
    if (r) fillForm(r);
    go("add");
  }

  document.getElementById("year").textContent = new Date().getFullYear();
  document.getElementById("print").onclick = () => window.print();
  document.addEventListener("click", (e) => {
    const t = e.target;
    const g = t.closest("[data-go]");
    if (g) go(g.dataset.go);
    if (t.closest("[data-print]")) window.print();
    if (t.closest("[data-export]")) exportFile();
    if (t.closest("[data-new]")) startForm(null);
    const ed = t.closest("[data-edit]");
    if (ed) startForm(added.find((r) => r.id === ed.dataset.edit));
    const del = t.closest("[data-delete]");
    if (del) {
      const r = added.find((x) => x.id === del.dataset.delete);
      if (r && confirm(`Delete "${r.title}"? This can't be undone.`)) {
        added = added.filter((x) => x !== r); store(ADDED, added);
        build(); go("contents");
      }
    }
    if (t.closest("#parse")) {
      const r = parseRecipe(book.querySelector("#paste").value);
      if (!r.title) { book.querySelector("#parse-msg").textContent = "Paste a recipe first."; return; }
      fillForm(r);
      book.querySelector("#parse-msg").textContent = `Found ${r.ingredients.filter((x) => !x.startsWith("## ")).length} ingredients and ${r.method.length} steps — check below.`;
      book.querySelector("#rform").scrollIntoView({ behavior: "smooth" });
    }
    const p = t.closest("[data-pick]");
    if (p) {
      const s = p.dataset.pick;
      picked.has(s) ? picked.delete(s) : picked.add(s);
      savePicked(); syncPicks();
      if (current() === "list") renderList();
    }
    if (t.closest("#clear")) { picked.clear(); savePicked(); syncPicks(); renderList(); }
    const copy = t.closest("#copy");
    if (copy) {
      navigator.clipboard.writeText(listAsText()).then(
        () => { copy.textContent = "Copied ✓"; setTimeout(() => (copy.textContent = "Copy list"), 1500); },
        () => { copy.textContent = "Couldn't copy"; });
    }
    const c = t.closest("[data-cuisine]");
    if (c) {
      filter.cuisine = c.dataset.cuisine;
      book.querySelectorAll("[data-cuisine]").forEach((b) => b.classList.toggle("on", b === c));
      renderToc();
    }
  });
  document.addEventListener("input", (e) => {
    if (e.target.matches(".search")) { filter.q = e.target.value; renderToc(); }
  });
  document.addEventListener("submit", (e) => {
    if (!e.target.matches("#rform")) return;
    e.preventDefault();
    const r = readForm();
    if (!r.title) return;
    r.id = editingId || "r" + Date.now();
    const i = added.findIndex((x) => x.id === r.id);
    i >= 0 ? (added[i] = r) : added.push(r);
    store(ADDED, added);
    editingId = null;
    build();
    go(recipes.find((x) => x.id === r.id).slug);
  });
  window.addEventListener("hashchange", show);

  build();
  show();
})();
