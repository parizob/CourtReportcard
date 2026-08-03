/**
 * Single source of truth for public SEO / discoverability.
 *
 * When you add or rename a public marketing page:
 *   1. Add/update it here
 *   2. Add the route in src/App.jsx
 *   3. Run: npm run sync:seo
 *
 * Blog posts are pulled automatically from src/data/blogPosts.js.
 */

export const SITE_ORIGIN = 'https://www.courtreportcard.com'

/** Authenticated / private paths — never put these in sitemap or llms.txt */
export const DISALLOW_PATHS = ['/dashboard', '/reset-password']

/**
 * Static public pages (not blog posts).
 * section: which llms.txt link list they belong to
 *   - product | company | optional
 */
export const staticPages = [
  {
    path: '/',
    title: 'Home',
    llmsLabel: 'Home',
    llmsNote: 'Positioning and overview',
    section: 'product',
    changefreq: 'weekly',
    priority: 1.0,
  },
  {
    path: '/ourplatform',
    title: 'Our Platform',
    llmsLabel: 'Our Platform',
    llmsNote: 'Editor, annotations, accept/ignore, export',
    section: 'product',
    changefreq: 'monthly',
    priority: 0.9,
  },
  {
    path: '/pricing',
    title: 'Pricing',
    llmsLabel: 'Pricing',
    llmsNote: 'Token model and packs',
    section: 'product',
    changefreq: 'monthly',
    priority: 0.8,
  },
  {
    path: '/support',
    title: 'Support',
    llmsLabel: 'Support',
    llmsNote: 'FAQ and contact',
    section: 'product',
    changefreq: 'monthly',
    priority: 0.7,
  },
  {
    path: '/aboutus',
    title: 'About',
    llmsLabel: 'About',
    llmsNote: 'Origin story and mission',
    section: 'company',
    changefreq: 'monthly',
    priority: 0.7,
  },
  {
    path: '/privacy',
    title: 'Privacy Policy',
    llmsLabel: 'Privacy Policy',
    llmsNote: 'Full retention, encryption, and training policy',
    section: 'company',
    changefreq: 'yearly',
    priority: 0.3,
  },
  {
    path: '/terms',
    title: 'Terms of Service',
    llmsLabel: 'Terms of Service',
    llmsNote: 'Account and service terms',
    section: 'company',
    changefreq: 'yearly',
    priority: 0.3,
  },
  {
    path: '/dpa',
    title: 'Data Processing Agreement',
    llmsLabel: 'Data Processing Agreement',
    llmsNote: 'How we process uploaded transcript content',
    section: 'company',
    changefreq: 'yearly',
    priority: 0.3,
  },
  {
    path: '/blog',
    title: 'Blog',
    llmsLabel: 'Blog',
    llmsNote: 'Notes for court reporters',
    section: 'optional',
    changefreq: 'weekly',
    priority: 0.7,
  },
]

export function absoluteUrl(path) {
  if (path === '/') return `${SITE_ORIGIN}/`
  return `${SITE_ORIGIN}${path}`
}
