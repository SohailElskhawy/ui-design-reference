import { motion } from 'framer-motion'
import { t } from '../lib/ui.js'
import { useReveal } from '../hooks/useReveal.js'
import Markdown from './Markdown.jsx'
import { AlertIcon, InfoIcon, PenIcon } from './Icons.jsx'

// Visual treatment per callout type. `quote` is rendered separately below.
const styles = {
  tip: {
    Icon: InfoIcon,
    box: 'border-accent/25 bg-accent-soft',
    icon: 'text-accent',
    label: 'text-accent-ink',
  },
  warning: {
    Icon: AlertIcon,
    box: 'border-warn/30 bg-warn-soft',
    icon: 'text-warn',
    label: 'text-warn',
  },
  // Content the course author added that is not in the source book. Cool
  // colour + dashed border so it reads as "different" next to tip/warning,
  // and the dashed edge survives the colour-stripping print stylesheet.
  note: {
    Icon: PenIcon,
    box: 'border-dashed border-note/50 bg-note-soft',
    icon: 'text-note',
    label: 'text-note',
  },
}

// Very soft, high-blur ambient shadow at 5% opacity: lifts the card a little
// off the page with no visible hard edge. Never `shadow-inner` — an inset
// shadow makes a callout look like a disabled input well.
const SOFT_SHADOW = 'shadow-[0_8px_30px_rgba(0,0,0,0.05)]'

export default function Callout({ callout, lang }) {
  if (!callout) return null
  const text = callout[lang] ?? callout.en
  const type = callout.type || 'tip'
  // Callouts trail their section's prose and figure, so a small fixed delay
  // lets them settle in just after the rest of the section — a light stagger.
  const reveal = useReveal(0.1)

  if (type === 'quote') {
    return (
      <motion.blockquote
        data-reveal
        {...reveal}
        className="callout my-4 border-s-2 border-accent ps-3"
      >
        <Markdown className="text-lg italic leading-[30px] text-ink [&_p]:text-lg [&_p]:leading-[30px]">{text}</Markdown>
      </motion.blockquote>
    )
  }

  const style = styles[type] ?? styles.tip
  const { Icon } = style
  return (
    <motion.aside
      data-reveal
      {...reveal}
      data-callout={type}
      className={`callout my-4 flex gap-1.5 rounded-lg border p-2 text-ink ${style.box} ${SOFT_SHADOW}`}
    >
      <Icon className={`mt-0.5 shrink-0 ${style.icon}`} />
      <div>
        <p className={`text-xs font-semibold uppercase tracking-wide ${style.label}`}>
          {t(lang, type)}
        </p>
        <Markdown className="mt-0.5">{text}</Markdown>
      </div>
    </motion.aside>
  )
}
