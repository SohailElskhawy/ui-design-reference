import Fuse from 'fuse.js'
import { chapters } from './content.js'

// Very small markdown → text stripper so search matches prose, not syntax.
export function stripMarkdown(md = '') {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/\|/g, ' ')
    .replace(/[*_~]{1,3}/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// ---------------------------------------------------------------------------
// Arabic text normalization
// ---------------------------------------------------------------------------
// Arabic has several ways to write what a reader treats as "the same" letter,
// and users almost never type diacritics. Folding these forms on BOTH the
// indexed text and the query is what makes fuzzy search usable in Arabic:
//
//   - Alef forms  U+0623 U+0625 U+0622 U+0671 + superscript alef  -> U+0627 (ا)
//   - Alef maqsura U+0649 (ى)                                      -> U+064A (ي)
//   - Ta marbuta  U+0629 (ة)                                       -> U+0647 (ه)
//   - Hamza carriers U+0624 (ؤ) U+0626 (ئ)                         -> U+0648 / U+064A
//   - Lone hamza  U+0621 (ء)                                       -> dropped
//   - Tashkeel  U+064B..U+065F, U+0670                             -> dropped
//   - Tatweel  U+0640 (ـ)                                          -> dropped
//   - Arabic-Indic digits U+0660..U+0669                           -> 0..9
//
// Letter substitutions are 1:1 so match offsets stay aligned with the original
// string for excerpting; only tashkeel/tatweel change length, and this corpus
// has essentially none.
const LETTER_MAP = {
  'آ': 'ا', // آ -> ا
  'أ': 'ا', // أ -> ا
  'إ': 'ا', // إ -> ا
  'ٱ': 'ا', // ٱ -> ا
  'ى': 'ي', // ى -> ي
  'ة': 'ه', // ة -> ه
  'ؤ': 'و', // ؤ -> و
  'ئ': 'ي', // ئ -> ي
}
const TASHKEEL = /[ً-ٰٟ]/g // harakat, tanwin, shadda, superscript alef
const TATWEEL = /ـ/g // ـ
const LONE_HAMZA = /ء/g // ء
const ARABIC_INDIC_DIGITS = /[٠-٩]/g // ٠..٩
const FOLDABLE_LETTERS = /[آأإٱىةؤئ]/g

export function normalizeArabic(input = '') {
  return String(input)
    .replace(TASHKEEL, '')
    .replace(TATWEEL, '')
    .replace(LONE_HAMZA, '')
    .replace(ARABIC_INDIC_DIGITS, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(FOLDABLE_LETTERS, (ch) => LETTER_MAP[ch] || ch)
    .replace(/\s+/g, ' ')
    .trim()
}

// Read a (possibly dotted) key path off an object, coerce it to a string and
// normalize it. Used as Fuse's `getFn` so the index and the query are folded
// through exactly the same rules.
function getNormalized(obj, path) {
  const keys = Array.isArray(path) ? path : String(path).split('.')
  let value = obj
  for (const key of keys) {
    if (value == null) return ''
    value = value[key]
  }
  if (Array.isArray(value)) value = value.filter(Boolean).join(' ')
  return normalizeArabic(value == null ? '' : String(value))
}

// Shared Fuse options tuned for Arabic. Each choice, and why:
export const ARABIC_FUSE_OPTIONS = {
  // ignoreLocation: the meaningful part of an Arabic word is rarely at a fixed
  // offset - the definite article "al-" and clitic prefixes (و ف ب ك ل) shift
  // it around - so a match anywhere in the field must count fully.
  ignoreLocation: true,
  // ignoreFieldNorm: Arabic bodies are long and vary wildly in length next to
  // short titles; without this, longer fields are unfairly penalized.
  ignoreFieldNorm: true,
  // threshold 0.3: loose enough to absorb a one/two-character typo or a
  // leftover diacritic, tight enough that unrelated words which merely share
  // the very common letters (ا ل م ن و ي) do not flood the results.
  threshold: 0.3,
  // minMatchCharLength 2: Arabic meaning is carried by 2-3 letter roots; a
  // single character is almost always noise (a stray ا/و/ل connector).
  minMatchCharLength: 2,
  // getFn: fold Alef/Hamza/Ta-marbuta variants and strip tashkeel+tatweel on
  // every indexed value - the single most important setting for Arabic recall.
  getFn: getNormalized,
  includeScore: true,
  includeMatches: true,
}

const DEFAULT_KEYS = [
  { name: 'title', weight: 0.6 },
  { name: 'body', weight: 0.3 },
  { name: 'chapterTitle', weight: 0.1 },
]

// One Fuse instance per dataset (rebuilt only if the key/threshold config
// changes). WeakMap so a discarded dataset frees its index automatically.
const fuseCache = new WeakMap()

function fuseFor(dataset, options) {
  const keys = options.keys ?? DEFAULT_KEYS
  const config = { ...ARABIC_FUSE_OPTIONS, ...options, keys }
  const sig = JSON.stringify({
    keys,
    threshold: config.threshold,
    minMatchCharLength: config.minMatchCharLength,
  })
  const cached = fuseCache.get(dataset)
  if (cached && cached.sig === sig) return cached.fuse
  const fuse = new Fuse(dataset, config)
  fuseCache.set(dataset, { sig, fuse })
  return fuse
}

/**
 * Arabic-optimized fuzzy search.
 *
 * @param {string} query              raw user input (normalized internally)
 * @param {object[]} dataset          records to search
 * @param {object} [options]
 * @param {Array}  [options.keys]     Fuse key config (default: title/body/chapterTitle)
 * @param {number} [options.limit=20] max results
 * @param {number} [options.threshold] override the default 0.3
 * @returns {import('fuse.js').FuseResult<object>[]}
 */
export function performSearch(query, dataset, options = {}) {
  const q = normalizeArabic(query)
  const minLen = options.minMatchCharLength ?? ARABIC_FUSE_OPTIONS.minMatchCharLength
  if (q.length < minLen) return []
  if (!Array.isArray(dataset) || dataset.length === 0) return []
  return fuseFor(dataset, options).search(q, { limit: options.limit ?? 20 })
}

// ---------------------------------------------------------------------------
// App-facing index: one document per chapter + section, per language.
// ---------------------------------------------------------------------------
const datasetCache = new Map()

function datasetFor(lang) {
  if (datasetCache.has(lang)) return datasetCache.get(lang)
  const docs = []
  for (const chapter of chapters) {
    docs.push({
      chapterId: chapter.id,
      sectionId: '',
      chapterTitle: chapter.title[lang],
      title: chapter.title[lang],
      body: stripMarkdown(chapter.intro?.[lang]),
    })
    for (const section of chapter.sections) {
      docs.push({
        chapterId: chapter.id,
        sectionId: section.id,
        chapterTitle: chapter.title[lang],
        title: section.title[lang],
        // Callout text is part of the section for search purposes: the
        // course-only guidance in "note" callouts lives nowhere else.
        body: [stripMarkdown(section.body[lang]), stripMarkdown(section.callout?.[lang] ?? '')]
          .filter(Boolean)
          .join(' '),
      })
    }
  }
  datasetCache.set(lang, docs)
  return docs
}

// Kept API: components call getSearchIndex(lang).search(query, { limit }).
export function getSearchIndex(lang) {
  const dataset = datasetFor(lang)
  return {
    dataset,
    search: (query, opts = {}) => performSearch(query, dataset, opts),
  }
}

// Returns a short excerpt around the first body match, or the body start.
export function excerpt(result, radius = 60) {
  const body = result.item.body || ''
  const match = result.matches?.find((m) => m.key === 'body')
  if (!match || !match.indices.length) return body.slice(0, radius * 2)
  const [start, end] = match.indices[0]
  const from = Math.max(0, start - radius)
  const to = Math.min(body.length, end + radius)
  return (from > 0 ? '…' : '') + body.slice(from, to) + (to < body.length ? '…' : '')
}
