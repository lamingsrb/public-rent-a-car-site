// ====================================
// contact.js — SOURCE OF TRUTH for every phone / e-mail / messenger URL on the site (brief §5.0.5)
// ====================================
// Exports: CONTACT, buildMessage(ctxKey, vars), contactLinks(ctxKey, vars), openChannel(channel, ctxKey, vars),
//          fillContactLinks(root = document)   (fills href of every [data-contact] element; also wires viber/telegram clicks)
//          fillContactTexts(root = document)   (prints CONTACT values into [data-contact-text="tel|wa|viber|telegram|mail|instagram"] spans)
// Markup never contains a phone number or messenger URL: it carries data-contact="tel|wa|viber|telegram|mail|instagram"
// (+ optional data-contact-ctx="general|car|airport|location|terms", default "general") and main.js calls fillContactLinks().
// Values mirror data/business.json (contacts_and_socials); scripts/check-contact.mjs (QA slot) compares them.
// Capability: wa and mail accept a prefilled message; tel none; viber/telegram have NO prefill -> copy-message fallback.
// Facebook is deliberately absent (two different URLs exist and neither is confirmed, brief §11.2).
// Message templates: common.msg.general|car|airport|location|terms (EN in common-en.js, SR in i18n/sr/common.json).
// Placeholders {car} {pickup} {from} {to}: blank values render as "…" (common.msg.blank); dates go through
// Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short' }) and accept Date | 'YYYY-MM-DD' | free text.
import { tr, fmt } from './tr.js'
import { currentLang } from '../i18n.js'
import { toast, showCopyDialog } from './toast.js'

export const CONTACT = {
  tel: '+38169693051',
  telDisplay: '+381 69 693051',
  telHref: 'tel:+38169693051',
  wa: 'https://wa.me/38169693051', // DIGITS ONLY: wa.me rejects the plus sign (business.json lists it with a plus)
  viber: 'viber://chat?number=%2B38169693051',
  telegram: 'https://t.me/+38169693051', // verbatim from the client's site; no prefill, opens a chat only if the number is on Telegram
  email: 'booking@publicrentacar.rs',
  instagram: 'https://www.instagram.com/publicrentacar/',
}

const APP_FALLBACK_MS = 1600
const CTX_KEYS = ['general', 'car', 'airport', 'location', 'terms']

function intlLang() {
  return currentLang() === 'sr' ? 'sr-Latn' : 'en'
}

function formatDate(v) {
  if (v == null || v === '') return ''
  let d = null
  if (v instanceof Date) d = v
  else if (/^\d{4}-\d{2}-\d{2}$/.test(String(v))) {
    const [y, m, day] = String(v).split('-').map(Number)
    d = new Date(y, m - 1, day)
  }
  if (!d || Number.isNaN(d.getTime())) return String(v)
  return new Intl.DateTimeFormat(intlLang(), { day: 'numeric', month: 'short' }).format(d)
}

export function buildMessage(ctxKey = 'general', vars = {}) {
  const key = CTX_KEYS.includes(ctxKey) ? ctxKey : 'general'
  const blank = tr('common.msg.blank')
  const v = {
    car: vars.car || blank,
    pickup: vars.pickup || blank,
    from: formatDate(vars.from) || blank,
    to: formatDate(vars.to) || blank,
  }
  return fmt(tr('common.msg.' + key), v)
}

export function contactLinks(ctxKey = 'general', vars = {}) {
  const text = buildMessage(ctxKey, vars)
  return {
    tel: CONTACT.telHref,
    wa: `${CONTACT.wa}?text=${encodeURIComponent(text)}`,
    mail: `mailto:${CONTACT.email}?subject=${encodeURIComponent(tr('common.msg.subject'))}&body=${encodeURIComponent(text)}`,
    viber: CONTACT.viber,
    telegram: CONTACT.telegram,
    instagram: CONTACT.instagram,
    text,
  }
}

export async function openChannel(channel, ctxKey = 'general', vars = {}) {
  const text = buildMessage(ctxKey, vars)
  if (channel === 'wa') return window.open(`${CONTACT.wa}?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
  if (channel === 'mail') {
    location.href = `mailto:${CONTACT.email}?subject=${encodeURIComponent(tr('common.msg.subject'))}&body=${encodeURIComponent(text)}`
    return
  }
  if (channel === 'tel') {
    location.href = CONTACT.telHref
    return
  }
  // viber / telegram: copy first, then hand over to the app
  let copied = false
  try {
    await navigator.clipboard.writeText(text)
    copied = true
    toast(tr('common.msg.copied'))
  } catch {
    showCopyDialog(text, { channel }) // clipboard denied: show the text with a Copy button now
  }
  location.href = channel === 'viber' ? CONTACT.viber : CONTACT.telegram
  // If the page is still visible after the hand-over, the app did not open (desktop without the app, number not on Telegram):
  // say so and show the number so the person can continue by hand. Text is already on the clipboard when copied === true.
  if (copied) {
    setTimeout(() => {
      if (document.visibilityState === 'visible') showCopyDialog(text, { channel, number: CONTACT.telDisplay })
    }, APP_FALLBACK_MS)
  }
}

let clicksWired = false

/** Fill href (and target/rel) of every [data-contact] element under root. Safe to call repeatedly (e.g. after a language swap). */
export function fillContactLinks(root = document) {
  const cache = {}
  root.querySelectorAll('[data-contact]').forEach((el) => {
    const kind = el.dataset.contact
    const ctx = el.dataset.contactCtx || 'general'
    const links = cache[ctx] || (cache[ctx] = contactLinks(ctx, {}))
    const href = links[kind]
    if (!href) return
    el.setAttribute('href', href)
    if (kind === 'wa' || kind === 'instagram') {
      el.setAttribute('target', '_blank')
      el.setAttribute('rel', 'noopener')
    }
  })
  if (!clicksWired) {
    clicksWired = true
    document.addEventListener('click', (e) => {
      const a = e.target.closest && e.target.closest('[data-contact="viber"],[data-contact="telegram"]')
      if (!a || e.defaultPrevented) return
      e.preventDefault()
      openChannel(a.dataset.contact, a.dataset.contactCtx || 'general', {})
    })
  }
}

const TEXT_OF = {
  tel: () => CONTACT.telDisplay,
  wa: () => CONTACT.telDisplay,
  viber: () => CONTACT.telDisplay,
  telegram: () => CONTACT.telDisplay,
  mail: () => CONTACT.email,
  instagram: () => '@' + new URL(CONTACT.instagram).pathname.split('/').filter(Boolean)[0],
}

/** Print the contact values into [data-contact-text] spans (markup never carries the number itself, gate R12). */
export function fillContactTexts(root = document) {
  root.querySelectorAll('[data-contact-text]').forEach((el) => {
    const fn = TEXT_OF[el.dataset.contactText]
    if (fn) el.textContent = fn()
  })
}
