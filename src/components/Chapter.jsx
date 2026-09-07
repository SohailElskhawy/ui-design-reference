import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { chapterIndex } from '../lib/content.js'
import { t } from '../lib/ui.js'
import { useReveal } from '../hooks/useReveal.js'
import Section from './Section.jsx'
import PrevNext from './PrevNext.jsx'

export function ChapterHeader({ chapter, lang }) {
  const number = String(chapterIndex(chapter.id) + 1).padStart(2, '0')
  return (
    <header className="border-b border-line pb-4">
      <p className="font-mono text-sm text-ink-3">
        {t(lang, 'chapter')} {number}
      </p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
        {chapter.title[lang]}
      </h1>
      {chapter.intro?.[lang] && (
        <p className="mt-2 max-w-[60ch] text-lg text-ink-2">{chapter.intro[lang]}</p>
      )}
    </header>
  )
}

export default function Chapter({ chapter, lang, onActiveSection }) {
  const ref = useRef(null)
  // Chapter root reveal. It re-mounts on every navigation (keyed by id in
  // App.jsx), so this doubles as a soft page-transition on chapter change.
  const reveal = useReveal()

  // Active-section tracking: the topmost section intersecting a band near the
  // top of the viewport wins.
  useEffect(() => {
    const root = ref.current
    if (!root || !('IntersectionObserver' in window)) return
    const nodes = Array.from(root.querySelectorAll('section[data-section-id]'))
    const visible = new Set()
    const update = () => {
      const first = nodes.find((n) => visible.has(n))
      if (first) onActiveSection(first.dataset.sectionId)
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.add(e.target)
          else visible.delete(e.target)
        }
        update()
      },
      { rootMargin: '-80px 0px -55% 0px', threshold: 0 },
    )
    nodes.forEach((n) => io.observe(n))
    if (nodes[0]) onActiveSection(nodes[0].dataset.sectionId)
    return () => io.disconnect()
  }, [chapter.id, onActiveSection])

  return (
    <motion.article
      ref={ref}
      data-reveal
      {...reveal}
      className="mx-auto w-full max-w-prose"
    >
      <ChapterHeader chapter={chapter} lang={lang} />
      {chapter.sections.map((section, i) => (
        // `index` drives the per-section stagger inside Section.jsx
        <Section key={section.id} chapter={chapter} section={section} lang={lang} index={i} />
      ))}
      <PrevNext chapter={chapter} lang={lang} />
    </motion.article>
  )
}
