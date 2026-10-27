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
  "site.webmanifest", "robots.txt", "media/hero-bowls.mp4", "media/hero-bowls.jpg",
];

// Run recipes.js and render.js exactly as the browser would.
const ctx = vm.createContext({ window: {} });
for (const f of ["recipes.js", "render.js"]) vm.runInContext(fs.readFileSync(f, "utf8"), ctx);
const recipes = ctx.window.RECIPES;
const { icon, esc, withSlugs, facts, ingredientList, stepTexts, bodyHtml } = vm.runInContext("RecipeKit", ctx);

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, "media"), { recursive: true });
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
  <meta name="theme-color" content="#2e3b1f">
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
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..900&family=IBM+Plex+Mono:wght@400;500;600&display=swap">
  <link rel="stylesheet" href="/style.css">
  <script type="application/ld+json">${ld(data)}</script>
</head>
<body>
  <a class="skip" href="#main">Skip to content</a>
  <header class="bar">
    <a class="bar-title" href="/" aria-label="My Recipe Booklet, home"><svg class="mark" viewBox="0 0 64 64" width="30" height="30" aria-hidden="true"><path d="M9 19 30 23v28L9 47z"/><path d="M34 23 55 19v28l-21 4z"/><path class="ribbon" d="M28 8h8v20l-4-4-4 4z"/></svg><span class="wordmark"><small>My</small>Recipe Booklet</span></a>
    <nav class="bar-actions" aria-label="Main"><a class="btn" href="/#contents">Recipes</a><a class="btn" href="/#generate">Generate</a></nav>
  </header>
  <main id="main" class="book">
    <article class="page active">
      <div class="page-top"><a class="btn back" href="/#contents">${icon.left} All recipes</a></div>
      <div class="recipe-head">
        <p class="kicker">Recipe ${String(r.n).padStart(2, "0")}${r.cuisine ? ` · ${esc(r.cuisine)}` : ""}</p>
        <h1><span class="e" aria-hidden="true">${esc(r.emoji || "🍽️")}</span>${esc(r.title)}</h1>
        ${facts(r)}
        <div class="head-pick"><a class="btn primary" href="/?pick=${r.slug}#${r.slug}">${icon.plus} Add to shopping list</a></div>
      </div>
      ${bodyHtml(r)}
    </article>
  </main>
  <footer class="foot">
    <p>© ${new Date().getFullYear()} My Recipe Booklet</p>
    <p><a href="/#about">About</a> · <a href="/#contents">All recipes</a></p>
    <p class="fine">Nutrition figures are general guides and estimates, not personal medical or dietary advice.</p>
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
