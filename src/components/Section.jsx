import { motion } from 'framer-motion'
import { hrefFor } from '../lib/hooks.js'
import { t } from '../lib/ui.js'
import { useReveal } from '../hooks/useReveal.js'
import Asset from './Asset.jsx'
import Callout from './Callout.jsx'
import Markdown from './Markdown.jsx'
import { LinkIcon } from './Icons.jsx'

export function sectionDomId(chapterId, sectionId) {
  return `${chapterId}--${sectionId}`
}

export default function Section({
  chapter,
  section,
  lang,
  index = 0,
  eagerAssets = false,
  liveAssets = true,
}) {
  const domId = sectionDomId(chapter.id, section.id)
  // Stagger consecutive sections: +60ms each, capped at 180ms so a section
  // deep in a long chapter never feels like it's lagging behind the scroll.
  const reveal = useReveal(Math.min(index * 0.06, 0.18))

  return (
    <motion.section
      id={domId}
      data-section-id={section.id}
      data-reveal
      {...reveal}
      className="scroll-mt-[88px] pt-6"
    >
      <h2 className="group flex items-baseline gap-1 text-xl font-semibold tracking-tight text-ink">
        <span>{section.title[lang]}</span>
        <a
          href={hrefFor(chapter.id, section.id)}
          aria-label={t(lang, 'linkToSection')}
          // Premium micro-interaction: eased grow on hover, press-in on click.
          // `transition-all duration-300` covers the reveal-on-hover opacity,
          // the scale, and the background/colour shift in one smooth motion.
          className="print-hidden self-center rounded p-0.5 text-ink-3 opacity-0 transition-all duration-300 hover:scale-105 hover:bg-accent-soft hover:text-accent active:scale-95 focus-visible:opacity-100 group-hover:opacity-100"
        >
          <LinkIcon width="16" height="16" />
        </a>
      </h2>
      <div className="mt-2">
        <Markdown>{section.body[lang]}</Markdown>
      </div>
      {section.asset && (
        <Asset chapterId={chapter.id} asset={section.asset} lang={lang} eager={eagerAssets} live={liveAssets} />
      )}
      {section.callout && <Callout callout={section.callout} lang={lang} />}
    </motion.section>
  )
}
