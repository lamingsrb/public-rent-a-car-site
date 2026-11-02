// ====================================
// media.js — responsive <img>/<picture> markup from the generated media index (js/lib/media-index.js)
// ====================================
// Usage (string templates — sections render HTML strings, then insert once):
//   import { img, srcset, mediaInfo } from '../lib/media.js'
//   img('/assets/img/fleet/skoda-karoq/01', { alt: v.photos[0].alt.en, sizes: '(min-width:1024px) 40vw, 92vw', cls: 'fleet-photo' })
//   img(v.card.base, { alt: v.card.alt.en, sizes: '320px', cls: 'card-render', eager: true })
// Every <img> gets width/height (no layout shift), decoding="async", loading="lazy" (unless eager),
// and a solid average-colour background while it loads (index.c). Unknown base → console.warn + plain <img>.
import INDEX from './media-index.js'

export function mediaInfo(base) {
  return INDEX[base] || null
}

export function src(base, width) {
  const m = INDEX[base]
  if (!m) return `${base}.webp`
  const w = m.w.includes(width) ? width : m.w[m.w.length - 1]
  return `${base}-${w}.${m.f || 'webp'}`
}

export function srcset(base) {
  const m = INDEX[base]
  if (!m) return ''
  return m.w.map((w) => `${base}-${w}.${m.f || 'webp'} ${w}w`).join(', ')
}

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

/**
 * @param {string} base  public URL base, e.g. '/assets/img/fleet/skoda-karoq/01'
 * @param {object} o     { alt, sizes, cls, eager, fetchpriority, i18nAttr, width, decorative, style, attrs }
 *   - sizes: CSS sizes attribute (default '100vw'); width: intrinsic width to declare (default largest variant)
 *   - eager: loading="eager" (hero/LCP only — pair with fetchpriority:'high')
 *   - i18nAttr: i18n key for alt → adds data-i18n-attr="alt:<key>"
 *   - decorative: alt="" and aria-hidden
 */
export function img(base, o = {}) {
  const m = INDEX[base]
  if (!m) console.warn('[media] unknown base', base)
  const widths = m ? m.w : [1080]
  const w = o.width || widths[widths.length - 1]
  const h = Math.round(w / (m ? m.r : 1.5))
  const alt = o.decorative ? '' : esc(String(o.alt || '').replace(/\u2014/g, '·'))
  const attrs = [
    `src="${src(base, w)}"`,
    m ? `srcset="${srcset(base)}"` : '',
    `sizes="${esc(o.sizes || '100vw')}"`,
    `width="${w}"`,
    `height="${h}"`,
    `alt="${alt}"`,
    o.decorative ? 'aria-hidden="true"' : '',
    o.eager ? 'loading="eager"' : 'loading="lazy"',
    'decoding="async"',
    o.fetchpriority ? `fetchpriority="${o.fetchpriority}"` : '',
    o.cls ? `class="${esc(o.cls)}"` : '',
    o.i18nAttr && !o.decorative ? `data-i18n-attr="alt:${esc(o.i18nAttr)}"` : '',
    m && !m.a ? `style="background-color:${m.c}${o.style ? ';' + esc(o.style) : ''}"` : o.style ? `style="${esc(o.style)}"` : '',
    o.attrs || '',
  ].filter(Boolean)
  return `<img ${attrs.join(' ')}>`
}

/** Aspect-ratio box (CSS `aspect-ratio`) wrapping an img — avoids layout shift for lazy images. */
export function figure(base, o = {}) {
  const m = INDEX[base]
  const ratio = o.ratio || (m ? m.r : 1.5)
  return `<div class="media ${o.wrapCls || ''}" style="aspect-ratio:${ratio};${m && !m.a ? `background:${m.c};` : ''}">${img(base, o)}</div>`
}

/** Preload hint for the LCP image (call once, in <head> via JS or inline in index.html). */
export function preloadLink(base, sizes = '100vw') {
  const m = INDEX[base]
  if (!m) return ''
  return `<link rel="preload" as="image" imagesrcset="${srcset(base)}" imagesizes="${sizes}">`
}
