// ====================================
// terms.js — section 08 "Terms by numbers" (slot E, brief 5.8)
// ====================================
// CSS-only: grid, native <details name="terms"> accordion (grid-template-rows 0fr -> 1fr via ::details-content).
// JS: optional "Read the full conditions" button (only when a PDF URL is set), counters, RSD letters, card fade-ups (reveal.js).
//   PDF URL: build-time `__TERMS_PDF_URL__` (define from env TERMS_PDF_URL, see notes) or VITE_TERMS_PDF_URL; empty -> button omitted.
// Motion (full mode only, inside mm.add; static/lite/reduced keep the final numbers from the markup):
//   Facts stay fixed. Only the RSD lettering and card surfaces animate.
import '../css/terms.css'
import { mm, gsap, ScrollTrigger, SplitText, REDUCED, MODE } from './motion.js'
import { initReveals } from './lib/reveal.js'
import { tr } from './lib/tr.js'

/* global __TERMS_PDF_URL__ */
const TERMS_PDF_URL =
  (typeof __TERMS_PDF_URL__ !== 'undefined' ? __TERMS_PDF_URL__ : '') || import.meta.env.VITE_TERMS_PDF_URL || ''

function addOutlineButton(root) {
  const url = String(TERMS_PDF_URL || '').trim()
  const row = root.querySelector('.terms__cta')
  if (!url || !row) return
  const a = document.createElement('a')
  a.className = 'btn btn--outline'
  a.href = url
  a.target = '_blank'
  a.rel = 'noopener'
  a.textContent = tr('terms.ctaOutline', 'Read the full conditions')
  row.append(a)
  // not data-i18n on purpose: it is created after the EN snapshot, so the label is refreshed by hand
  document.addEventListener('prc:langchange', () => {
    a.textContent = tr('terms.ctaOutline', 'Read the full conditions')
  })
}

function buildMotion(root) {
  const grid = root.querySelector('.terms__grid')
  if (!grid) return
  const cards = [...grid.querySelectorAll('.terms__card')]
  let split = null

  // RSD letters: hidden at start, revealed with the card
  const rsd = grid.querySelector('.terms__rsd')
  if (rsd) {
    split = SplitText.create(rsd, { type: 'chars', aria: 'auto' })
    gsap.set(split.chars, { opacity: 0, yPercent: 40 })
  }

  ScrollTrigger.create({
    id: 'terms-count',
    trigger: grid,
    start: 'top 82%',
    once: true,
    onEnter: () => {
      // Rental conditions are facts: keep the final values readable throughout motion.
      cards.forEach(card => card.querySelectorAll('.terms__count').forEach(el => {
        if (el.dataset.count) el.textContent = el.dataset.count
      }))
      if (split) {
        gsap.to(split.chars, {
          opacity: 1,
          yPercent: 0,
          duration: 0.4,
          ease: 'power2.out',
          stagger: 0.05,
          delay: 5 * 0.1,
          clearProps: 'opacity,transform,willChange',
        })
      }
    },
  })
}

export function init() {
  const root = document.getElementById('terms')
  if (!root) return
  try {
    addOutlineButton(root)
    initReveals(root)
    mm.add(
      { desktop: '(min-width: 1024px)', mobile: '(max-width: 1023.98px)', reduce: '(prefers-reduced-motion: reduce)' },
      (ctx) => {
        if (REDUCED || ctx.conditions.reduce || MODE === 'static') return // final numbers already in the markup
        buildMotion(root)
      },
    )
  } catch (e) {
    console.error('[terms]', e)
  }
}
