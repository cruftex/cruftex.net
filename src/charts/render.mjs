/**
 * Render a chart spec to a standalone SVG string with Observable Plot (in a
 * jsdom document). The result has the legend drawn at the top, a <title>,
 * and a <style> with the light theme defaults, so it works as a plain file;
 * inlined into a page, src/styles/charts.css overrides the --chart-* tokens.
 */
import * as Plot from "@observablehq/plot";
import { JSDOM } from "jsdom";
import { PRESETS } from "./presets.mjs";
import { tokens } from "./theme.mjs";

const { document } = new JSDOM("").window;
const WIDTH = 720;
const FONT_SIZE = 13;

const esc = s =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");

/** Approximate text width for legend layout (no font metrics in Node). */
const textWidth = s => s.length * FONT_SIZE * 0.56;

/**
 * Plot wrote the tooltip payload (see presets.mjs `tip`) into <title>; turn it
 * into data attributes for src/scripts/chart-tooltips.ts and a readable title
 * for standalone files and browsers without JavaScript.
 */
function unpackTitles(svg) {
  return svg.replace(
    /(<(?:path|rect|circle)\b[^>]*)><title>([^<]*)<\/title>/g,
    (m, open, text) => {
      const parts = text.split("\u001f");
      if (parts.length < 5) return m;
      const [series, x, value, error, num] = parts;
      const title = `${series} · ${x}: ${value}${error ? ` ± ${error}` : ""}`;
      return (
        `${open} data-series="${esc(series)}" data-x="${esc(x)}" data-value="${esc(value)}"` +
        `${error ? ` data-error="${esc(error)}"` : ""} data-num="${esc(num)}"><title>${esc(title)}</title>`
      );
    }
  );
}

function legendSvg(items, y0) {
  const rowH = 24;
  let x = 8;
  let row = 0;
  const parts = [];
  for (const it of items) {
    const w = 18 + 6 + textWidth(it.label) + 18;
    if (x + w > WIDTH - 8 && x > 8) {
      x = 8;
      row++;
    }
    const y = y0 + row * rowH + 11;
    if (it.kind === "line") {
      parts.push(
        `<line x1="${x}" x2="${x + 18}" y1="${y}" y2="${y}" stroke="${it.color}" stroke-width="2"${it.dash ? ` stroke-dasharray="${it.dash}"` : ""}/>`,
        `<circle cx="${x + 9}" cy="${y}" r="4" fill="${it.color}" stroke="var(--chart-surface)" stroke-width="2"/>`
      );
    } else if (it.kind === "outline") {
      parts.push(
        `<rect x="${x + 3.75}" y="${y - 5.25}" width="10.5" height="10.5" rx="2.5" fill="var(--chart-surface)" stroke="${it.color}" stroke-width="1.5"/>`
      );
    } else {
      parts.push(
        `<rect x="${x + 3}" y="${y - 6}" width="12" height="12" rx="3" fill="${it.color}"/>`
      );
    }
    parts.push(
      `<text x="${x + 24}" y="${y}" dominant-baseline="central" fill="var(--chart-ink)">${esc(it.label)}</text>`
    );
    x += w;
  }
  return { svg: parts.join(""), height: (row + 1) * rowH + 6 };
}

/**
 * @param spec   chart spec from charts.mjs (preset, title, unit, ...)
 * @param table  parsed .dat table (see dat.mjs)
 * @param meta   { src?: repo path of the output file, id?: element id }
 */
export function renderChart(spec, table, meta = {}) {
  const preset = PRESETS[spec.preset ?? "bars"];
  if (!preset) throw new Error(`unknown chart preset ${spec.preset}`);
  const { options, legend } = preset(spec, table);
  const plot = Plot.plot({
    document,
    className: "plot",
    style: {
      fontFamily: "var(--chart-font)",
      fontSize: `${FONT_SIZE}px`,
      color: "var(--chart-muted)",
      background: "none",
      overflow: "visible",
    },
    ...options,
  });
  const inner = unpackTitles(
    plot.outerHTML.replace(/^<svg /, `<svg xmlns="http://www.w3.org/2000/svg" `)
  );
  const { svg: legendMarkup, height: legendH } = legend.length
    ? legendSvg(legend, 4)
    : { svg: "", height: 0 };
  const height = legendH + options.height;
  const id =
    meta.id ??
    `chart-${(meta.src ?? spec.out ?? "chart").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
  const dataLink =
    spec.dataLink !== false && spec.data
      ? ` data-data="${esc(spec.data)}"`
      : "";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" class="plot-chart" role="img" aria-labelledby="${id}-title"` +
    ` viewBox="0 0 ${WIDTH} ${height}"${meta.src ? ` data-src="${esc(meta.src)}"` : ""}${dataLink}>` +
    `<title id="${id}-title">${esc(spec.title ?? "")}</title>` +
    (spec.note ? `<desc>${esc(spec.note)}</desc>` : "") +
    `<style>svg.plot-chart{${tokens("light")};font-family:var(--chart-font);font-size:${FONT_SIZE}px}` +
    `svg.plot-chart .plot{font-size:${FONT_SIZE}px}</style>` +
    (legendMarkup
      ? `<g class="chart-legend" font-size="${FONT_SIZE}">${legendMarkup}</g>`
      : "") +
    `<svg x="0" y="${legendH}" width="${WIDTH}" height="${options.height}">${inner}</svg>` +
    `</svg>\n`
  );
}
