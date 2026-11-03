#!/usr/bin/env node
/* eslint-disable no-console -- CLI script */
/**
 * Render every chart described in src/content/posts/<post>/charts.mjs into a
 * directory, to look at the SVG files outside the site:
 *
 *   pnpm charts /tmp/charts     ->  /tmp/charts/<post>/<out>
 *
 * The site itself renders the charts during the build (src/charts/registry.mjs).
 */
import fs from "node:fs";
import path from "node:path";
import { allCharts, renderPostChart } from "../src/charts/registry.mjs";

const outDir = process.argv[2];
if (!outDir) {
  console.error("usage: pnpm charts <output directory>");
  process.exit(1);
}
let count = 0;
for (const { post, out } of await allCharts()) {
  const file = path.join(outDir, post, out);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, await renderPostChart(post, out));
  count++;
}
console.log(`charts: ${count} SVG files written to ${outDir}`);
