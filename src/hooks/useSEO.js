import { useEffect } from 'react'
import { siteConfig } from '../config.js'

// --- <head> helpers -------------------------------------------------------
// Every tag this hook creates is stamped with [data-seo] so it owns exactly
// its own nodes and never fights with tags authored in index.html.

function upsert(selector, create) {
  let el = document.head.querySelector(selector)
  if (!el) {
    el = create()
    el.setAttribute('data-seo', '')
    document.head.appendChild(el)
  }
  return el
}

// attr is "name" for standard/Twitter meta, "property" for Open Graph.
function setMeta(attr, key, content) {
  if (content == null || content === '') return
  const el = upsert(`meta[${attr}="${key}"]`, () => {
    const m = document.createElement('meta')
    m.setAttribute(attr, key)
    return m
  })
  el.setAttribute('content', String(content))
}

function setLink(rel, href) {
  if (!href) return
  const el = upsert(`link[rel="${rel}"]`, () => {
    const l = document.createElement('link')
    l.setAttribute('rel', rel)
    return l
  })
  el.setAttribute('href', href)
}

// Resolve a path or partial URL against the configured site origin.
function absoluteUrl(pathOrUrl) {
  if (!pathOrUrl) return siteConfig.url
  try {
    return new URL(pathOrUrl, siteConfig.url).toString()
  } catch {
    return pathOrUrl
  }
}

/**
 * Create/update the SEO, Open Graph and Twitter meta tags for the current
 * page or chapter. Any field left out falls back to siteConfig.
 *
 * Tags are updated in place (not removed on unmount) so there is never a
 * frame where the document has no title/description between route changes.
 *
 * @param {object}  seo
 * @param {string} [seo.title]        page/chapter title (run through titleTemplate)
 * @param {string} [seo.description]  meta description / og:description
 * @param {string} [seo.image]        og:image / twitter:image (path or absolute URL)
 * @param {string} [seo.path]         route path, e.g. "/typography" — canonical + og:url
 * @param {string} [seo.type]         og:type (default "website", use "article" for chapters)
 * @param {boolean}[seo.noindex]      emit robots "noindex, nofollow"
 */
export function useSEO({ title, description, image, path, type, noindex = false } = {}) {
  const fullTitle = title ? siteConfig.titleTemplate.replace('%s', title) : siteConfig.title
  const desc = description || siteConfig.description
  const url = absoluteUrl(path)
  const img = absoluteUrl(image || siteConfig.ogImage)
  const ogType = type || siteConfig.ogType
  const { twitter } = siteConfig

  useEffect(() => {
    document.title = fullTitle

    // --- Standard SEO ---
    setMeta('name', 'description', desc)
    setMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow')
    setLink('canonical', url)

    // --- Open Graph ---
    setMeta('property', 'og:title', fullTitle)
    setMeta('property', 'og:description', desc)
    setMeta('property', 'og:type', ogType)
    setMeta('property', 'og:url', url)
    setMeta('property', 'og:image', img)
    setMeta('property', 'og:site_name', siteConfig.name)
    setMeta('property', 'og:locale', siteConfig.locale)

    // --- Twitter ---
    setMeta('name', 'twitter:card', twitter.card)
    setMeta('name', 'twitter:title', fullTitle)
    setMeta('name', 'twitter:description', desc)
    setMeta('name', 'twitter:image', img)
    setMeta('name', 'twitter:site', twitter.site)
    setMeta('name', 'twitter:creator', twitter.creator)
  }, [fullTitle, desc, url, img, ogType, noindex, twitter.card, twitter.site, twitter.creator])
}

export default useSEO
