# SEO / discoverability sync

Public crawl and agent-discovery files are **generated**. Hand-editing
`public/sitemap.xml`, `public/robots.txt`, or `public/llms.txt` will be
overwritten on the next sync or build.

## Why this exists

Search engines and LLM/agent crawlers should see a consistent, curated map of
public product pages — not private dashboard routes, and not a stale sitemap
after a new blog post or marketing page ships.

## Sources of truth

| Edit this | When |
|-----------|------|
| `scripts/seo/site.mjs` | Add, remove, or rename a public marketing page (path, priority, llms section/note). Also owns `DISALLOW_PATHS` for private routes. |
| `scripts/seo/llms-preamble.md` | Brand story, positioning, privacy summary, "how to describe us" |
| `src/data/blogPosts.js` | New or updated blog posts (sitemap + llms Optional links) |
| `src/App.jsx` | Must still register the route for any new public page |

Generated outputs (do not hand-edit):

- `public/sitemap.xml`
- `public/robots.txt`
- `public/llms.txt`

## Required agent habit

Whenever you add, remove, rename, or materially change a **public** marketing
page, blog post, or brand positioning that belongs in `llms-preamble.md`:

1. Update the relevant source of truth above.
2. Run `npm run sync:seo`.
3. Include the regenerated `public/*` files in the same change set when committing.

`npm run build` also runs sync first, so a production build will refresh the
files — but do **not** rely on that alone in a PR/commit. Sync locally so the
repo stays correct.

Drift check: `npm run check:seo` (exits 1 if generated output would differ).

## Private routes

Keep authenticated / sensitive paths in `DISALLOW_PATHS` in `site.mjs`
(currently `/dashboard`, `/reset-password`). Never list them in the sitemap or
in llms link lists.

## Brand rules for `llms-preamble.md`

Same external voice rules as the CMO skill:

- Never use "AI-powered" or lead with machine-learning branding
- Do not imply the product replaces court reporters or transcribes from audio
- No accuracy guarantees you cannot verify
- Prefer: second set of eyes, proofreading, catches errors, before it leaves your desk

If the wording is marketing-sensitive, defer to the CMO skill / brand voice —
but the CTO still owns running the sync so files do not drift.
