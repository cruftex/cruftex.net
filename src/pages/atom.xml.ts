/**
 * Feed at the URL the old Hexo site used (/atom.xml). Like the old feed it
 * carries the full article HTML, so readers don't have to click through.
 */
import rss from "@astrojs/rss";
import { getCollection, render } from "astro:content";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import mdxRenderer from "@astrojs/mdx/server.js";
import { getSortedPosts } from "@/utils/getSortedPosts";
import { getPostUrl } from "@/utils/getPostPaths";
import config from "@/config";

/** Feed readers need absolute URLs; the site renders root-relative ones. */
function absolutize(html: string): string {
  return html.replace(
    /(src|href)="(\/[^"/][^"]*)"/g,
    (_, attr, path) => `${attr}="${new URL(path, config.site.url).href}"`
  );
}

/**
 * Charts are inlined as <svg> on the site (see src/plugins/rehype-charts.mjs);
 * feed readers get the static SVG file instead, via the data-src it carries.
 */
function chartsAsImages(html: string): string {
  return html.replace(
    /<svg[^>]*class="plot-chart"[^>]*data-src="([^"]+)"[^>]*>[\s\S]*?<\/svg>\s*<\/svg>/g,
    (_, src) => `<img src="/${src}" alt="chart">`
  );
}

export async function GET() {
  const posts = await getCollection("posts");
  const sortedPosts = getSortedPosts(posts);

  const container = await AstroContainer.create();
  container.addServerRenderer({ name: "astro:jsx", renderer: mdxRenderer });

  const items = [];
  for (const post of sortedPosts) {
    const { Content } = await render(post);
    const html = await container.renderToString(Content);
    items.push({
      link: getPostUrl(post.id, post.filePath, config.site.lang),
      title: post.data.title,
      description: post.data.description,
      pubDate: new Date(post.data.modDatetime ?? post.data.pubDatetime),
      content: absolutize(chartsAsImages(html)),
      categories: post.data.tags,
    });
  }

  return rss({
    title: config.site.title,
    description: config.site.description,
    site: config.site.url,
    trailingSlash: false,
    items,
  });
}
