#!/usr/bin/env node
/* eslint-disable no-console -- CLI script */
/**
 * One-time recovery of the 2016 hit-rate data (Java Caching Benchmarks 2016,
 * Part 2). The original result tables were lost; the gnuplot SVGs still carry
 * the bar geometry. For every trace*hitrateProducts.svg this reads the y-axis
 * tick positions (pixels per percent), the x tick labels (cache sizes), the
 * legend order and every bar's top edge, and writes trace*hitrateProducts.dat.
 * Precision is about 0.05 percentage points. Kept in the repo for provenance.
 */
import fs from "node:fs";
import path from "node:path";

const dir = "src/content/posts/java-caching-benchmarks-2016-part-2";
const files = fs
  .readdirSync(dir)
  .filter(f => /^trace.*hitrateProducts\.svg$/.test(f))
  .sort();

for (const file of files) {
  const svg = fs.readFileSync(path.join(dir, file), "utf8");
  // y axis: <g transform="translate(x,y)" ...><text> 10</text>  (labels are vertically centered: y + 4.5)
  const yTicks = [...svg.matchAll(/translate\(([\d.]+),([\d.]+)\)"[^>]*text-anchor:end">\s*<text>\s*(\d+)<\/text>/g)]
    .map(m => ({ py: +m[2] - 4.5, value: +m[3] }));
  if (yTicks.length < 2) throw new Error(`${file}: y ticks not found`);
  const [t0, t1] = [yTicks[0], yTicks[yTicks.length - 1]];
  const pxPerUnit = (t0.py - t1.py) / (t1.value - t0.value);
  const baseline = t0.py + t0.value * pxPerUnit; // pixel y of value 0
  // x ticks: rotated labels with the cache size
  const sizes = [...svg.matchAll(/rotate\(45\)"[^>]*>\s*<text>([^<]+)<\/text>/g)].map(m => m[1].trim());
  // plots: <g id="gnuplot_plot_N"> ... <text>NAME</text> ... bar paths 'M x,base L x,top L x2,top L x2,base ...'
  const plots = svg.split(/<g id="gnuplot_plot_\d+"\s*>/).slice(1);
  const series = [];
  const values = [];
  for (const plot of plots) {
    const name = plot.match(/<text>([^<]+)<\/text>/)?.[1].trim();
    const bars = [...plot.matchAll(/d='M([\d.]+),([\d.]+) L\1,([\d.]+) L([\d.]+),\3 L\4,\2 L\1,\2 Z/g)]
      // skip the legend swatch (it does not start at the baseline)
      .filter(m => Math.abs(+m[2] - baseline) < 1)
      .map(m => +(((baseline - +m[3]) / pxPerUnit).toFixed(2)));
    if (!name || bars.length !== sizes.length) {
      throw new Error(`${file}: series ${name} has ${bars.length} bars for ${sizes.length} sizes`);
    }
    series.push(name);
    values.push(bars);
  }
  const lines = [
    "# recovered from the 2016 gnuplot SVG, precision about 0.05 percentage points",
    ["size", ...series].join(" "),
    ...sizes.map((s, i) => [s, ...values.map(v => v[i].toFixed(2))].join(" ")),
  ];
  const out = path.join(dir, file.replace(/\.svg$/, ".dat"));
  fs.writeFileSync(out, lines.join("\n") + "\n");
  console.log(`${out}: ${series.length} series x ${sizes.length} sizes, ${t0.value}..${t1.value} %`);
}
