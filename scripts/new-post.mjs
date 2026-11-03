#!/usr/bin/env node
/* eslint-disable no-console -- CLI script */
/**
 * Create a new draft post:  pnpm new "My Post Title" [file-name]
 *
 * Writes src/content/posts/<file-name>.mdx and creates the asset folder
 * src/content/posts/<file-name>/ next to it. The post is served at
 * /<file-name> once `draft: true` is removed.
 */
import fs from "node:fs";
import path from "node:path";
import slugify from "slugify";

const [title, explicitName] = process.argv.slice(2);
if (!title) {
  console.error('usage: pnpm new "My Post Title" [file-name]');
  process.exit(1);
}

const name = slugify(explicitName ?? title, { lower: true, strict: true });
const dir = "src/content/posts";
const file = path.join(dir, `${name}.mdx`);
if (fs.existsSync(file)) {
  console.error(`${file} already exists`);
  process.exit(1);
}

// pubDatetime in Europe/Berlin with explicit offset, e.g. 2026-10-10T14:03:00+02:00
const now = new Date();
const parts = Object.fromEntries(
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    timeZoneName: "longOffset",
  })
    .formatToParts(now)
    .map(p => [p.type, p.value])
);
const offset = parts.timeZoneName.replace("GMT", "") || "+00:00";
const pubDatetime = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${offset}`;

fs.writeFileSync(
  file,
  `---
title: ${JSON.stringify(title)}
pubDatetime: ${pubDatetime}
description: ""
tags: []
draft: true
---

Write here. Put images and data files into \`${name}/\` and link them as
\`![caption](${name}/figure.svg)\` or \`[raw data](${name}/data.csv)\`.
`
);
fs.mkdirSync(path.join(dir, name), { recursive: true });
console.log(`created ${file}  (assets: ${dir}/${name}/, url: /${name})`);
