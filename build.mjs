// Builds the site into dist/: copies the booklet as-is and adds a static, search-friendly page
// for every recipe at /recipes/<slug>/ plus a sitemap. Netlify runs this on each deploy;
// locally: `node build.mjs`.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const SITE = "https://my-recipe-booklet.netlify.app";
const OUT = "dist";
const STATIC = [
  "index.html", "404.html", "app.js", "render.js", "recipes.js", "style.css",
  "favicon.svg", "favicon-32.png", "apple-touch-icon.png", "icon-512.png", "og-image.png",
  "site.webmanifest", "robots.txt",
];

// Run recipes.js and render.js exactly as the browser would.
const ctx = vm.createContext({ window: {} });
for (const f of ["recipes.js", "render.js"]) vm.runInContext(fs.readFileSync(f, "utf8"), ctx);
const recipes = ctx.window.RECIPES;
const { esc, withSlugs, stats, ingredientList, stepTexts, bodyHtml } = vm.runInContext("RecipeKit", ctx);

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT);
for (const f of STATIC) fs.copyFileSync(f, path.join(OUT, f));

const describe = (r) => {
  const facts = [r.protein && `${r.protein} protein`, r.fibre && `${r.fibre} fibre`, r.time].filter(Boolean).join(", ");
  const items = ingredientList(r).slice(0, 5).map((x) => x.replace(/\s+—.*$/, "")).join(", ");
  return `${r.cuisine ? r.cuisine + " " : ""}high-protein vegetarian recipe${facts ? ` (${facts})` : ""}. Made with ${items}.`;
};

// JSON inside <script> must not be able to close the tag.
const ld = (data) => JSON.stringify(data).replace(/</g, "\\u003c");

function page(r) {
  const url = `${SITE}/recipes/${r.slug}/`;
  const desc = describe(r);
  const data = {
    "@context": "https://schema.org",
    "@type": "Recipe",
    name: r.title,
    description: desc,
    image: [`${SITE}/og-image.png`],
    author: { "@type": "Organization", name: "My Recipe Booklet", url: SITE },
    recipeCuisine: r.cuisine,
    recipeCategory: "Main course",
    keywords: "high protein, vegetarian",
    recipeYield: r.makes,
    recipeIngredient: ingredientList(r),
    recipeInstructions: stepTexts(r).map((text) => ({ "@type": "HowToStep", text })),
    nutrition: { "@type": "NutritionInformation", proteinContent: r.protein, fiberContent: r.fibre },
  };
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(r.title)} · My Recipe Booklet</title>
  <meta name="description" content="${esc(desc)}">
  <link rel="canonical" href="${url}">
  <meta name="theme-color" content="#c2502e">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <link rel="manifest" href="/site.webmanifest">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="My Recipe Booklet">
  <meta property="og:title" content="${esc(r.title)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${SITE}/og-image.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Inter:wght@400;500;600&display=swap">
  <link rel="stylesheet" href="/style.css">
  <script type="application/ld+json">${ld(data)}</script>
</head>
<body>
  <a class="skip" href="#main">Skip to content</a>
  <header class="bar">
    <a class="bar-title" href="/" aria-label="My Recipe Booklet, home"><img src="/favicon.svg" alt="" width="26" height="26"> Recipe Booklet</a>
    <nav class="bar-actions" aria-label="Main"><a class="btn" href="/#contents">All recipes</a></nav>
  </header>
  <main id="main" class="book">
    <article class="page active">
      <div class="page-top"><a class="btn back" href="/#contents">← All recipes</a></div>
      <div class="recipe-head">
        <div class="recipe-no">Recipe ${r.n}</div>
        <h1><span class="e">${esc(r.emoji || "🍽️")}</span>${esc(r.title)}</h1>
        <div class="stats">${stats(r)}</div>
        <div class="head-pick"><a class="btn primary" href="/?pick=${r.slug}#${r.slug}">＋ Add to shopping list</a></div>
      </div>
      ${bodyHtml(r)}
    </article>
  </main>
  <footer class="foot">
    <p>© ${new Date().getFullYear()} My Recipe Booklet</p>
    <p><a href="/#about">About</a> · <a href="/#contents">All recipes</a></p>
    <p class="fine">Protein and fibre figures are estimates and vary by brand and portion.</p>
  </footer>
</body>
</html>
`;
}

const all = withSlugs(recipes);
for (const r of all) {
  const dir = path.join(OUT, "recipes", r.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), page(r));
}

const urls = [`${SITE}/`, ...all.map((r) => `${SITE}/recipes/${r.slug}/`)];
fs.writeFileSync(path.join(OUT, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u}</loc></url>`).join("\n")}
</urlset>
`);

console.log(`Built ${all.length} recipe pages into ${OUT}/`);
