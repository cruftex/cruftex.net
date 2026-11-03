/**
 * Astro integration for the build-time charts (src/charts/):
 *  - `astro dev` renders /<post>/<out>.svg on request,
 *  - the build writes every chart as a standalone SVG into dist/<post>/,
 *    so direct links and the feed's <img> work. Nothing is committed.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { allCharts, renderPostChart } from "../charts/registry.mjs";

async function serveChart(req, res, next) {
  const m = decodeURIComponent((req.url ?? "").split("?")[0]).match(
    /^\/([^/]+)\/(.+\.svg)$/
  );
  if (!m) return next();
  try {
    const svg = await renderPostChart(m[1], m[2]);
    if (!svg) return next();
    res.setHeader("Content-Type", "image/svg+xml");
    res.end(svg);
  } catch (e) {
    next(e);
  }
}

export default function charts() {
  return {
    name: "charts",
    hooks: {
      "astro:server:setup": ({ server }) => {
        server.middlewares.use(serveChart);
      },
      "astro:build:done": async ({ dir, logger }) => {
        const dist = fileURLToPath(dir);
        let count = 0;
        for (const { post, out } of await allCharts()) {
          const file = path.join(dist, post, out);
          fs.mkdirSync(path.dirname(file), { recursive: true });
          fs.writeFileSync(file, await renderPostChart(post, out));
          count++;
        }
        logger.info(`wrote ${count} chart SVG files`);
      },
    },
  };
}
