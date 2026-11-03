/**
 * Astro integration for the content convention of this blog:
 *
 *  - A post `src/content/posts/<name>.md(x)` is served at `/<name>` and keeps
 *    its assets in the sibling folder `src/content/posts/<name>/`. That folder
 *    is copied into the built page directory `dist/<name>/`, so
 *    `<name>/file.svg` resolves both in the repo and on the site (see
 *    src/plugins/remark-repo-links.mjs for the link rewriting).
 *
 *  - A post name must not collide with a fixed route (about, tags, ...);
 *    the build fails with a message otherwise.
 *
 *  - Posts migrated from the old Hexo site carry `legacyUrl` in their front
 *    matter. For each one a small redirect page is written at the old URL and
 *    the assets are also copied to the old date folder, where Hexo used to put
 *    them, so old deep links keep working.
 *
 *  - `redirects` adds the same kind of redirect page for non-post URLs; a key
 *    ending in `/` means the directory index (`/tags/Java/` -> tags/Java/index.html).
 *
 *  - The sitemap index is also written as `/sitemap.xml`, the name of the old
 *    sitemap; this integration must come after the sitemap integration.
 *
 *  - In `astro dev` the asset folders are served directly from
 *    src/content/posts/<name>/, so images and data links work there too.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import slugify from "slugify";

const POSTS_DIR = "src/content/posts";

function frontMatter(file) {
  const text = fs.readFileSync(file, "utf8");
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const fm = {};
  for (const line of (m?.[1] ?? "").split("\n")) {
    const kv = line.match(/^(\w+):\s*(.*?)\s*$/);
    if (kv) fm[kv[1]] = kv[2].replace(/^["']|["']$/g, "");
  }
  return fm;
}

function redirectPage(target, site) {
  const canonical = new URL(target, site).href;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Moved</title>
<meta http-equiv="refresh" content="0;url=${target}">
<link rel="canonical" href="${canonical}">
<meta name="robots" content="noindex">
</head>
<body><p>This page has moved to <a href="${target}">${target}</a>.</p></body>
</html>
`;
}

const TYPES = {
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".json": "application/json",
  ".gz": "application/gzip",
  ".csv": "text/csv; charset=utf-8",
  ".pdf": "application/pdf",
};

/** Names taken by fixed routes and public files; a post cannot use them. */
function reservedNames() {
  const strip = f => f.replace(/\.[^.]+$/, "");
  return new Set([
    ...fs.readdirSync("src/pages").map(strip),
    ...fs.readdirSync("public").map(strip),
  ]);
}

/** Dev server middleware: /<name>/<file> -> src/content/posts/<name>/<file>. */
function serveAssets(req, res, next) {
  const m = decodeURIComponent((req.url ?? "").split("?")[0]).match(
    /^\/([^/]+)\/(.+)$/
  );
  if (!m || m[2].includes("..") || /\.(md|mdx)$/.test(m[2])) return next();
  const file = path.join(POSTS_DIR, m[1], m[2]);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return next();
  res.setHeader(
    "Content-Type",
    TYPES[path.extname(file).toLowerCase()] ?? "text/plain; charset=utf-8"
  );
  fs.createReadStream(file).pipe(res);
}

/** The chart spec of a post is build input, not a published asset. */
const notSpec = src => path.basename(src) !== "charts.mjs";

function writeFile(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

export default function legacyUrls({ redirects = {} } = {}) {
  return {
    name: "legacy-urls",
    hooks: {
      "astro:server:setup": ({ server }) => {
        server.middlewares.use(serveAssets);
      },
      "astro:build:done": ({ dir, logger }) => {
        const dist = fileURLToPath(dir);
        const site = "https://cruftex.net/";
        const reserved = reservedNames();
        let count = 0;

        for (const entry of fs.readdirSync(POSTS_DIR)) {
          const m = entry.match(/^([^_].*)\.(md|mdx)$/);
          if (!m) continue;
          const name = m[1];
          if (name !== slugify(name, { lower: true })) {
            throw new Error(
              `${POSTS_DIR}/${entry}: file name must be lowercase kebab-case so it equals the URL slug`
            );
          }
          if (reserved.has(name)) {
            throw new Error(
              `${POSTS_DIR}/${entry}: "${name}" is taken by a page or public file, choose another file name`
            );
          }
          const fm = frontMatter(path.join(POSTS_DIR, entry));
          if (fm.draft === "true") continue;

          const pageDir = path.join(dist, name);
          const assets = path.join(POSTS_DIR, name);
          const hasAssets =
            fs.existsSync(assets) && fs.statSync(assets).isDirectory();
          if (hasAssets && fs.existsSync(pageDir)) {
            fs.cpSync(assets, pageDir, { recursive: true, filter: notSpec });
          }

          if (fm.legacyUrl) {
            const target = `/${name}`;
            writeFile(
              path.join(dist, fm.legacyUrl),
              redirectPage(target, site)
            );
            if (hasAssets) {
              fs.cpSync(assets, path.join(dist, path.dirname(fm.legacyUrl)), {
                recursive: true,
                force: false,
                errorOnExist: false,
                filter: notSpec,
              });
            }
            count++;
          }
        }

        for (const [from, to] of Object.entries(redirects)) {
          const file = from.endsWith("/") ? `${from}index.html` : from;
          writeFile(path.join(dist, file), redirectPage(to, site));
          count++;
        }
        logger.info(`wrote ${count} legacy redirect pages`);

        const sitemapIndex = path.join(dist, "sitemap-index.xml");
        if (fs.existsSync(sitemapIndex)) {
          fs.copyFileSync(sitemapIndex, path.join(dist, "sitemap.xml"));
          logger.info("copied sitemap-index.xml to sitemap.xml");
        }
      },
    },
  };
}
