/**
 * Remark plugin: make repo-relative links work on the site.
 *
 * Posts are flat files in src/content/posts/ with assets in a sibling folder
 * of the same name, so these links are correct when browsing the repo:
 *
 *   [other article](other-post.mdx)      -> /other-post
 *   ![graph](my-post/graph.svg)           -> /my-post/graph.svg
 *   [raw data](my-post/data/x.dat)        -> /my-post/data/x.dat
 *
 * The asset folders are copied to dist/<name>/ by the legacy-urls
 * integration, so the rewritten URLs point at real files. Absolute URLs,
 * `/paths`, `#anchors` and `mailto:` links are left alone.
 */
import slugify from "slugify";

const POSTS_BASE = "/";
const isExternal = url => /^([a-z][a-z0-9+.-]*:|\/|#|\?)/i.test(url);

function rewrite(url) {
  const clean = url.replace(/^\.\//, "");
  const post = clean.match(/^([^/#?]+)\.(md|mdx)([#?].*)?$/);
  if (post) {
    return `${POSTS_BASE}${slugify(post[1], { lower: true })}${post[3] ?? ""}`;
  }
  return POSTS_BASE + clean;
}

function walk(node, fn) {
  fn(node);
  for (const child of node.children ?? []) walk(child, fn);
}

export default function remarkRepoLinks() {
  return tree => {
    walk(tree, node => {
      if (
        (node.type === "link" || node.type === "image") &&
        !isExternal(node.url)
      ) {
        node.url = rewrite(node.url);
      }
    });
  };
}
