/**
 * Chart presets: turn a chart spec plus a parsed .dat table into Observable
 * Plot options and a legend description. See README.md for the spec fields.
 */
import * as Plot from "@observablehq/plot";
import { assignSeries, formatter } from "./theme.mjs";

const WIDTH = 720;
const INK = "var(--chart-ink)";
const SURFACE = "var(--chart-surface)";
const GRID = Plot.gridY({ stroke: "var(--chart-grid)", strokeOpacity: 1 });
const MAX_BAR = 32;

/** Tooltip payload, unpacked into data attributes by render.mjs. */
const tip = (series, x, value, error, num) =>
  [series, x, value, error ?? "", num].join("\u001f");

function labelFn(xLabel) {
  if (typeof xLabel === "function") return xLabel;
  if (xLabel && typeof xLabel === "object") return x => xLabel[x] ?? x;
  return x => x;
}

function selectSeries(spec, table) {
  const names = spec.series ?? table.series;
  const missing = names.filter(n => !table.series.includes(n));
  if (missing.length)
    throw new Error(`unknown series ${missing} in ${spec.data}`);
  const rows = table.rows.filter(r => names.includes(r.series));
  return { names, rows };
}

/** Grouped bars: one facet per category, one bar per series, CI whiskers. */
export function bars(spec, table) {
  let { names, rows } = selectSeries(spec, table);
  const label = labelFn(spec.xLabel);
  const fmt = formatter(spec.unit);
  const assigned = assignSeries(names);
  const colorOf = Object.fromEntries(assigned.map(a => [a.name, a.color]));
  const isRef = Object.fromEntries(assigned.map(a => [a.name, a.ref]));
  let xs = table.x;
  let facetOf = r => label(r.x);
  let barOf = r => r.series;
  let legend = assigned.map(a => ({
    label: a.name,
    color: a.color,
    kind: a.ref ? "outline" : "swatch",
  }));
  if (names.length === 1) {
    legend = [];
  } else if (xs.length === 1) {
    // one row, several series: name the series on the axis instead of a legend
    xs = names;
    facetOf = r => r.series;
    legend = [];
  }
  const nFacets = xs.length;
  const nBars = names.length === 1 || xs === names ? 1 : names.length;
  const data = rows.map(r => ({
    ...r,
    facet: facetOf(r),
    bar: barOf(r),
    title: tip(
      r.series,
      label(r.x),
      fmt.value(r.value),
      r.error != null ? fmt.value(r.error) : "",
      r.value
    ),
  }));
  const hasCI = data.some(r => r.lower != null);
  const normal = data.filter(r => !isRef[r.series]);
  const refs = data.filter(r => isRef[r.series]);

  // bars at most MAX_BAR px wide, clustered in the middle of their facet
  const marginLeft = spec.marginLeft ?? 64;
  const fxPadding = 0.15;
  const facetW = ((WIDTH - marginLeft - 16) / nFacets) * (1 - fxPadding);
  const paddingInner = 0.15;
  const step = MAX_BAR / (1 - paddingInner);
  let paddingOuter = (facetW / step - nBars + paddingInner) / 2;
  let inset = 1;
  let barW = MAX_BAR - 2;
  if (paddingOuter < 0.05) {
    paddingOuter = 0.05;
    const band =
      (facetW / (nBars - paddingInner + 2 * paddingOuter)) * (1 - paddingInner);
    inset = Math.max(1, (band - MAX_BAR) / 2);
    barW = band - 2 * inset;
  }

  const barOpts = {
    fx: "facet",
    x: "bar",
    y: "value",
    ry1: 3,
    insetLeft: inset,
    insetRight: inset,
    title: "title",
  };
  const capInset = inset + Math.max(0, (barW - 8) / 2); // 8px whisker caps
  const marks = [
    GRID,
    Plot.barY(normal, { ...barOpts, fill: "series" }),
    Plot.barY(refs, {
      ...barOpts,
      fill: SURFACE,
      stroke: "series",
      strokeWidth: 1.5,
    }),
  ];
  if (hasCI) {
    const ci = data.filter(r => r.lower != null);
    const ciOpts = { fx: "facet", x: "bar", stroke: INK, strokeWidth: 1 };
    marks.push(
      Plot.ruleX(ci, { ...ciOpts, y1: "lower", y2: "upper" }),
      Plot.tickY(ci, { ...ciOpts, y: "lower", inset: capInset }),
      Plot.tickY(ci, { ...ciOpts, y: "upper", inset: capInset })
    );
  }
  marks.push(Plot.ruleY([0], { stroke: "var(--chart-axis)" }));

  const options = {
    width: WIDTH,
    height: spec.height ?? 360,
    marginTop: 32,
    marginLeft,
    marginRight: 16,
    marginBottom: spec.xTickRotate ? 56 : 36,
    fx: {
      label: spec.xAxisLabel ?? null,
      labelArrow: "none",
      domain: xs === names ? names : xs.map(label),
      padding: fxPadding,
      tickRotate: spec.xTickRotate ?? 0,
    },
    x: {
      axis: null,
      label: null,
      domain: nBars === 1 ? undefined : names,
      paddingOuter,
      paddingInner,
    },
    y: {
      label:
        spec.yLabel ??
        (names.length === 1 ? `${names[0]}, ${fmt.label}` : fmt.label),
      labelArrow: "none",
      tickFormat: fmt.tick,
      nice: true,
      zero: true,
      insetTop: 12,
      domain: spec.yMax != null ? [0, spec.yMax] : undefined,
    },
    color: { domain: names, range: names.map(n => colorOf[n]) },
    marks,
  };
  return { options, legend };
}

/** Lines over an ordered category axis, e.g. hit rate by cache size. */
export function lines(spec, table) {
  const { names, rows } = selectSeries(spec, table);
  const label = labelFn(spec.xLabel);
  const fmt = formatter(spec.unit);
  const assigned = assignSeries(names);
  const byName = Object.fromEntries(assigned.map(a => [a.name, a]));
  const data = rows.map(r => ({
    ...r,
    label: label(r.x),
    title: tip(r.series, label(r.x), fmt.value(r.value), "", r.value),
  }));
  const marks = [];
  // one line mark per dash pattern (plain lines together, each ref on its own)
  const groups = new Map();
  for (const a of assigned) {
    const key = a.dash ?? "";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(a.name);
  }
  for (const [dash, members] of groups) {
    marks.push(
      Plot.line(
        data.filter(r => members.includes(r.series)),
        {
          x: "label",
          y: "value",
          z: "series",
          stroke: "series",
          strokeWidth: 2,
          strokeDasharray: dash || null,
        }
      )
    );
  }
  marks.push(
    Plot.dot(data, {
      x: "label",
      y: "value",
      fill: "series",
      r: 4,
      stroke: SURFACE,
      strokeWidth: 2,
      title: "title",
    })
  );
  marks.unshift(GRID);
  const options = {
    width: WIDTH,
    height: spec.height ?? 420,
    marginTop: 32,
    marginLeft: spec.marginLeft ?? 56,
    marginRight: 16,
    marginBottom: 44,
    x: {
      type: "point",
      domain: table.x.map(label),
      label: spec.xAxisLabel ?? null,
      labelArrow: "none",
      padding: 0.3,
    },
    y: {
      label: spec.yLabel ?? fmt.label,
      labelArrow: "none",
      tickFormat: fmt.tick,
      nice: true,
      zero: true,
      insetTop: 12,
      domain: spec.yMax != null ? [0, spec.yMax] : undefined,
    },
    color: { domain: names, range: names.map(n => byName[n].color) },
    marks,
  };
  const legend = assigned.map(a => ({
    label: a.name,
    color: a.color,
    kind: "line",
    dash: a.dash,
  }));
  return { options, legend };
}

export const PRESETS = { bars, lines };
