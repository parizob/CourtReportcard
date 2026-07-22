import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import SiteFooter from '../components/SiteFooter'
import BlogTag from '../components/BlogTag'
import { blogPosts } from '../data/blogPosts'

export default function Blog() {
  return (
    <div className="bg-background text-on-surface font-body min-h-screen flex flex-col">
      <Helmet>
        <title>Blog | Court Reportcard</title>
        <meta
          name="description"
          content="Notes and updates from Court Reportcard for court reporters, scopists, and proofreaders."
        />
        <link rel="canonical" href="https://www.courtreportcard.com/blog" />
      </Helmet>

      <main className="flex-1 px-6 sm:px-8 py-10 sm:py-14 max-w-[1440px] mx-auto w-full">
        <div className="mb-10 sm:mb-14 max-w-2xl">
          <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-3">
            Blog
          </span>
          <h1 className="font-headline font-extrabold text-3xl sm:text-5xl text-on-surface tracking-tight mb-4">
            Notes from our desk
          </h1>
          <p className="text-base sm:text-lg text-on-surface-variant leading-relaxed">
            Updates, product notes, and practical tips for court reporters.
          </p>
        </div>

        {blogPosts.length === 0 ? (
          <section className="bg-surface-container-lowest rounded-2xl editorial-shadow border border-outline-variant/15 px-6 py-16 text-center">
            <span className="material-symbols-outlined text-on-surface-variant/30 text-4xl mb-3 block">article</span>
            <p className="text-sm font-semibold text-on-surface mb-1">No posts yet</p>
            <p className="text-sm text-on-surface-variant leading-relaxed max-w-sm mx-auto">
              We&apos;re getting this ready. Check back soon.
            </p>
          </section>
        ) : (
          <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {blogPosts.map((post) => (
              <Link
                key={post.slug}
                to={`/blog/${post.slug}`}
                className="group flex flex-col bg-surface-container-lowest rounded-2xl editorial-shadow border border-outline-variant/15 p-6 sm:p-8 transition-all hover:translate-y-[-2px]"
              >
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  {(post.tags ?? []).map((tagId) => (
                    <BlogTag key={tagId} tagId={tagId} />
                  ))}
                  {(post.tags?.length ?? 0) > 0 && (
                    <span className="text-outline-variant/40 text-xs" aria-hidden="true">·</span>
                  )}
                  <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                    <span className="sm:hidden">{post.dateLabelShort}</span>
                    <span className="hidden sm:inline">{post.dateLabel}</span>
                  </span>
                  <span className="text-outline-variant/40 text-xs" aria-hidden="true">·</span>
                  <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                    {post.readMinutes} min read
                  </span>
                </div>
                <h2 className="font-headline font-bold text-xl sm:text-2xl text-on-surface mb-3 group-hover:text-primary transition-colors">
                  {post.title}
                </h2>
                <p className="text-sm text-on-surface-variant leading-relaxed mb-4 flex-1">{post.excerpt}</p>
                <span className="inline-flex items-center gap-1.5 text-sm font-bold text-primary mt-auto">
                  <span className="group-hover:underline">Read post</span>
                  <span className="material-symbols-outlined text-base transition-transform group-hover:translate-x-1">arrow_forward</span>
                </span>
              </Link>
            ))}
          </section>
        )}
      </main>

      <SiteFooter />
    </div>
  )
}
