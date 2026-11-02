// ====================================
// stickybar.js — phone contact bar visibility (brief 5.0.9)
// ====================================
// Visible only < 1024 and only when ALL of: the cover has been scrolled past, #contact / #footer are not in the top 70% of the viewport
// (i.e. > 30% of the screen), the mobile menu is closed, the soft keyboard is closed. Toggles .is-on on the bar and html.has-bar
// (CSS demotes every other orange button to ink while the bar shows). IntersectionObserver instead of scroll listeners, so
// pin spacers and Lenis do not matter. The slide is a CSS transition (instant in static mode via html.is-static).
import '../css/stickybar.css'
import { mm } from './motion.js'

const root = document.documentElement

export function init() {
  const bar = document.getElementById('stickybar')
  const cover = document.getElementById('cover')
  const contact = document.getElementById('contact')
  if (!bar) return

  mm.add({ phone: '(max-width: 1023px)' }, (ctx) => {
    if (!ctx.conditions.phone) {
      bar.classList.remove('is-on')
      root.classList.remove('has-bar')
      return
    }
    const s = { pastCover: false, atContact: false, menu: root.classList.contains('is-menu-open'), keyboard: false }
    const vv = window.visualViewport
    const apply = () => {
      const on = s.pastCover && !s.atContact && !s.menu && !s.keyboard
      bar.classList.toggle('is-on', on)
      root.classList.toggle('has-bar', on)
    }

    const observers = []
    if ('IntersectionObserver' in window) {
      if (cover) {
        const io = new IntersectionObserver((entries) => {
          const e = entries[entries.length - 1]
          s.pastCover = !e.isIntersecting && e.boundingClientRect.bottom <= 0
          apply()
        })
        io.observe(cover)
        observers.push(io)
      } else {
        s.pastCover = true
      }
      // The back cover is #contact + #footer (one dusk gradient): either one in the top 70% of the screen hides the bar.
      const back = [contact, document.getElementById('footer')].filter(Boolean)
      const hit = new Set()
      if (back.length) {
        const io = new IntersectionObserver(
          (entries) => {
            entries.forEach((e) => (e.isIntersecting ? hit.add(e.target) : hit.delete(e.target)))
            s.atContact = hit.size > 0
            apply()
          },
          { rootMargin: '0px 0px -30% 0px', threshold: 0 }
        )
        back.forEach((el) => io.observe(el))
        observers.push(io)
      }
    }

    const onMenu = (e) => {
      s.menu = !!e.detail.open
      apply()
    }
    const onViewport = () => {
      s.keyboard = !!vv && vv.height < window.innerHeight * 0.75
      apply()
    }
    document.addEventListener('prc:menutoggle', onMenu)
    if (vv) vv.addEventListener('resize', onViewport)
    apply()

    return () => {
      observers.forEach((o) => o.disconnect())
      document.removeEventListener('prc:menutoggle', onMenu)
      if (vv) vv.removeEventListener('resize', onViewport)
      bar.classList.remove('is-on')
      root.classList.remove('has-bar')
    }
  })
}
