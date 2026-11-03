/**
 * Cookieless page statistics with PostHog (EU Cloud).
 *
 * No cookies, no local or session storage, no person profiles: visitors are
 * counted via a daily rotating hash computed on PostHog's servers. Page views
 * and page leaves only. The PostHog project must have "cookieless server hash
 * mode" switched on, otherwise the events are dropped. Only active in
 * production builds, so `pnpm dev` stays silent.
 *
 * The slim build is about half the size of the default one (no surveys,
 * heatmaps, session replay or autocapture code) but does not watch the
 * history API, so the page view is sent on Astro's `astro:page-load`, which
 * fires on the first load and after every view transition navigation.
 */
import posthog from "posthog-js/dist/module.slim";

if (import.meta.env.PROD) {
  posthog.init("phc_AJc87tdLzSwRzD5kyhb6ChXDeJh84wcZzdNCSPTF4oLM", {
    api_host: "https://eu.i.posthog.com",
    defaults: "2026-08-30",
    cookieless_mode: "always",
    person_profiles: "never",
    capture_pageview: false,
    capture_pageleave: true,
    autocapture: false,
    disable_session_recording: true,
  });
  document.addEventListener("astro:page-load", () => {
    // The 404 page is served by the CDN under the missing URL and marks
    // itself with <meta name="http-status" content="404">.
    const status = document
      .querySelector('meta[name="http-status"]')
      ?.getAttribute("content");
    if (status === "404") {
      posthog.capture("$pageview", { http_status: 404 });
      posthog.capture("page_not_found", { path: location.pathname });
    } else {
      posthog.capture("$pageview");
    }
  });
}
