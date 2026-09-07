import { useCallback, useEffect, useRef, useState } from 'react'

const EMPTY = { text: '', rect: null }

/**
 * Tracks the live text selection and reports the string plus the geometry a
 * floating UI needs to anchor itself above (or below) the highlighted text.
 *
 * Coordinates are **viewport-relative** (straight from `Range.getBoundingClientRect()`),
 * so the consuming tooltip should be `position: fixed`.
 *
 * @param {object}  [options]
 * @param {string}  [options.rootSelector='main']   Only selections whose common
 *        ancestor lives inside this element are reported — keeps the tooltip off
 *        page chrome (nav, top bar, footer).
 * @param {string}  [options.ignoreSelector='[data-selection-ui]']  Selections
 *        anchored inside a matching element are ignored (e.g. text dragged
 *        inside the note editor itself).
 * @param {number}  [options.minLength=1]           Minimum trimmed length.
 *
 * @returns {{
 *   text: string,
 *   rect: null | {
 *     top:number, bottom:number, left:number, right:number,
 *     width:number, height:number, centerX:number
 *   },
 *   clear: () => void,
 * }}
 */
export function useTextSelection({
  rootSelector = 'main',
  ignoreSelector = '[data-selection-ui]',
  minLength = 1,
} = {}) {
  const [selection, setSelection] = useState(EMPTY)
  const timerRef = useRef(0)

  const clear = useCallback(() => {
    setSelection((prev) => (prev.text ? EMPTY : prev))
  }, [])

  useEffect(() => {
    const elementOf = (node) =>
      node ? (node.nodeType === 1 ? node : node.parentElement) : null

    const read = () => {
      const sel = window.getSelection()
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return clear()

      const text = sel.toString().trim()
      if (text.length < minLength) return clear()

      const range = sel.getRangeAt(0)
      const anchorEl = elementOf(range.commonAncestorContainer)

      // Selection inside our own tooltip — leave state untouched (the component
      // keeps its own "pinned" copy of the text while editing).
      if (ignoreSelector && anchorEl?.closest(ignoreSelector)) return

      // Selection outside the content region — treat as "nothing selected".
      if (rootSelector) {
        const root = document.querySelector(rootSelector)
        if (root && !root.contains(anchorEl)) return clear()
      }

      const r = range.getBoundingClientRect()
      if (r.width === 0 && r.height === 0) return clear()

      setSelection((prev) => {
        // Skip no-op updates so a scroll doesn't re-render the tree every frame.
        if (
          prev.text === text &&
          prev.rect &&
          Math.abs(prev.rect.top - r.top) < 0.5 &&
          Math.abs(prev.rect.left - r.left) < 0.5 &&
          Math.abs(prev.rect.width - r.width) < 0.5
        ) {
          return prev
        }
        return {
          text,
          rect: {
            top: r.top,
            bottom: r.bottom,
            left: r.left,
            right: r.right,
            width: r.width,
            height: r.height,
            centerX: r.left + r.width / 2,
          },
        }
      })
    }

    // Debounce-coalesce: selectionchange + mouseup + keyup can all fire for one
    // drag. A short timeout (not rAF) so it still resolves in a background tab.
    const schedule = () => {
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(read, 16)
    }

    document.addEventListener('selectionchange', schedule)
    document.addEventListener('mouseup', schedule)
    document.addEventListener('keyup', schedule)
    // Keep the anchor glued to the text as the page moves; drop it if the
    // selection is gone. `true` = capture, so nested scrollers count too.
    window.addEventListener('scroll', schedule, true)
    window.addEventListener('resize', schedule)

    return () => {
      clearTimeout(timerRef.current)
      document.removeEventListener('selectionchange', schedule)
      document.removeEventListener('mouseup', schedule)
      document.removeEventListener('keyup', schedule)
      window.removeEventListener('scroll', schedule, true)
      window.removeEventListener('resize', schedule)
    }
  }, [rootSelector, ignoreSelector, minLength, clear])

  return { ...selection, clear }
}

export default useTextSelection
