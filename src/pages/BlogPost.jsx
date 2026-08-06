import { Link, useParams, Navigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import SiteFooter from '../components/SiteFooter'
import BlogTag from '../components/BlogTag'
import BlogLaunchHero from '../components/BlogLaunchHero'
import BlogTipsHero from '../components/BlogTipsHero'
import BlogIndustryHero from '../components/BlogIndustryHero'
import BlogBackboneHero from '../components/BlogBackboneHero'
import { useAuth } from '../context/AuthContext'
import { getPostBySlug } from '../data/blogPosts'

function RichText({ parts, text }) {
  if (!parts?.length) return text
  return parts.map((part, i) => {
    if (part.href) {
      return (
        <a
          key={i}
          href={part.href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary font-semibold underline underline-offset-2 hover:text-primary/80 transition-colors"
        >
          {part.text}
        </a>
      )
    }
    return <span key={i}>{part.text}</span>
  })
}

function PostCta({ block }) {
  const { openModal, isAuthenticated } = useAuth()

  return (
    <div className="mt-10 mb-2 rounded-2xl border border-outline-variant/15 bg-surface-container-lowest editorial-shadow px-6 sm:px-8 py-7 sm:py-8">
      <p className="font-headline font-bold text-xl sm:text-2xl text-on-surface tracking-tight mb-2">
        {block.headline}
      </p>
      <p className="text-sm sm:text-base text-on-surface-variant leading-relaxed mb-6 max-w-xl">
        {block.text}
      </p>
      <div className="flex flex-wrap gap-3">
        {isAuthenticated ? (
          <Link
            to="/dashboard"
            data-track-id={block.trackId}
            className="inline-flex items-center justify-center bg-gradient-to-r from-primary to-primary-container text-on-primary px-6 py-3 rounded-lg font-bold text-sm hover:scale-[1.02] active:scale-95 transition-all editorial-shadow"
          >
            {block.buttonLabel}
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => openModal('signup')}
            data-track-id={block.trackId}
            className="bg-gradient-to-r from-primary to-primary-container text-on-primary px-6 py-3 rounded-lg font-bold text-sm hover:scale-[1.02] active:scale-95 transition-all editorial-shadow"
          >
            {block.buttonLabel}
          </button>
        )}
        {block.secondaryLabel && block.secondaryTo && (
          <Link
            to={block.secondaryTo}
            data-track-id={`${block.trackId}_secondary`}
            className="inline-flex items-center justify-center border-2 border-primary/30 text-primary px-6 py-3 rounded-md font-bold text-sm hover:bg-primary/10 hover:border-primary/10 transition-all"
          >
            {block.secondaryLabel}
          </Link>
        )}
      </div>
    </div>
  )
}

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
        <p className="text-sm sm:text-base text-on-surface leading-relaxed font-medium">
          <RichText parts={block.parts} text={block.text} />
        </p>
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

  if (block.type === 'cta') {
    return <PostCta block={block} />
  }

  return (
    <p className="text-sm sm:text-base text-on-surface-variant leading-relaxed mb-4">
      <RichText parts={block.parts} text={block.text} />
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
        {post.hero === 'industry' && <BlogIndustryHero />}
        {post.hero === 'backbone' && <BlogBackboneHero />}

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
