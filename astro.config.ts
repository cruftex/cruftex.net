import {
  defineConfig,
  envField,
  fontProviders,
  svgoOptimizer,
} from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import { unified } from "@astrojs/markdown-remark";
import remarkToc from "remark-toc";
import remarkCollapse from "remark-collapse";
import rehypeCallouts from "rehype-callouts";
import {
  transformerNotationDiff,
  transformerNotationHighlight,
  transformerNotationWordHighlight,
} from "@shikijs/transformers";
import { transformerFileName } from "./src/utils/transformers/fileName";
import config from "./astro-paper.config";
import legacyUrls from "./src/integrations/legacy-urls.mjs";
import charts from "./src/integrations/charts.mjs";
import remarkRepoLinks from "./src/plugins/remark-repo-links.mjs";
import rehypeCharts from "./src/plugins/rehype-charts.mjs";

export default defineConfig({
  site: config.site.url,
  // URLs carry no trailing slash (/my-post, /posts, /tags); the host serves
  // the directory index for both forms.
  trailingSlash: "never",
  integrations: [
    mdx(),
    charts(),
    sitemap({
      filter: page =>
        config.features?.showArchives !== false || !/\/archives\/?$/.test(page),
    }),
    // after sitemap(): it also copies sitemap-index.xml to the old /sitemap.xml
    legacyUrls({
      redirects: {
        "/about.html": "/about",
        "/2016/Java-Caching-Benchmarks-2016-Part-2-graphs.html":
          "/2016/Java-Caching-Benchmarks-2016-Part-2-graphs",
        // Hexo kept the tag's case; the comma tags were split into two
        "/tags/Java/": "/tags/java",
        "/tags/Cache/": "/tags/cache",
        "/tags/Jenkins/": "/tags/jenkins",
        "/tags/JMH/": "/tags/jmh",
        "/tags/Memory-Consumption/": "/tags/memory-consumption",
        "/tags/covid19-CDC/": "/tags/cdc",
        "/tags/covid19-Australia/": "/tags/australia",
        // Hexo year and month archives
        "/archives/2014/": "/archives#2014",
        "/archives/2014/12/": "/archives#2014",
        "/archives/2015/": "/archives#2015",
        "/archives/2015/11/": "/archives#2015",
        "/archives/2016/": "/archives#2016",
        "/archives/2016/03/": "/archives#2016",
        "/archives/2016/04/": "/archives#2016",
        "/archives/2016/05/": "/archives#2016",
        "/archives/2017/": "/archives#2017",
        "/archives/2017/03/": "/archives#2017",
        "/archives/2017/09/": "/archives#2017",
        "/archives/2020/": "/archives#2020",
        "/archives/2020/03/": "/archives#2020",
      },
    }),
  ],
  i18n: {
    locales: ["en"],
    defaultLocale: "en",
    routing: {
      prefixDefaultLocale: false,
    },
  },
  markdown: {
    processor: unified({
      remarkPlugins: [
        remarkRepoLinks,
        remarkToc,
        [remarkCollapse, { test: "Table of contents" }],
      ],
      rehypePlugins: [rehypeCallouts, rehypeCharts],
    }),
    shikiConfig: {
      themes: { light: "min-light", dark: "night-owl" },
      defaultColor: false,
      wrap: false,
      transformers: [
        transformerFileName({ style: "v2", hideDot: false }),
        transformerNotationHighlight(),
        transformerNotationWordHighlight(),
        transformerNotationDiff({ matchAlgorithm: "v3" }),
      ],
    },
  },
  vite: {
    plugins: [tailwindcss()],
    // chart rendering at build time (src/charts/) uses jsdom, keep it out of the SSR bundle
    ssr: { external: ["jsdom"] },
  },
  fonts: [
    {
      name: "Google Sans Code",
      cssVariable: "--font-google-sans-code",
      provider: fontProviders.google(),
      fallbacks: ["monospace"],
      weights: [300, 400, 500, 600, 700],
      styles: ["normal", "italic"],
      formats: ["woff", "ttf"],
    },
  ],
  env: {
    schema: {
      PUBLIC_GOOGLE_SITE_VERIFICATION: envField.string({
        access: "public",
        context: "client",
        optional: true,
      }),
    },
  },
  experimental: {
    svgOptimizer: svgoOptimizer(),
  },
});
