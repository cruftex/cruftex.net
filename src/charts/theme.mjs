/**
 * Chart theme: the validated categorical palette (data-viz method), the
 * chrome tokens, and the registry that pins every known series to one slot
 * so cache2k, Caffeine, ... carry the same color in every chart on the site.
 *
 * Marks are painted with `var(--chart-N)`; src/styles/charts.css defines the
 * light and dark values on the page, and a standalone SVG file carries the
 * light values in its own <style>.
 */

/** Categorical slots 1..8, light and dark steps (both validated). */
export const SLOTS = [
  { light: "#2a78d6", dark: "#3987e5" }, // 1 blue
  { light: "#eb6834", dark: "#d95926" }, // 2 orange
  { light: "#1baf7a", dark: "#199e70" }, // 3 aqua
  { light: "#eda100", dark: "#c98500" }, // 4 yellow
  { light: "#e87ba4", dark: "#d55181" }, // 5 magenta
  { light: "#008300", dark: "#008300" }, // 6 green
  { light: "#6250d6", dark: "#9085e9" }, // 7 violet
  { light: "#e34948", dark: "#e66767" }, // 8 red
];

/** Reference series (baselines, bounds) are neutral gray. */
export const REFS = [
  { light: "#6f6e6a", dark: "#a8a69e" }, // ref 1 (darker on light)
  { light: "#a8a69e", dark: "#6f6e6a" }, // ref 2 (lighter on light)
];

/** Chart chrome, matching src/styles/theme.css. */
export const CHROME = {
  light: {
    ink: "#282728",
    muted: "#6b7280",
    grid: "#e4e1e1",
    axis: "#b4b0b0",
    surface: "#fdfdfd",
  },
  dark: {
    ink: "#e7eaef",
    muted: "#aab3c0",
    grid: "#3b4453",
    axis: "#56607a",
    surface: "#1b2027",
  },
};

export const FONT = 'ui-sans-serif, system-ui, "Segoe UI", sans-serif';

/** CSS custom properties for one mode, as a declaration string. */
export function tokens(mode) {
  const c = CHROME[mode];
  return [
    ...SLOTS.map((s, i) => `--chart-${i + 1}: ${s[mode]}`),
    ...REFS.map((s, i) => `--chart-ref-${i + 1}: ${s[mode]}`),
    `--chart-ink: ${c.ink}`,
    `--chart-muted: ${c.muted}`,
    `--chart-grid: ${c.grid}`,
    `--chart-axis: ${c.axis}`,
    `--chart-surface: ${c.surface}`,
    `--chart-font: ${FONT}`,
  ].join("; ");
}

/** Products keep their slot everywhere on the site. */
const FIXED = {
  cache2k: 1,
  Caffeine: 2,
  Guava: 3,
  EhCache2: 4,
  EHCache2: 4,
  EHCache3: 4,
  LRU: 5,
  CLOCK: 7,
};

/** Reference series: gray, plus a second encoding so color is not alone. */
const REF = {
  CHM: { ref: 1, dash: "6 4" },
  OPT: { ref: 1, dash: "6 4" },
  RAND: { ref: 2, dash: "2 4" },
};

/**
 * Assign colors to series names: fixed slots first, then the lowest free
 * slots in order of appearance. Never more than 8 colored series.
 */
export function assignSeries(names) {
  const used = new Set(names.filter(n => FIXED[n]).map(n => FIXED[n]));
  let next = 1;
  const free = () => {
    while (used.has(next)) next++;
    if (next > SLOTS.length) {
      throw new Error(`more than ${SLOTS.length} colored series: ${names}`);
    }
    used.add(next);
    return next;
  };
  return names.map(name => {
    if (REF[name]) {
      return {
        name,
        color: `var(--chart-ref-${REF[name].ref})`,
        ref: true,
        dash: REF[name].dash,
      };
    }
    const slot = FIXED[name] ?? free();
    return { name, color: `var(--chart-${slot})`, ref: false };
  });
}

/** Number formatting per unit: axis ticks and tooltip values. */
export function formatter(unit = "") {
  const si = (v, digits = 1) => {
    const a = Math.abs(v);
    const [div, suffix] =
      a >= 1e9
        ? [1e9, "G"]
        : a >= 1e6
          ? [1e6, "M"]
          : a >= 1e3
            ? [1e3, "k"]
            : [1, ""];
    return trim((v / div).toFixed(digits)) + suffix;
  };
  const trim = s => s.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
  const f = formats(unit, si, trim);
  const tick = f.tick;
  return { ...f, tick: v => (v === 0 ? "0" : tick(v)) };
}

function formats(unit, si, trim) {
  switch (unit) {
    case "ops/s":
      return {
        label: "operations per second",
        tick: v => si(v, 1),
        value: v => `${si(v, 2)} ops/s`,
      };
    case "bytes":
      return {
        label: "memory",
        tick: v =>
          v >= 1e9
            ? `${trim((v / 1e9).toFixed(1))} GB`
            : `${trim((v / 1e6).toFixed(0))} MB`,
        value: v =>
          v >= 1e9
            ? `${trim((v / 1e9).toFixed(2))} GB`
            : `${trim((v / 1e6).toFixed(1))} MB`,
      };
    case "bytes/s":
      return {
        label: "bytes per second",
        tick: v =>
          v >= 1e9
            ? `${trim((v / 1e9).toFixed(1))} GB/s`
            : `${trim((v / 1e6).toFixed(0))} MB/s`,
        value: v =>
          v >= 1e9
            ? `${trim((v / 1e9).toFixed(2))} GB/s`
            : `${trim((v / 1e6).toFixed(1))} MB/s`,
      };
    case "bytes/op":
      return {
        label: "bytes per operation",
        tick: v => `${trim(v.toFixed(0))} B`,
        value: v => `${trim(v.toFixed(1))} bytes/op`,
      };
    case "s":
      return {
        label: "seconds",
        tick: v => `${trim(v.toFixed(2))} s`,
        value: v => `${trim(v.toFixed(3))} s`,
      };
    case "MB":
      return {
        label: "MB",
        tick: v => `${trim(v.toFixed(0))} MB`,
        value: v => `${trim(v.toFixed(1))} MB`,
      };
    case "%":
      return {
        label: "percent",
        tick: v => `${trim(v.toFixed(0))} %`,
        value: v => `${trim(v.toFixed(2))} %`,
      };
    default:
      return {
        label: unit,
        tick: v => trim(v.toFixed(2)),
        value: v => trim(v.toFixed(3)),
      };
  }
}
