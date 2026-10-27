# My Recipe Booklet

High-protein vegetarian recipes with a combined shopping list.
Live at https://my-recipe-booklet.netlify.app

Open `index.html` in any browser to view it locally — no install or server needed.

## Owner mode
Visitors don't see the editing tools. Open https://my-recipe-booklet.netlify.app/?owner once in your browser
to show **＋ Add a recipe** there; `?owner=off` hides it again.

## Files
- `recipes.js` — **all your recipes live here.** This is the only file you need to edit.
- `index.html`, `style.css`, `app.js` — the booklet website itself.

## Adding a recipe on the website
In owner mode, tap **＋ Add a recipe** on the Recipes page. Paste the recipe, tap **Fill in the form**, check the fields and save.

Recipes added this way are saved **in that browser only**. To keep them for good, tap **Download recipes.js** on the Recipes page and replace the `recipes.js` in this folder with the downloaded file, then commit and push it to GitHub. After that the "saved in this browser only" notice goes away.

## Adding a recipe by editing the file
Open `recipes.js`, copy one of the `{ ... },` blocks, paste it at the bottom of the list, and edit it:

```js
  {
    title: "Recipe name",
    emoji: "🥗",
    cuisine: "Indian",          // used for the filter buttons
    protein: "~20g",
    fibre: "High",
    time: "20 min",             // optional
    ingredients: [
      "1 cup something",
      "Salt",
    ],
    method: [
      "First step.",
      "Second step.",
    ],
    tip: "Optional tip shown under the method.",  // optional
  },
```

Extras, all optional:
- `makes: "2 wraps"` shows a "Makes" badge.
- An ingredient starting with `## ` becomes a subheading, e.g. `"## For the sauce"`. It's left out of the shopping list.
- A method step can have a title: `{ step: "Make the sauce", text: ["Line one.", "Line two."] }`.

Save and refresh the page — the new recipe shows up in the contents, the filters and the page flipping automatically.

Or just paste the recipe to Claude and ask it to add it.
