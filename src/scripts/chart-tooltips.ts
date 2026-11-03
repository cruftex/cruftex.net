/**
 * Instant tooltips for the inlined charts (src/charts/). The SVG marks carry
 * data-series / data-x / data-value / data-error attributes and a <title>
 * for browsers without JavaScript. Here the <title>s are dropped (they show
 * late and plain) and one shared tooltip lists every series of the hovered
 * category, like the Recharts tooltips in the Timor-Leste report.
 */
const SELECTOR = "svg.plot-chart";
const MARK = "[data-x]";

let tip: HTMLDivElement | null = null;
let activeCard: HTMLElement | null = null;

function ensureTip(card: HTMLElement): HTMLDivElement {
  if (!tip) {
    tip = document.createElement("div");
    tip.className = "chart-tip";
    tip.setAttribute("role", "status");
  }
  if (tip.parentElement !== card) card.appendChild(tip);
  activeCard = card;
  return tip;
}

function hide() {
  tip?.classList.remove("is-visible");
}

function swatchColor(mark: Element): string {
  const fill = mark.getAttribute("fill") ?? "";
  // outlined reference bars are filled with the surface color
  if (!fill || fill === "none" || fill.includes("surface")) {
    return mark.getAttribute("stroke") ?? "currentColor";
  }
  return fill;
}

function render(chart: SVGSVGElement, mark: Element, el: HTMLDivElement) {
  const x = mark.getAttribute("data-x") ?? "";
  let rows = Array.from(chart.querySelectorAll(MARK)).filter(
    m => m.getAttribute("data-x") === x
  );
  // line charts: order by value so the tooltip reads like a ranking
  if (mark.tagName === "circle") {
    rows = rows.sort(
      (a, b) =>
        Number(b.getAttribute("data-num")) - Number(a.getAttribute("data-num"))
    );
  }
  const hasError = rows.some(m => m.hasAttribute("data-error"));
  const body = rows
    .map(m => {
      const cls = m === mark ? ' class="is-active"' : "";
      const err = hasError
        ? `<td class="num">${m.getAttribute("data-error") ? `± ${m.getAttribute("data-error")}` : ""}</td>`
        : "";
      return (
        `<tr${cls}><td><span class="swatch" style="background:${swatchColor(m)}"></span>` +
        `${m.getAttribute("data-series")}</td><td class="num">${m.getAttribute("data-value")}</td>${err}</tr>`
      );
    })
    .join("");
  el.innerHTML = `<div class="chart-tip-head">${x}</div><table><tbody>${body}</tbody></table>`;
}

function position(
  card: HTMLElement,
  el: HTMLDivElement,
  clientX: number,
  clientY: number
) {
  const rect = card.getBoundingClientRect();
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  let left = clientX - rect.left + 14;
  let top = clientY - rect.top + 14;
  if (left + w > rect.width - 4)
    left = Math.max(4, clientX - rect.left - w - 14);
  if (top + h > rect.height - 4) top = Math.max(4, clientY - rect.top - h - 14);
  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
}

function show(
  chart: SVGSVGElement,
  mark: Element,
  clientX: number,
  clientY: number
) {
  const card = chart.closest<HTMLElement>(".chart-card");
  if (!card) return;
  const el = ensureTip(card);
  render(chart, mark, el);
  el.classList.add("is-visible");
  position(card, el, clientX, clientY);
}

function markOf(
  chart: SVGSVGElement,
  target: EventTarget | null
): Element | null {
  const mark = (target as Element | null)?.closest?.(MARK) ?? null;
  return mark && chart.contains(mark) ? mark : null;
}

function attach(chart: SVGSVGElement) {
  if (chart.dataset.tooltips) return;
  chart.dataset.tooltips = "on";
  for (const t of chart.querySelectorAll(`${MARK} > title`)) t.remove();
  for (const m of chart.querySelectorAll(MARK)) m.setAttribute("tabindex", "0");

  chart.addEventListener("pointerover", e => {
    const mark = markOf(chart, e.target);
    if (mark) show(chart, mark, e.clientX, e.clientY);
  });
  chart.addEventListener("pointermove", e => {
    if (!tip?.classList.contains("is-visible") || !activeCard) return;
    if (!markOf(chart, e.target)) return hide();
    position(activeCard, tip, e.clientX, e.clientY);
  });
  chart.addEventListener("pointerleave", hide);
  chart.addEventListener("focusin", e => {
    const mark = markOf(chart, e.target);
    if (!mark) return;
    const r = mark.getBoundingClientRect();
    show(chart, mark, r.left + r.width / 2, r.top);
  });
  chart.addEventListener("focusout", hide);
  chart.addEventListener("keydown", e => {
    if (e.key === "Escape") hide();
  });
}

function init() {
  document.querySelectorAll<SVGSVGElement>(SELECTOR).forEach(attach);
}

init();
document.addEventListener("astro:page-load", init);
