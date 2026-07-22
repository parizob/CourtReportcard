import { getTag } from '../data/blogPosts'

export default function BlogTag({ tagId }) {
  const tag = getTag(tagId)
  if (!tag) return null

  return (
    <span
      className={`inline-flex items-center text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border ${tag.className}`}
    >
      {tag.shortLabel ? (
        <>
          <span className="sm:hidden">{tag.shortLabel}</span>
          <span className="hidden sm:inline">{tag.label}</span>
        </>
      ) : (
        tag.label
      )}
    </span>
  )
}
