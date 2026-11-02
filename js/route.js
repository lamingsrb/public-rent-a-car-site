// ====================================
// route.js — "How it works" (brief 5.5, slot D)
// ====================================
// CSS sticky does the layout (no JS pin, so the section adds no pin distance). JS only:
//   - one ScrollTrigger per step (start 'top 55%', end 'bottom 55%') that marks the active step,
//   - a clip-path wipe (+ 6% scale settle) on the sticky window image, previous image stays underneath,
//   - a 2px progress line that fills with the section scroll.
// Desktop >= 1024 and html.mode-full / mode-lite only; everything else is the CSS mobile arrangement (all four images inline).
import '../css/route.css'
import { gsap, ScrollTrigger, REDUCED, MODE, mm } from './motion.js'
import { initReveals } from './lib/reveal.js'
import { EASE } from './lib/motion-tokens.js'

function showStaticState(root) {
  const fill = root.querySelector('.route__line-fill')
  if (fill) gsap.set(fill, { clearProps: 'transform' })
  root.querySelectorAll('.route__wimg').forEach((im, i) => {
    gsap.set(im, { clearProps: 'clipPath,transform,zIndex' })
    im.classList.remove('is-prev')
    im.classList.toggle('is-active', i === 0)
  })
  root.querySelectorAll('.route__step').forEach((s, i) => s.classList.toggle('is-active', i === 0))
}

export function init() {
  const root = document.getElementById('route')
  if (!root) return
  try {
    initReveals(root)
  } catch (e) {
    console.error('[route] reveals', e)
  }

  const steps = [...root.querySelectorAll('.route__step')]
  const wimgs = [...root.querySelectorAll('.route__wimg')]
  const fill = root.querySelector('.route__line-fill')
  const list = root.querySelector('.route__steps')
  if (!steps.length || wimgs.length !== steps.length) return

  mm.add(
    { desktop: '(min-width: 1024px)', mobile: '(max-width: 1023.98px)', reduce: '(prefers-reduced-motion: reduce)' },
    (ctx) => {
      const { desktop, reduce } = ctx.conditions
      if (REDUCED || reduce || MODE === 'static') {
        showStaticState(root)
        return
      }
      if (!desktop) return

      let cur = 0
      let z = 1
      const setActive = (i) => {
        if (i === cur) return
        const prev = wimgs[cur]
        const next = wimgs[i]
        steps.forEach((s, k) => s.classList.toggle('is-active', k === i))
        gsap.killTweensOf(wimgs)
        wimgs.forEach((im) => {
          gsap.set(im, { clearProps: 'clipPath,transform' })
          im.classList.remove('is-prev')
        })
        prev.classList.remove('is-active')
        next.classList.add('is-active')
        next.style.zIndex = String(++z)
        cur = i
        if (MODE !== 'full') return // lite: instant swap
        prev.classList.add('is-prev')
        gsap.fromTo(
          next,
          { clipPath: 'inset(100% 0% 0% 0%)', scale: 1.06 },
          {
            clipPath: 'inset(0% 0% 0% 0%)',
            scale: 1,
            duration: 0.7,
            ease: EASE.inOut,
            overwrite: 'auto',
            onComplete: () => {
              prev.classList.remove('is-prev')
              gsap.set(next, { clearProps: 'clipPath' })
            },
          },
        )
      }

      // initial state: step 1 active
      steps.forEach((s, k) => s.classList.toggle('is-active', k === 0))
      wimgs.forEach((im, k) => im.classList.toggle('is-active', k === 0))

      steps.forEach((li, i) => {
        ScrollTrigger.create({
          id: 'route-step' + (i + 1),
          trigger: li,
          start: 'top 55%',
          end: 'bottom 55%',
          onToggle: (self) => {
            if (self.isActive) setActive(i)
          },
        })
      })

      if (fill && MODE === 'full' && list) {
        gsap.fromTo(
          fill,
          { scaleY: 0 },
          {
            scaleY: 1,
            ease: 'none',
            scrollTrigger: { id: 'route-line', trigger: list, start: 'top 55%', end: 'bottom 55%', scrub: true, invalidateOnRefresh: true },
          },
        )
      }

      return () => showStaticState(root)
    },
  )
}
