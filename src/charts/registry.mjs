/**
 * Registry of the charts described in src/content/posts/<post>/charts.mjs.
 * Charts are rendered in memory at build time (nothing is committed):
 * the rehype plugin inlines them into the pages, the charts integration
 * writes the standalone SVG files into dist/ for the feed and direct links.
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseDat } from "./dat.mjs";
import { renderChart } from "./render.mjs";

export const POSTS_DIR = "src/content/posts";

const specCache = new Map(); // post -> { mtime, specs: Map<out, spec> }
const svgCache = new Map(); // post/out -> { key, svg }

const mtime = file => (fs.existsSync(file) ? fs.statSync(file).mtimeMs : 0);

// This module is loaded through Vite's module runner (astro.config.ts imports
// it); a plain `import()` here would be routed through that runner, which is
// closed once the config is loaded. Build the import outside the transform so
// Node loads the spec file natively.
const nativeImport = new Function("url", "return import(url)");

/** The chart specs of a post keyed by their `out` path, empty if none. */
export async function loadSpecs(post) {
  const file = path.join(POSTS_DIR, post, "charts.mjs");
  const stamp = mtime(file);
  if (!stamp) return new Map();
  const cached = specCache.get(post);
  if (cached && cached.mtime === stamp) return cached.specs;
  // the query makes Node load a fresh module after edits in `astro dev`
  const url = `${pathToFileURL(path.resolve(file)).href}?v=${stamp}`;
  const list = (await nativeImport(url)).default;
  const specs = new Map(list.map(spec => [spec.out, spec]));
  specCache.set(post, { mtime: stamp, specs });
  return specs;
}

/** Render one chart of a post to a standalone SVG string, or null. */
export async function renderPostChart(post, out) {
  const spec = (await loadSpecs(post)).get(out);
  if (!spec) return null;
  const dataFile = path.join(POSTS_DIR, post, spec.data);
  const key = `${mtime(path.join(POSTS_DIR, post, "charts.mjs"))}:${mtime(dataFile)}`;
  const id = `${post}/${out}`;
  const cached = svgCache.get(id);
  if (cached && cached.key === key) return cached.svg;
  const table = parseDat(fs.readFileSync(dataFile, "utf8"));
  const svg = renderChart(spec, table, { src: id });
  svgCache.set(id, { key, svg });
  return svg;
}

/** Every chart of every post: [{ post, out }]. */
export async function allCharts() {
  const charts = [];
  for (const post of fs.readdirSync(POSTS_DIR).sort()) {
    if (!fs.statSync(path.join(POSTS_DIR, post)).isDirectory()) continue;
    for (const out of (await loadSpecs(post)).keys())
      charts.push({ post, out });
  }
  return charts;
}
