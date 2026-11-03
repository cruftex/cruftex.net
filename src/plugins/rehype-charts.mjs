/**
 * Rehype plugin: render and inline the charts of a post.
 *
 * A post references a chart like an image, `![caption](my-post/x.chart.svg)`,
 * which remark-repo-links turns into `/my-post/x.chart.svg`. If the
 * post's charts.mjs describes a chart with that `out` name, the chart is
 * rendered (src/charts/registry.mjs) and the <img> is replaced by a <figure>
 * holding the SVG itself, so the `var(--chart-*)` colors follow the page
 * theme. Other images are untouched. The standalone SVG file is written to
 * dist/ by src/integrations/charts.mjs.
 */
import path from "node:path";
import { fromHtml } from "hast-util-from-html";
import { renderPostChart } from "../charts/registry.mjs";

const el = (tagName, properties, children = []) => ({
  type: "element",
  tagName,
  properties,
  children,
});
const text = value => ({ type: "text", value: String(value) });

/** Parse a rendered chart into hast and prepare it for inlining. */
export function chartElement(svgText) {
  const svg = fromHtml(svgText, { fragment: true }).children.find(
    c => c.type === "element" && c.tagName === "svg"
  );
  if (!svg) return null;
  // The root <title> would show up as a native tooltip over the whole chart
  // (late, fighting the instant one); inlined, the name goes to aria-label.
  const title = svg.children.find(
    c => c.type === "element" && c.tagName === "title"
  );
  if (title) {
    svg.properties.ariaLabel = title.children.map(c => c.value ?? "").join("");
    delete svg.properties.ariaLabelledBy;
    svg.children = svg.children.filter(c => c !== title);
  }
  const desc = svg.children.find(
    c => c.type === "element" && c.tagName === "desc"
  );
  return {
    svg,
    note: desc?.children?.[0]?.value,
    data: svg.properties.dataData,
  };
}

/** The <figure> markup shared with src/components/Chart.astro. */
export function chartFigure(svg, { caption, note, post, data }) {
  const card = [el("div", { className: ["chart-scroll"] }, [svg])];
  if (note) card.push(el("p", { className: ["chart-sub"] }, [text(note)]));
  const figure = [el("div", { className: ["chart-card"] }, card)];
  const cap = [el("span", { className: ["fignum"] })];
  if (caption) cap.push(text(/[.!?]$/.test(caption) ? caption : `${caption}.`));
  if (data) {
    cap.push(
      el("span", { className: ["chart-source"] }, [
        text(" Raw data: "),
        el("a", { href: `/${post}/${data}` }, [text(path.basename(data))]),
      ])
    );
  }
  figure.push(el("figcaption", {}, cap));
  return el("figure", { className: ["chart-figure"] }, figure);
}

function* images(node, parent = null, index = 0) {
  if (node.type === "element" && node.tagName === "img")
    yield { node, parent, index };
  const children = node.children ?? [];
  for (let i = 0; i < children.length; i++) yield* images(children[i], node, i);
}

export default function rehypeCharts() {
  return async tree => {
    for (const { node, parent, index } of [...images(tree)]) {
      const m = String(node.properties?.src ?? "").match(
        /^\/([^/]+)\/(.+\.svg)$/
      );
      if (!m) continue;
      const [, post, out] = m;
      const svgText = await renderPostChart(post, out);
      if (!svgText) continue;
      const chart = chartElement(svgText);
      if (!chart) continue;
      const figure = chartFigure(chart.svg, {
        caption: node.properties.alt,
        note: chart.note,
        post,
        data: chart.data,
      });
      // an <img> alone in a <p> becomes the figure itself (a figure may not sit in a p)
      if (
        parent.tagName === "p" &&
        parent.children.filter(c => c.type !== "text" || c.value.trim())
          .length === 1
      ) {
        Object.assign(parent, figure);
      } else {
        parent.children[index] = figure;
      }
    }
  };
}
