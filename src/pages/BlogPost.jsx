import { Link, useParams, Navigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import SiteFooter from '../components/SiteFooter'
import BlogTag from '../components/BlogTag'
import BlogLaunchHero from '../components/BlogLaunchHero'
import BlogTipsHero from '../components/BlogTipsHero'
import BlogIndustryHero from '../components/BlogIndustryHero'
import BlogBackboneHero from '../components/BlogBackboneHero'
import BlogMethodsHero from '../components/BlogMethodsHero'
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

  const primaryClassName =
    'inline-flex items-center justify-center bg-gradient-to-r from-primary to-primary-container text-on-primary px-7 py-3 rounded-lg font-bold text-base editorial-shadow transition-all hover:translate-y-[-2px] hover:scale-[1.02] active:scale-95'

  return (
    <div className="mt-10 mb-2 rounded-2xl border border-outline-variant/15 bg-surface-container-lowest editorial-shadow px-6 sm:px-8 py-7 sm:py-8">
      <p className="font-headline font-bold text-xl sm:text-2xl text-on-surface tracking-tight mb-2">
        {block.headline}
      </p>
      <p className="text-sm sm:text-base text-on-surface-variant leading-relaxed mb-6 max-w-xl">
        {block.text}
      </p>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        {isAuthenticated ? (
          <Link
            to="/dashboard"
            data-track-id={block.trackId}
            className={primaryClassName}
          >
            {block.buttonLabel}
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => openModal('signup')}
            data-track-id={block.trackId}
            className={primaryClassName}
          >
            {block.buttonLabel}
          </button>
        )}
        {block.secondaryLabel && block.secondaryTo && (
          <Link
            to={block.secondaryTo}
            data-track-id={`${block.trackId}_secondary`}
            className="group inline-flex items-center gap-1 text-primary font-bold text-base no-underline hover:no-underline transition-colors"
          >
            {block.secondaryLabel}
            <span
              className="material-symbols-outlined text-lg transition-transform duration-200 ease-out group-hover:translate-x-1"
              aria-hidden="true"
            >
              arrow_forward
            </span>
          </Link>
        )}
      </div>
    </div>
  )
}

function SectionArt({ kind }) {
  const label =
    kind === 'steno' ? 'Stenotype' : kind === 'voice' ? 'Voice writer' : kind === 'digital' ? 'Digital' : null
  if (!label) return null

  return (
    <div className="mb-4 flex items-center gap-3" aria-hidden="true">
      <div className="w-14 h-14 rounded-xl bg-secondary-container flex items-center justify-center shrink-0">
        {kind === 'steno' && (
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="4" y="8" width="24" height="16" rx="3" fill="#001939" />
            <rect x="7" y="12" width="5" height="4" rx="1" fill="#d6e3ff" />
            <rect x="13.5" y="12" width="5" height="4" rx="1" fill="#d6e3ff" />
            <rect x="20" y="12" width="5" height="4" rx="1" fill="#a9c7ff" />
            <rect x="10" y="18" width="5" height="4" rx="1" fill="#a9c7ff" />
            <rect x="17" y="18" width="5" height="4" rx="1" fill="#d6e3ff" />
          </svg>
        )}
        {kind === 'voice' && (
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="16" cy="12" rx="5" ry="7" fill="#001939" />
            <path d="M10 14c0 5 2.8 8 6 8s6-3 6-8" stroke="#4c5e84" strokeWidth="2" fill="none" strokeLinecap="round" />
            <line x1="16" y1="22" x2="16" y2="25" stroke="#4c5e84" strokeWidth="2" strokeLinecap="round" />
            <line x1="12" y1="25" x2="20" y2="25" stroke="#4c5e84" strokeWidth="2" strokeLinecap="round" />
          </svg>
        )}
        {kind === 'digital' && (
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="4" y="7" width="24" height="18" rx="3" fill="#001939" />
            <path
              d="M9 18v-4 M12 20v-8 M15 19v-6 M18 21v-10 M21 18v-5 M24 20v-7"
              stroke="#ffba38"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        )}
      </div>
      <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{label}</span>
    </div>
  )
}

function PostBlock({ block }) {
  if (block.type === 'h2') {
    return (
      <div className="mt-10 mb-4">
        {block.art && <SectionArt kind={block.art} />}
        <h2 className="font-headline font-bold text-xl sm:text-2xl text-on-surface">
          {block.text}
        </h2>
      </div>
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
        {post.hero === 'methods' && <BlogMethodsHero />}

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
