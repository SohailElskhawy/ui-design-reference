import { useCallback, useEffect, useState } from 'react'
import { chapters, chapterById } from './lib/content.js'
import { useHashRoute, useLocalStorage } from './lib/hooks.js'
import { STORAGE_KEYS } from './config.js'
import { useSEO } from './hooks/useSEO.js'
import { stripMarkdown } from './lib/search.js'
import { t } from './lib/ui.js'
import { sectionDomId } from './components/Section.jsx'
import TopBar from './components/TopBar.jsx'
import Sidebar from './components/Sidebar.jsx'
import Chapter from './components/Chapter.jsx'
import Search from './components/Search.jsx'
import SelectionTooltip from './components/SelectionTooltip.jsx'
import PrintView from './components/PrintView.jsx'

// Arabic-first content platform. `lang` is kept as state so a language
// switch can be re-introduced later; the default and the <html> attributes
// below make Arabic the ground truth.
const DEFAULT_LANG = 'ar'

function prefersDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export default function App() {
  const [lang, setLang] = useLocalStorage(STORAGE_KEYS.lang, DEFAULT_LANG)
  const [theme, setTheme] = useLocalStorage(STORAGE_KEYS.theme, prefersDark)
  const route = useHashRoute()
  const [activeSection, setActiveSection] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  const isPrint = route.chapter === 'print'
  const chapter = chapterById.get(route.chapter) ?? chapters[0]

  // 1) RTL + Arabic on <html>. Runs on mount (lang is 'ar' by default) and
  //    stays in sync if a language toggle is ever added.
  useEffect(() => {
    const el = document.documentElement
    el.lang = lang
    el.dir = lang === 'ar' ? 'rtl' : 'ltr'
  }, [lang])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  // 2) Dynamic SEO for the current chapter, with siteConfig fallbacks.
  useSEO(
    isPrint
      ? { title: t(lang, 'printView'), path: '/print', noindex: true }
      : {
          title: chapter?.title[lang],
          description: stripMarkdown(chapter?.intro?.[lang]).slice(0, 160) || undefined,
          path: chapter ? `/${chapter.id}` : '/',
          type: 'article',
        },
  )

  // Scroll on navigation (chapter or section). route.n changes on every
  // navigation, including repeats of the same hash.
  useEffect(() => {
    setMenuOpen(false)
    if (isPrint || !chapter) return
    if (route.section) {
      const el = document.getElementById(sectionDomId(chapter.id, route.section))
      if (el) {
        el.scrollIntoView({ block: 'start' })
        setActiveSection(route.section)
        return
      }
    }
    window.scrollTo({ top: 0 })
  }, [route.chapter, route.section, route.n, isPrint, chapter])

  // Cmd/Ctrl+K opens search
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Lock body scroll while a layer is open on top of the page.
  useEffect(() => {
    document.body.style.overflow = menuOpen || searchOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [menuOpen, searchOpen])

  const onActiveSection = useCallback((id) => setActiveSection(id), [])
  const toggleLang = () => setLang((l) => (l === 'en' ? 'ar' : 'en'))
  const toggleTheme = () => setTheme((th) => (th === 'dark' ? 'light' : 'dark'))

  if (chapters.length === 0) {
    return (
      <main className="mx-auto max-w-prose p-4 text-ink">
        <p>No chapters found. Add a JSON file to <code>/content</code>.</p>
      </main>
    )
  }

  return (
    <div className="min-h-screen">
      <TopBar
        lang={lang}
        theme={theme}
        onToggleLang={toggleLang}
        onToggleTheme={toggleTheme}
        onOpenSearch={() => setSearchOpen(true)}
        onOpenMenu={() => setMenuOpen(true)}
      />

      {isPrint ? (
        <main>
          <PrintView lang={lang} />
        </main>
      ) : (
        <>
          <Sidebar
            lang={lang}
            activeChapterId={chapter.id}
            activeSectionId={activeSection}
            open={menuOpen}
            onClose={() => setMenuOpen(false)}
          />
          <main className="md:ms-[280px]">
            <div className="px-2 pb-12 pt-4 sm:px-3 sm:pt-6 md:px-6 md:pt-8">
              <Chapter key={chapter.id} chapter={chapter} lang={lang} onActiveSection={onActiveSection} />
            </div>
          </main>
          {/* Medium-style highlight → note tooltip, scoped to <main>. */}
          <SelectionTooltip lang={lang} chapterId={chapter.id} />
        </>
      )}

      <Search lang={lang} open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  )
}
