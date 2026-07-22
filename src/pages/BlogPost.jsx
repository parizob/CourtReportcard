import { Link, useParams, Navigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import SiteFooter from '../components/SiteFooter'
import BlogTag from '../components/BlogTag'
import BlogLaunchHero from '../components/BlogLaunchHero'
import BlogTipsHero from '../components/BlogTipsHero'
import { getPostBySlug } from '../data/blogPosts'

function PostBlock({ block }) {
  if (block.type === 'h2') {
    return (
      <h2 className="font-headline font-bold text-xl sm:text-2xl text-on-surface mt-10 mb-4">
        {block.text}
      </h2>
    )
  }

  if (block.type === 'callout') {
    return (
      <div className="my-6 rounded-xl border border-primary/20 bg-primary/[0.04] px-5 py-4">
        <p className="text-sm sm:text-base text-on-surface leading-relaxed font-medium">{block.text}</p>
      </div>
    )
  }

  if (block.type === 'pairs') {
    return (
      <ul className="space-y-4 my-6">
        {block.items.map((item) => (
          <li
            key={`${item.left}-${item.right}`}
            className="bg-surface-container-lowest rounded-xl border border-outline-variant/15 p-5 editorial-shadow"
          >
            <p className="font-headline font-bold text-base text-on-surface mb-2">
              <span className="text-primary">{item.left}</span>
              <span className="text-on-surface-variant font-medium mx-2">vs</span>
              <span className="text-primary">{item.right}</span>
            </p>
            <p className="text-sm text-on-surface-variant leading-relaxed">{item.tip}</p>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <p className="text-sm sm:text-base text-on-surface-variant leading-relaxed mb-4">
      {block.text}
    </p>
  )
}

export default function BlogPost() {
  const { slug } = useParams()
  const post = getPostBySlug(slug)

  if (!post) return <Navigate to="/blog" replace />

  return (
    <div className="bg-background text-on-surface font-body min-h-screen flex flex-col">
      <Helmet>
        <title>{post.title} | Court Reportcard Blog</title>
        <meta name="description" content={post.metaDescription} />
        <link rel="canonical" href={`https://www.courtreportcard.com/blog/${post.slug}`} />
      </Helmet>

      <main className="flex-1 px-6 sm:px-8 py-10 sm:py-14 max-w-3xl mx-auto w-full">
        <Link
          to="/blog"
          className="group inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-on-surface-variant hover:text-primary transition-colors mb-8"
        >
          <span className="material-symbols-outlined text-sm transition-transform group-hover:-translate-x-1">arrow_back</span>
          <span className="group-hover:underline">Back to Blog</span>
        </Link>

        <header className="mb-8 sm:mb-10">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {(post.tags ?? []).map((tagId) => (
              <BlogTag key={tagId} tagId={tagId} />
            ))}
          </div>
          <h1 className="font-headline font-extrabold text-3xl sm:text-4xl text-on-surface tracking-tight mb-4 leading-tight">
            {post.title}
          </h1>
          <p className="text-sm text-on-surface-variant">
            <span className="sm:hidden">{post.dateLabelShort}</span>
            <span className="hidden sm:inline">{post.dateLabel}</span>
            <span className="mx-2 text-outline-variant/40">·</span>
            {post.readMinutes} min read
          </p>
        </header>

        {post.hero === 'launch' && <BlogLaunchHero />}
        {post.hero === 'tips' && <BlogTipsHero />}

        <article>
          {post.content.map((block, i) => (
            <PostBlock key={i} block={block} />
          ))}
        </article>
      </main>

      <SiteFooter />
    </div>
  )
}
