import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useTextSelection } from '../hooks/useTextSelection.js'
import { saveNote } from '../lib/notes.js'
import { t } from '../lib/ui.js'
import { CloseIcon, PenIcon } from './Icons.jsx'

// Design-system easing — same cubic-bezier as tailwind.config.js `ease-out`.
const EASE = [0.2, 0, 0, 1]
// Gap between the highlighted text and the tooltip.
const GAP = 10
// If the selection sits this close to the top of the viewport, flip the
// tooltip below it instead of above.
const FLIP_ZONE = 96

/**
 * Medium-style selection tooltip.
 *
 *  1. Highlight text inside <main>  →  a tooltip fades + scales up above it.
 *  2. Click "Note"                  →  the tooltip smoothly expands into a
 *                                      textarea (Framer `layout` transition).
 *  3. Save / Esc / click-away / clear selection  →  it animates out.
 */
export default function SelectionTooltip({ lang = 'ar', chapterId = '' }) {
  const { text, rect, clear } = useTextSelection({ rootSelector: 'main' })
  const reduceMotion = useReducedMotion()

  const [mode, setMode] = useState('actions') // 'actions' | 'editing'
  const [draft, setDraft] = useState('')
  const [pinnedText, setPinnedText] = useState('') // text captured when editing starts
  const [saved, setSaved] = useState(false)
  const [box, setBox] = useState(null) // measured tooltip size { w, h }

  const shellRef = useRef(null)
  const textareaRef = useRef(null)
  const lastRectRef = useRef(null)
  const dismissTimer = useRef(0)

  if (rect) lastRectRef.current = rect
  // While editing we "pin" the tooltip: the selection may be gone (the caret is
  // in the textarea) but the last known rect keeps it anchored.
  const anchorRect = rect ?? lastRectRef.current
  const isEditing = mode === 'editing'
  const open = isEditing || Boolean(text && rect)

  const close = useCallback(() => {
    clearTimeout(dismissTimer.current)
    setMode('actions')
    setDraft('')
    setPinnedText('')
    setSaved(false)
    setBox(null)
    lastRectRef.current = null
    clear()
    window.getSelection()?.removeAllRanges()
  }, [clear])

  // Reset transient state whenever the tooltip is fully dismissed.
  useEffect(() => {
    if (!open) {
      setMode('actions')
      setDraft('')
      setPinnedText('')
      setSaved(false)
      setBox(null)
    }
  }, [open])

  // Measure after every content change so the position math has real numbers.
  useLayoutEffect(() => {
    if (!open) return
    const el = shellRef.current
    if (!el) return
    const w = el.offsetWidth
    const h = el.offsetHeight
    setBox((p) => (p && p.w === w && p.h === h ? p : { w, h }))
  }, [open, mode, saved, draft, anchorRect])

  // Focus the textarea as it appears.
  useEffect(() => {
    if (!isEditing || saved) return
    const id = setTimeout(() => textareaRef.current?.focus(), 0)
    return () => clearTimeout(id)
  }, [isEditing, saved])

  // Esc closes. A mousedown outside the tooltip closes it too — in the "actions"
  // state the browser also collapses the selection (which would hide us anyway),
  // and starting a fresh drag-selection re-opens it on the next mouseup.
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
      }
    }
    const onDown = (e) => {
      if (shellRef.current && !shellRef.current.contains(e.target)) {
        close()
      }
    }
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('mousedown', onDown, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('mousedown', onDown, true)
    }
  }, [open, close])

  useEffect(() => () => clearTimeout(dismissTimer.current), [])

  const startNote = () => {
    // `text` is normally still set; fall back to the live selection in case a
    // stray event cleared it between mousedown and click.
    setPinnedText(text || window.getSelection()?.toString().trim() || pinnedText)
    setSaved(false)
    setMode('editing')
  }

  // Keep the page highlight alive while the tooltip is clicked (buttons don't
  // need the default mousedown behaviour anyway).
  const keepSelection = (e) => e.preventDefault()

  const onSave = () => {
    const note = draft.trim()
    if (!note) {
      textareaRef.current?.focus()
      return
    }
    saveNote({ text: pinnedText, note, chapterId })
    setSaved(true)
    dismissTimer.current = setTimeout(close, 850) // brief confirmation, then dismiss
  }

  // ---- Position (viewport coords; the tooltip is position: fixed) ----------
  // Computed only while there's a live anchor. Once it's gone the conditional
  // below renders `null` and <AnimatePresence> plays the cached exit.
  let panel = null
  if (open && anchorRect) {
    const placeBelow = anchorRect.top < FLIP_ZONE
    const halfWidth = (box?.w ?? 0) / 2
    const left = box
      ? Math.min(Math.max(anchorRect.centerX, 8 + halfWidth), window.innerWidth - 8 - halfWidth) - halfWidth
      : anchorRect.centerX
    // Anchor from the bottom edge when placing above, so the card grows *upward*
    // as it expands into the editor and the `layout` transition reads naturally.
    const vertical = placeBelow
      ? { top: anchorRect.bottom + GAP }
      : { bottom: window.innerHeight - anchorRect.top + GAP }

    // Entrance: "fade-in & scale-up" from the edge nearest the selection.
    const entrance = reduceMotion
      ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
      : {
          initial: { opacity: 0, scale: 0.92 },
          animate: { opacity: 1, scale: 1 },
          exit: { opacity: 0, scale: 0.92 },
        }
    panel = (
        <motion.div
          key="selection-tooltip"
          ref={shellRef}
          data-selection-ui
          role="dialog"
          aria-label={t(lang, 'noteDialog')}
          {...entrance}
          transition={{ duration: 0.18, ease: EASE }}
          style={{
            position: 'fixed',
            left,
            ...vertical,
            zIndex: 50,
            transformOrigin: placeBelow ? 'top center' : 'bottom center',
            visibility: box ? 'visible' : 'hidden', // hide the pre-measure frame
          }}
          className="print-hidden"
        >
          {/* `layout` smoothly interpolates the card's size between the button
              and editor states (the "expansion" transition). `shadow-[…]` is the
              exact design-system soft shadow — 0 8px 30px @ 5% black. No inner
              shadow anywhere. */}
          <motion.div
            layout={!reduceMotion}
            transition={{ layout: { duration: 0.28, ease: EASE } }}
            className="overflow-hidden rounded-lg border border-line bg-surface text-ink shadow-[0_8px_30px_rgba(0,0,0,0.05)]"
          >
            {/* Keyed remount → the incoming state fades in; the outgoing one is
                dropped instantly and masked by the `layout` resize. */}
            <motion.div
              key={mode === 'editing' ? 'editor' : 'actions'}
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.16, ease: EASE }}
            >
              {mode === 'actions' ? (
                <div className="p-0.5">
                  <button
                    type="button"
                    onClick={startNote}
                    onMouseDown={keepSelection}
                    // Premium micro-interaction: eased scale on hover / press + a
                    // soft accent wash, all in one transition.
                    className="flex items-center gap-1 rounded-sm px-1.5 py-1 text-sm font-medium text-ink transition-all duration-300 hover:scale-105 hover:bg-accent-soft hover:text-accent-ink active:scale-95"
                  >
                    <PenIcon width="16" height="16" />
                    {t(lang, 'addNote')}
                  </button>
                </div>
              ) : (
                <div className="w-[min(20rem,calc(100vw-16px))] p-1.5">
                  {saved ? (
                    <p className="px-0.5 py-1 text-sm font-medium text-accent-ink">{t(lang, 'noteSaved')}</p>
                  ) : (
                    <>
                      <div className="mb-1.5 flex items-start gap-1">
                        <p
                          dir="auto"
                          className="line-clamp-2 flex-1 border-s-2 border-accent ps-1.5 text-xs italic leading-[18px] text-ink-3"
                        >
                          {pinnedText}
                        </p>
                        <button
                          type="button"
                          onClick={close}
                          onMouseDown={keepSelection}
                          aria-label={t(lang, 'close')}
                          className="-me-0.5 -mt-0.5 shrink-0 rounded-sm p-0.5 text-ink-3 transition-all duration-300 hover:scale-105 hover:text-ink active:scale-95"
                        >
                          <CloseIcon width="14" height="14" />
                        </button>
                      </div>

                      <textarea
                        ref={textareaRef}
                        dir="auto"
                        rows={3}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                            e.preventDefault()
                            onSave()
                          }
                        }}
                        placeholder={t(lang, 'notePlaceholder')}
                        className="w-full resize-none rounded-sm border border-line bg-bg p-1 text-sm leading-[20px] text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
                      />

                      <div className="mt-1.5 flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={close}
                          onMouseDown={keepSelection}
                          className="rounded-sm px-1.5 py-1 text-xs font-medium text-ink-2 transition-all duration-300 hover:scale-105 hover:text-ink active:scale-95"
                        >
                          {t(lang, 'cancel')}
                        </button>
                        <button
                          type="button"
                          onClick={onSave}
                          onMouseDown={keepSelection}
                          className="rounded-sm bg-accent px-2 py-1 text-xs font-medium text-bg transition-all duration-300 hover:scale-105 hover:bg-accent-ink active:scale-95"
                        >
                          {t(lang, 'saveNote')}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </motion.div>
          </motion.div>
        </motion.div>
    )
  }

  return createPortal(<AnimatePresence>{panel}</AnimatePresence>, document.body)
}
