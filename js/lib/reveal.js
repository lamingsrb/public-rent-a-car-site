// ====================================
// reveal.js — the declarative reveal vocabulary (brief §7.3)
// ====================================
// Exports: initReveals(root = document)  -> call once per section after its markup is final; returns nothing.
//          showAll(root = document)      -> clears every hidden start state (static mode, tests)
// Attributes (all `once: true`, start 'top 88%'):
//   data-reveal                  opacity 0 -> 1, y 24 -> 0
//   data-reveal="stagger"        parent: children [data-reveal-item] (max 12) staggered 0.06 s
//   data-reveal="lines"          SplitText lines in a mask, yPercent 110 -> 0, stagger 0.08; re-split on prc:langchange
//   data-reveal="clip"           clip-path wipe, only for .arch plates and images
// Rules: never put these inside a pinned scene (the scene's own timeline owns it: add data-reveal-skip on the scene root);
//        never on the <h1>, the price note or status text. In static mode everything is shown immediately.
//        Fail-visible: CSS shows [data-reveal] unless html has a mode-* class (base.css).
import { gsap, ScrollTrigger, SplitText, mm, registerLangRebuild } from '../motion.js'
import { MODE } from './motion-mode.js'
import { DUR, EASE, DIST } from './motion-tokens.js'

const lineRecords = [] // { el, split, revealed }
let langHooked = false

export function showAll(root = document) {
  root.querySelectorAll('[data-reveal], [data-reveal-item]').forEach((el) => {
    gsap.set(el, { clearProps: 'opacity,transform,clipPath,visibility,willChange' })
  })
}

function skip(el) {
  return el.tagName === 'H1' || el.closest('[data-reveal-skip]')
}

function splitLines(el) {
  return SplitText.create(el, { type: 'lines', mask: 'lines', aria: 'auto', linesClass: 'reveal-line' })
}

function hookLang() {
  if (langHooked) return
  langHooked = true
  registerLangRebuild(() => {
    lineRecords.forEach((rec) => {
      if (!rec.el.isConnected) return
      // i18n has already swapped the heading text; SplitText.revert() would put the OLD-language markup back,
      // so keep the freshly translated markup and restore it after the revert.
      const fresh = rec.el.innerHTML
      try {
        if (rec.split) {
          rec.split.revert()
          rec.el.innerHTML = fresh
        }
      } catch {}
      rec.split = null
      if (!rec.revealed) {
        rec.split = splitLines(rec.el)
        gsap.set(rec.split.lines, { yPercent: 110 })
      }
    })
  })
}

export function initReveals(root = document) {
  if (MODE === 'static') {
    showAll(root)
    return
  }
  mm.add({ ok: '(min-width: 0px)', reduce: '(prefers-reduced-motion: reduce)' }, (ctx) => {
    if (ctx.conditions.reduce) {
      showAll(root)
      return
    }
    root.querySelectorAll('[data-reveal]').forEach((el) => {
      if (skip(el)) return
      const kind = el.getAttribute('data-reveal')
      const common = { trigger: el, start: 'top 88%', once: true }

      if (kind === 'stagger') {
        const items = [...el.querySelectorAll('[data-reveal-item]')].slice(0, 12)
        if (!items.length) return
        gsap.set(items, { opacity: 0, y: DIST.y })
        ScrollTrigger.create({
          ...common,
          onEnter: () =>
            gsap.to(items, { opacity: 1, y: 0, duration: DUR.reveal, ease: EASE.out, stagger: DIST.stagger, clearProps: 'transform,willChange' }),
        })
      } else if (kind === 'lines') {
        const rec = { el, split: null, revealed: false }
        lineRecords.push(rec)
        hookLang()
        gsap.set(el, { opacity: 0 })
        const start = () => {
          if (!el.isConnected || rec.revealed) return
          rec.split = splitLines(el)
          gsap.set(rec.split.lines, { yPercent: 110 })
          gsap.set(el, { opacity: 1 })
        }
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(start)
        else start()
        ScrollTrigger.create({
          ...common,
          onEnter: () => {
            rec.revealed = true
            gsap.set(el, { opacity: 1 })
            if (rec.split) {
              gsap.to(rec.split.lines, {
                yPercent: 0,
                duration: 0.9,
                ease: EASE.out,
                stagger: DIST.staggerLines,
                onComplete: () => {
                  try {
                    rec.split && rec.split.revert()
                  } catch {}
                  rec.split = null
                },
              })
            }
          },
        })
      } else if (kind === 'clip') {
        gsap.set(el, { clipPath: 'inset(100% 0% 0% 0%)' })
        ScrollTrigger.create({
          ...common,
          onEnter: () => gsap.to(el, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.9, ease: EASE.inOut, clearProps: 'clipPath,willChange' }),
        })
      } else {
        gsap.set(el, { opacity: 0, y: DIST.y })
        ScrollTrigger.create({
          ...common,
          onEnter: () => gsap.to(el, { opacity: 1, y: 0, duration: DUR.reveal, ease: EASE.out, clearProps: 'transform,willChange' }),
        })
      }
    })
    return () => showAll(root)
  })
}
