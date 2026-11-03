# cruftex.net

Personal blog of Jens Wilke, built with [Astro](https://astro.build) and the
[AstroPaper](https://github.com/satnaing/astro-paper) theme (v6.1.0, MIT, see
`LICENSE.astro-paper`).

## Toolchain

- Node 24 (`.nvmrc`; `nvm use`)
- pnpm (pinned in `package.json` → `packageManager`; `corepack enable pnpm`
  if it isn't installed)

```sh
pnpm install          # once
pnpm dev              # http://localhost:4321, shows drafts
pnpm build            # dist/ (runs astro check, the build and the Pagefind index)
pnpm preview          # serve dist/
make up               # rsync dist/ to KeyCDN
pnpm update && pnpm audit   # Dependabot alerts: refresh the lockfile; for
                            # transitive packages `pnpm audit --fix` adds
                            # overrides to pnpm-workspace.yaml
```

## Writing a post

```sh
pnpm new "My Post Title"            # -> src/content/posts/my-post-title.mdx
pnpm new "My Post Title" short-name # -> src/content/posts/short-name.mdx
```

The file name is the URL: `src/content/posts/my-post-title.mdx` is served at
`/my-post-title`, at the site root. Keep file names lowercase kebab-case, and
not equal to a fixed page (`about`, `posts`, `tags`, `archives`, `search`); the
build fails otherwise.

Front matter:

```yaml
---
title: "My Post Title"
pubDatetime: 2026-10-10T14:03:00+02:00 # with offset; Europe/Berlin
description: "One or two sentences, shown in lists and the feed."
tags: [Java, caching]
featured: true # optional: pinned on the home page
draft: true # visible in `pnpm dev`, excluded from the build
---
```

Set `draft: false` (or remove the line) to publish.

### Images and data files

Put everything that belongs to a post into the folder with the same name and
link it relative to the repo, so the links work on GitHub and on the site:

```
src/content/posts/my-post-title.mdx
src/content/posts/my-post-title/graph.svg
src/content/posts/my-post-title/data/result.dat
```

```md
![Throughput by thread count](my-post-title/graph.svg)
[Raw data](my-post-title/data/result.dat)
See also [the earlier post](java-caching-benchmarks-part-3.mdx).
```

Every post is an `.mdx` file (also the ones without components), so links
between posts use the real file name, `name.md` or `name.mdx`, so they open in
the editor and on GitHub. The URL has no extension and no prefix:
`java-caching-benchmarks-part-3.mdx` is `/java-caching-benchmarks-part-3`.

At build time the asset folder is copied into the page directory
`dist/my-post-title/` and the links are rewritten to `/my-post-title/…`
(`src/plugins/remark-repo-links.mjs`,
`src/integrations/legacy-urls.mjs`). Don't put `.md`/`.mdx` files into an
asset folder; they would become posts.

### Charts

Charts are drawn from the raw data with [Observable Plot](https://observablehq.com/plot/)
during the build (`src/charts/`, nothing generated is committed): on the
site they are inlined as SVG and follow the light/dark theme, the standalone
`.svg` files land in `dist/` for the feed and direct links. GitHub shows the
image link only, not the chart.

1. Put the data table into the asset folder, e.g. `my-post-title/result.dat`:
   whitespace separated, a header row, first column = category. JMH style
   columns `name error lower upper` become a series with a confidence
   interval (whiskers), plain columns a series without.
2. Describe the chart in `my-post-title/charts.mjs`:

   ```js
   export default [
     {
       out: "result.chart.svg", // written next to the data
       data: "result.dat",
       title: "Throughput by thread count", // SVG <title>, tooltip of the file
       preset: "bars", // or "lines" (x = ordered categories)
       unit: "ops/s", // ops/s, bytes, bytes/s, bytes/op, s, MB, % or any label
       xLabel: x => `${x} threads`, // or { raw: "label" }; optional
       series: ["cache2k", "Caffeine"], // subset and order; optional
       yLabel: "operations per second", // optional
       note: "Whiskers show the 99.9 % confidence interval.", // optional, shown under the chart
       dataLink: false, // optional, default: the raw data is linked in the caption
     },
   ];
   ```

3. Link the chart like an image, by its `out` name:
   `![caption](my-post-title/result.chart.svg)`. `pnpm dev` renders it on
   the fly; `pnpm charts /tmp/charts` writes all charts as files to look at.
   The caption becomes the numbered figure caption with a link to the raw
   data; every bar and point has a tooltip (instant with JavaScript via
   `src/scripts/chart-tooltips.ts`, the browser's own otherwise).

Series colors are fixed per name in `src/charts/theme.mjs` (cache2k, Caffeine,
Guava, EhCache2, …; CHM, OPT and RAND are gray reference series). The colors
come from the validated data-viz palette; `src/styles/charts.css` holds the
light and dark values. For pages without a chart file (`.astro`, reports in
MDX) `src/components/Chart.astro` renders the same specs at build time.

### Markdown extras

- `## Table of contents` as a heading inserts a collapsible TOC.
- Code blocks: ` ```java title="Cache.java" ` shows a file name; see the Shiki
  transformers in `astro.config.ts` for line highlighting and diffs.
- `> [!NOTE]` / `> [!WARNING]` callouts (rehype-callouts).
- MDX: `import` components from `src/components/` at the top of the file.

## Old URLs

Posts migrated from the Hexo site carry `legacyUrl` in their front matter
(`/2017/09/01/Java-Caching-Benchmarks-Part-3.html`). The build writes a
redirect page at that path and also copies the post's assets to the old date
folder, so old deep links keep working. `/about.html`, the 2016 graphs page,
the old tag pages (`/tags/Java/`) and the year and month archives
(`/archives/2016/03/`) are redirected the same way (`redirects` in
`astro.config.ts`). The feed stays at `/atom.xml`, the sitemap is also
written under its old name `/sitemap.xml`.

## What was changed in the theme

Kept deliberately small so upstream changes can be diffed in:

- `astro-paper.config.ts`: site settings
- `astro.config.ts`: `legacyUrls` integration, `remarkRepoLinks` plugin
- `src/content.config.ts`: `legacyUrl` field
- `src/pages/atom.xml.ts`: feed with full content (was `rss.xml.ts`)
- `src/pages/2016/…-graphs.astro`: the graphs page
- `src/pages/index.astro`, `src/components/Footer.astro`, `src/i18n/*`: hero
  and footer text
- `src/pages/archives/index.astro`: `id` per year, target of the old archive
  URLs
- `src/styles/theme.css`: colors; `src/styles/typography.css`: sans-serif body
  text, white background for hand-drawn SVGs in dark mode
- `src/charts/*`, `scripts/charts.mjs`, `src/plugins/rehype-charts.mjs`,
  `src/components/Chart.astro`, `src/styles/charts.css`: build-time charts
  (Observable Plot), see "Charts" above
- `scripts/recover-hitrate-svg.mjs`: one-time recovery of the 2016 hit-rate
  tables (Part 2) from the old gnuplot SVGs, kept for provenance; the old
  gnuplot SVGs in the asset folders stay as backup and for old deep links
- `public/favicon.svg`
