// POST /api/generate — writes one high-protein vegetarian recipe from a visitor's request.
// Claude is reached through Netlify AI Gateway, which injects ANTHROPIC_API_KEY and
// ANTHROPIC_BASE_URL at runtime, so there is no key to manage.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { Config } from "@netlify/functions";

// Same shape as a recipe in recipes.js, so the booklet can show it unchanged.
const Recipe = z.object({
  title: z.string(),
  emoji: z.string(),
  cuisine: z.string(),
  protein: z.string(),
  fibre: z.string(),
  time: z.string(),
  makes: z.string(),
  ingredients: z.array(z.string()),
  method: z.array(z.object({ step: z.string(), text: z.array(z.string()) })),
  tip: z.string(),
});
const Output = z.object({ off_topic: z.boolean(), recipe: Recipe });

const SYSTEM = `You write recipes for My Recipe Booklet, a collection of quick, high-protein vegetarian dinners. Write one recipe that fits the cook's request.

- Vegetarian only: no meat, poultry, fish or seafood. Use eggs only if the cook asks for them. Dairy is fine unless they rule it out.
- Aim for at least 20 g of protein per serving, from foods like tofu, paneer, tempeh, beans, lentils, chickpeas, edamame or Greek yogurt.
- protein and fibre are honest estimates per serving, written like "~25g" or "~8g".
- time is the total cooking time, like "20 min". Keep it around 20–30 minutes unless the cook asks otherwise.
- makes says how much it makes, like "2 plates".
- ingredients: one per entry, quantity first, like "200g firm tofu". To group them, add an entry that starts with "## ", like "## For the sauce".
- method: 3 to 7 steps. Each step has a short title and one to three plain sentences.
- emoji is a single food emoji. tip is one practical tip, or an empty string.
- Build on what the cook says they have. You may add pantry staples such as oil, salt, spices, garlic and onion.
- Respect allergies and exclusions exactly.

If the request has nothing to do with cooking a meal, set off_topic to true and leave the recipe fields empty.`;

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export default async (req: Request) => {
  if (!Netlify.env.get("ANTHROPIC_BASE_URL") && !Netlify.env.get("ANTHROPIC_API_KEY")) {
    return Response.json({ error: "The recipe generator isn't switched on yet." }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const request = clean(body?.request, 500);
  if (!request) return Response.json({ error: "Tell us what you'd like to cook." }, { status: 400 });

  const details = [
    `Request: ${request}`,
    clean(body?.time, 20) && `Time available: ${clean(body.time, 20)}`,
    clean(body?.cuisine, 40) && `Cuisine: ${clean(body.cuisine, 40)}`,
    clean(body?.servings, 10) && `Servings: ${clean(body.servings, 10)}`,
    clean(body?.avoid, 200) && `Leave out: ${clean(body.avoid, 200)}`,
  ].filter(Boolean).join("\n");

  // Stay inside the 60-second function limit: one quick attempt plus one retry.
  const client = new Anthropic({ timeout: 25_000, maxRetries: 1 });

  try {
    const response = await client.messages.parse({
      model: "claude-opus-5",
      max_tokens: 8000,
      output_config: { effort: "low", format: zodOutputFormat(Output) },
      system: SYSTEM,
      messages: [{ role: "user", content: details }],
    });

    if (response.stop_reason === "refusal") {
      return Response.json({ error: "That request couldn't be turned into a recipe. Try describing a meal." }, { status: 422 });
    }
    const out = response.parsed_output;
    if (!out || response.stop_reason === "max_tokens") {
      return Response.json({ error: "The recipe came out incomplete. Please try again." }, { status: 502 });
    }
    if (out.off_topic || !out.recipe.title) {
      return Response.json({ error: "That doesn't sound like a meal. Try listing some ingredients." }, { status: 422 });
    }
    return Response.json({ recipe: out.recipe });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return Response.json({ error: "Lots of people are cooking right now. Try again in a minute." }, { status: 429 });
    }
    if (err instanceof Anthropic.APIError) {
      console.error("Claude API error", err.status, err.message);
    } else {
      console.error("Recipe generation failed", err);
    }
    return Response.json({ error: "Something went wrong writing your recipe. Please try again." }, { status: 502 });
  }
};

export const config: Config = {
  path: "/api/generate",
  method: "POST",
  // Each visitor can generate a few recipes a minute; this caps cost if the page is abused.
  rateLimit: { windowLimit: 5, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
