#!/usr/bin/env node
/**
 * Regenerates public/sitemap.xml, public/robots.txt, and public/llms.txt
 * from scripts/seo/site.mjs + scripts/seo/llms-preamble.md + blogPosts.
 *
 *   npm run sync:seo          write files
 *   npm run check:seo         exit 1 if generated output would differ
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { blogPosts } from '../src/data/blogPosts.js'
import {
  SITE_ORIGIN,
  DISALLOW_PATHS,
  staticPages,
  absoluteUrl,
} from './seo/site.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const checkOnly = process.argv.includes('--check')

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function linkLine(label, url, note) {
  return note ? `- [${label}](${url}): ${note}` : `- [${label}](${url})`
}

function buildSitemap() {
  const urls = []

  for (const page of staticPages) {
    urls.push({
      loc: absoluteUrl(page.path),
      lastmod: todayISO(),
      changefreq: page.changefreq,
      priority: page.priority.toFixed(1),
      comment: page.title,
    })
  }

  for (const post of blogPosts) {
    urls.push({
      loc: absoluteUrl(`/blog/${post.slug}`),
      lastmod: post.date || todayISO(),
      changefreq: 'monthly',
      priority: '0.6',
      comment: `Blog: ${post.title}`,
    })
  }

  const body = urls
    .map((u) => `  <!-- ${u.comment.replace(/--/g, '-')} -->
  <url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`)
    .join('\n\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
          http://www.w3.org/2001/XMLSchema/sitemap.xsd">

${body}

</urlset>
`
}

function buildRobots() {
  const disallows = DISALLOW_PATHS.map((p) => `Disallow: ${p}`).join('\n')
  return `User-agent: *
Allow: /

# Keep authenticated app routes and auth flows out of the index
${disallows}

# LLM / agent site map (public product context only)
# ${SITE_ORIGIN}/llms.txt

# Sitemap
Sitemap: ${SITE_ORIGIN}/sitemap.xml
`
}

function buildLlms() {
  const preamblePath = join(__dirname, 'seo', 'llms-preamble.md')
  if (!existsSync(preamblePath)) {
    throw new Error(`Missing ${preamblePath}`)
  }
  const preamble = readFileSync(preamblePath, 'utf8').trimEnd()

  const bySection = (section) =>
    staticPages
      .filter((p) => p.section === section)
      .map((p) => linkLine(p.llmsLabel, absoluteUrl(p.path), p.llmsNote))

  const product = bySection('product')
  const company = bySection('company')
  const optional = [
    ...bySection('optional'),
    ...blogPosts.map((post) =>
      linkLine(
        post.title,
        absoluteUrl(`/blog/${post.slug}`),
        post.metaDescription || post.excerpt || undefined,
      ),
    ),
    linkLine('robots.txt', absoluteUrl('/robots.txt'), 'Crawl allow/deny'),
    linkLine('sitemap.xml', absoluteUrl('/sitemap.xml'), 'Full public URL list'),
  ]

  return `${preamble}

## Product pages

${product.join('\n')}

## Company and policies

${company.join('\n')}

## Optional

${optional.join('\n')}
`
}

function writeOrCheck(relPath, next) {
  const abs = join(root, relPath)
  const prev = existsSync(abs) ? readFileSync(abs, 'utf8') : null
  if (checkOnly) {
    if (prev !== next) {
      console.error(`[check:seo] drift: ${relPath}`)
      return false
    }
    console.log(`[check:seo] ok: ${relPath}`)
    return true
  }
  if (prev === next) {
    console.log(`unchanged: ${relPath}`)
    return true
  }
  writeFileSync(abs, next, 'utf8')
  console.log(`wrote: ${relPath}`)
  return true
}

const sitemap = buildSitemap()
const robots = buildRobots()
const llms = buildLlms()

let ok = true
ok = writeOrCheck('public/sitemap.xml', sitemap) && ok
ok = writeOrCheck('public/robots.txt', robots) && ok
ok = writeOrCheck('public/llms.txt', llms) && ok

if (checkOnly && !ok) {
  console.error('\nSEO files are out of date. Run: npm run sync:seo')
  process.exit(1)
}

if (!checkOnly) {
  console.log('\nSEO sync complete.')
}
