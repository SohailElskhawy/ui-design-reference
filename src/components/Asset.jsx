import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { assetUrl } from '../lib/content.js'
import { t } from '../lib/ui.js'
import { useReveal } from '../hooks/useReveal.js'
import { ImageIcon } from './Icons.jsx'

// A live diagram is an HTML file next to the image, same base name:
//   public/assets/<chapter>/<name>.html  (preferred on screen)
//   public/assets/<chapter>/<name>.png   (print, and fallback)
// The HTML must carry this marker in its <head>; scripts/sync-diagrams.mjs
// adds it. The marker is what lets us tell a real diagram from the dev
// server's index.html fallback for missing files.
const DIAGRAM_MARKER = 'name="ui-reference-diagram"'

// Very soft, high-blur ambient shadow at 5% opacity: a barely-there lift so
// the figure sits above the page. Never `shadow-inner` — an inset shadow on
// media reads as a broken/placeholder frame.
const SOFT_SHADOW = 'shadow-[0_8px_30px_rgba(0,0,0,0.05)]'

const probes = new Map()

function probeDiagram(url) {
  if (!probes.has(url)) {
    probes.set(
      url,
      fetch(url, { headers: { Accept: 'text/html' } })
        .then(async (res) => {
          if (!res.ok) return null
          const html = await res.text()
          return html.includes(DIAGRAM_MARKER) ? html : null
        })
        .catch(() => null),
    )
  }
  return probes.get(url)
}

// True once the element has come within ~600px of the viewport; stays true.
function useNear(ref, eager) {
  const [near, setNear] = useState(eager)
  useEffect(() => {
    if (eager || near) return
    const el = ref.current
    if (!el || !('IntersectionObserver' in window)) {
      setNear(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true)
          io.disconnect()
        }
      },
      { rootMargin: '600px 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [ref, eager, near])
  return near
}

function ratioStyle(ratio) {
  const [w, h] = String(ratio || '16:9').split(':').map(Number)
  return { aspectRatio: w > 0 && h > 0 ? `${w} / ${h}` : '16 / 9' }
}

function Placeholder({ chapterId, asset, lang, className = '' }) {
  return (
    <div
      role="img"
      aria-label={asset.alt?.[lang] || asset.brief}
      style={ratioStyle(asset.ratio)}
      className={`placeholder flex w-full flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-line-strong bg-surface p-3 text-center ${SOFT_SHADOW} ${className}`}
    >
      <ImageIcon className="text-ink-3" width="28" height="28" />
      <p className="text-xs font-medium uppercase tracking-wide text-ink-3">
        {t(lang, 'placeholder')}
      </p>
      {asset.brief && (
        <p dir="auto" className="max-w-[48ch] text-sm leading-[22px] text-ink-2">
          {asset.brief}
        </p>
      )}
      <p className="mt-0.5 text-xs text-ink-3">
        {t(lang, 'expectedFile')}:{' '}
        <code className="rounded-sm bg-raised px-0.5 text-ink-2">
          assets/{chapterId}/{asset.file}
        </code>
      </p>
    </div>
  )
}

function Figure({ chapterId, asset, lang, eager, live }) {
  const ref = useRef(null)
  const near = useNear(ref, eager)
  const [img, setImg] = useState('loading') // loading | ok | missing
  const [diagram, setDiagram] = useState(live ? 'probing' : 'none') // probing | none | <html>
  const [frameReady, setFrameReady] = useState(false)
  const alt = asset.alt?.[lang] || ''
  const base = asset.file.replace(/\.[a-z0-9]+$/i, '')
  const imgSrc = assetUrl(chapterId, asset.file)
  const diagramSrc = assetUrl(chapterId, `${base}.html`)

  useEffect(() => {
    if (!live || !near) return
    let cancelled = false
    probeDiagram(diagramSrc).then((html) => {
      if (!cancelled) setDiagram(html ?? 'none')
    })
    return () => {
      cancelled = true
    }
  }, [live, near, diagramSrc])

  const hasDiagram = diagram !== 'probing' && diagram !== 'none'
  // A loaded PNG stays on top until the live frame has actually rendered, so
  // the swap is PNG -> diagram with no blank frame in between.
  const showImage = img === 'ok' && !(hasDiagram && frameReady)
  const showPlaceholder = diagram === 'none' && img === 'missing'

  if (showPlaceholder) {
    return <Placeholder chapterId={chapterId} asset={asset} lang={lang} />
  }

  return (
    <div
      ref={ref}
      style={ratioStyle(asset.ratio)}
      className={`relative w-full overflow-hidden rounded-lg border border-line bg-raised ${SOFT_SHADOW}`}
    >
      {hasDiagram && (
        <iframe
          title={alt}
          srcDoc={diagram}
          sandbox="allow-scripts"
          loading={eager ? 'eager' : 'lazy'}
          scrolling="no"
          onLoad={() => setFrameReady(true)}
          className="print-hidden absolute inset-0 block h-full w-full border-0"
        />
      )}
      {/* Always mounted so native lazy loading (and printing) can fetch it.
          While unresolved it stays in layout but invisible: a display:none
          image with loading="lazy" never starts loading. */}
      <img
        src={imgSrc}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        onLoad={() => setImg('ok')}
        onError={() => setImg('missing')}
        className={`absolute inset-0 h-full w-full object-cover ${
          showImage ? '' : img === 'ok' ? 'print-only' : 'invisible'
        }`}
      />
      {hasDiagram && img === 'missing' && (
        <div className="print-only absolute inset-0">
          <Placeholder chapterId={chapterId} asset={asset} lang={lang} className="h-full" />
        </div>
      )}
    </div>
  )
}

export default function Asset({ chapterId, asset, lang, eager = false, live = true }) {
  if (!asset?.file) return null
  const alt = asset.alt?.[lang]
  // Figures sit inside an already-revealing Section; a 0.05s nudge keeps the
  // figure from landing at the exact same instant as its heading.
  const reveal = useReveal(0.05)
  return (
    <motion.figure data-reveal {...reveal} className="my-4">
      {/* key forces a fresh load state when the file changes */}
      <Figure
        key={`${chapterId}/${asset.file}`}
        chapterId={chapterId}
        asset={asset}
        lang={lang}
        eager={eager}
        live={live}
      />
      {alt && (
        <figcaption className="mt-1.5 text-sm leading-[22px] text-ink-2">{alt}</figcaption>
      )}
    </motion.figure>
  )
}
