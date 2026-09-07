// Global configuration for the platform (site chrome + SEO defaults).
// Course content itself never lives here — it lives in /content/*.json.

// Production origin. Used to build absolute canonical / Open Graph URLs.
// TODO: point this at the real domain before launch.
const SITE_URL = 'https://ui-design-reference.vercel.app'

export const siteConfig = {
  // ---- Identity ----
  name: 'مرجع تصميم الواجهات', // brand name, used for og:site_name
  lang: 'ar',
  dir: 'rtl',
  locale: 'ar_AR', // BCP-47-ish locale for og:locale

  // ---- Default SEO metadata (fallbacks for useSEO) ----
  // The document <title> when no page/chapter title is supplied.
  title: 'مرجع تصميم واجهات المستخدم (UI)',
  // Per-page titles are formatted through this template. %s = page title.
  titleTemplate: '%s · مرجع تصميم الواجهات',
  description:
    'مرجع عربي تفاعلي لمبادئ تصميم واجهات المستخدم: الأساسيات، الجريد والتخطيط، ' +
    'التايبوجرافي، والإدراك البصري — مبني كمرجع دائم لطلاب دورة تصميم الـ UI.',
  keywords: ['تصميم واجهات المستخدم', 'UI Design', 'تجربة المستخدم', 'تايبوجرافي', 'جريد', 'محتوى عربي'],
  author: 'فريق المرجع',

  // ---- URLs & assets ----
  url: SITE_URL,
  ogImage: `${SITE_URL}/og/default.png`, // 1200×630 — add at public/og/default.png
  ogType: 'website',
  themeColor: '#faf9f7', // matches --c-bg (light) in src/index.css

  // ---- Twitter / X card ----
  twitter: {
    card: 'summary_large_image',
    site: '', // e.g. '@handle' — leave empty to omit the tag
    creator: '',
  },
}

// --- Existing site chrome (kept for TopBar / Sidebar / PrintView) ---
export const site = {
  title: { en: 'UI Design Reference', ar: siteConfig.name },
  subtitle: { en: 'Course companion', ar: 'مرجع الدورة' },
}

export const STORAGE_KEYS = {
  lang: 'uiref:lang',
  theme: 'uiref:theme',
}
