import { refresh, scrollTo } from './motion.js'

// Former chapter links reveal the relevant disclosure before measuring its target.
export function init() {
  const root = document.getElementById('rental-info')
  if (!root) return
  const targetFor = (hash) => {
    if (!['#route', '#price', '#atlas', '#terms'].includes(hash)) return null
    const detail = document.getElementById(hash.slice(1))
    return detail && root.contains(detail) ? detail : null
  }
  const reveal = (detail) => {
    detail.open = true
    refresh(0)
    requestAnimationFrame(() => scrollTo(detail, { duration: 0.45 }))
  }
  document.addEventListener('click', (event) => {
    const link = event.target.closest?.('a[href^="#"]')
    const detail = link && targetFor(link.getAttribute('href'))
    if (!detail) return
    event.preventDefault()
    reveal(detail)
    history.replaceState(null, '', '#' + detail.id)
  })
  const onHash = () => { const detail = targetFor(location.hash); if (detail) reveal(detail) }
  addEventListener('hashchange', onHash)
  root.querySelectorAll('details').forEach((detail) => detail.addEventListener('toggle', () => refresh(0)))
  onHash()
}
