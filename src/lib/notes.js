// Tiny persistence layer for reader notes. Deliberately minimal — notes are a
// flat, append-only list in localStorage. A richer "my notes" panel can read
// this later; for now it just needs to survive a refresh.

import { STORAGE_KEYS } from '../config.js'

const KEY = STORAGE_KEYS.notes

/** @returns {Array<{id:string,text:string,note:string,chapterId:string,href:string,createdAt:string}>} */
export function getNotes() {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/**
 * Append a note against a quoted snippet of page text.
 * @returns the stored entry (also broadcast as a `uiref:notes` CustomEvent).
 */
export function saveNote({ text, note, chapterId = '' }) {
  const entry = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    text: String(text || '').slice(0, 2000),
    note: String(note || '').trim(),
    chapterId,
    href: window.location.hash || '#/',
    createdAt: new Date().toISOString(),
  }

  try {
    const all = getNotes()
    all.push(entry)
    localStorage.setItem(KEY, JSON.stringify(all))
  } catch {
    /* private mode / quota: the note simply isn't persisted this session */
  }

  // Let any listener (e.g. a future notes panel) react without a shared store.
  window.dispatchEvent(new CustomEvent('uiref:notes', { detail: entry }))
  return entry
}

export default { getNotes, saveNote }
