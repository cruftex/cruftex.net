import { defineAstroPaperConfig } from "./src/types/config";

export default defineAstroPaperConfig({
  site: {
    url: "https://cruftex.net/",
    title: "cruftex.net",
    description: "Personal blog of Jens Wilke: Java caching, benchmarks, Jenkins and the occasional rant.",
    author: "Jens Wilke",
    profile: "https://github.com/cruftex",
    lang: "en",
    timezone: "Europe/Berlin",
    dir: "ltr",
  },
  posts: {
    perPage: 10,
    perIndex: 5,
    scheduledPostMargin: 15 * 60 * 1000,
  },
  features: {
    lightAndDarkMode: true,
    dynamicOgImage: true,
    showArchives: true,
    showBackButton: true,
    editPost: { enabled: false },
    search: "pagefind",
  },
  socials: [
    { name: "github", url: "https://github.com/cruftex" },
    { name: "mail", url: "mailto:blogabout@cruftex.net" },
  ],
  // sharing buttons were removed from the old site on purpose
  shareLinks: [],
});
