# Rules for working on cruftex.net

Toolchain, content layout, charts and the old-URL handling are described in
`README.md`. This file holds the rules for the texts.

## Language and style

- UK English: -ise/-isation (optimise, analyse, serialisation), behaviour,
  colour, favour, licence (noun) / license (verb). A computer program stays
  "program". Code, identifiers, URLs, quoted text and proper names (Apache
  License, Stack Overflow) are not touched.
- After a colon, the next word starts with a capital letter when a clause
  follows ("The fine print: The configuration is not an official API."). Not
  in code and not in `key: value` lists.
- No comma in front of "and" or "or", neither in lists (no Oxford comma) nor
  between clauses.
- Keep the author's voice: Direct, informal, first person, opinions and
  exclamation marks stay. No corporate tone, no softening of statements.

## Editing existing posts

- Fix typos, grammar and punctuation. Straighten a sentence only when it trips
  the reader, with the smallest possible change.
- Never change claims, numbers, dates, benchmark results, code blocks,
  commands, file names or quoted third-party text.
- Headings stay as they are (they are anchors and table of contents entries),
  except for a typo inside one.
- Front matter: `pubDatetime`, `tags` and `legacyUrl` are never changed. Do
  not set `modDatetime`, the home page sorts by it.
- An edited post gets an update note as the last element, a callout:

  ```md
  > [!NOTE]
  > Update 2026: Typo and wording fixes, switch to UK English.
  ```

## Review

When reviewing a draft or an existing post, point out:

- Lecturing style: Passages that tell others what they should do. The posts
  are about what we can do better, what we tried and what we found, not
  about what others should do. Suggest the first-person, experience-based
  version instead.
- Claims without a number, a measurement or a source next to them.
- Opinions presented before the facts; the facts come first.

## Links

- Links between posts use the real file name (`other-post.mdx`, with
  `#anchor` if needed), assets the folder with the post's name
  (`my-post/graph.svg`). The build rewrites them to the site URLs; they also
  work in the editor and on GitHub.
- Anchors are lowercase (`#conclusion`), as the build generates them.
