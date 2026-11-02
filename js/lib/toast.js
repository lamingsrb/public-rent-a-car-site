// ====================================
// toast.js — polite live-region toast + the clipboard-fallback dialog (brief §5.0.4, §5.0.5)
// ====================================
// Exports:
//   toast(msg, ms = 3000)            -> shows a 3 s status message (role=status, aria-live=polite)
//   showCopyDialog(text, opts)       -> native <dialog> with the message text, a Copy button and (opts.number) the phone number.
//                                        opts: { channel, number }. Used when the clipboard is denied or the app did not open.
// DOM is created lazily; styles are in css/base.css (.toast, .copydlg). Strings come from common.* via tr().
import { tr, fmt } from './tr.js'

let region = null
let timer = 0

function ensureRegion() {
  if (region && region.isConnected) return region
  region = document.createElement('div')
  region.className = 'toast'
  region.setAttribute('role', 'status')
  region.setAttribute('aria-live', 'polite')
  region.setAttribute('aria-atomic', 'true')
  document.body.appendChild(region)
  return region
}

export function toast(msg, ms = 3000) {
  const el = ensureRegion()
  el.textContent = ''
  // set on the next frame so assistive tech announces repeated identical messages
  requestAnimationFrame(() => {
    el.textContent = msg
    el.classList.add('is-on')
  })
  clearTimeout(timer)
  timer = setTimeout(() => {
    el.classList.remove('is-on')
    setTimeout(() => {
      if (!el.classList.contains('is-on')) el.textContent = ''
    }, 400)
  }, ms)
}

let dlg = null

export function showCopyDialog(text, opts = {}) {
  if (dlg) dlg.remove()
  dlg = document.createElement('dialog')
  dlg.className = 'copydlg'
  dlg.setAttribute('data-lenis-prevent', '')
  dlg.setAttribute('aria-labelledby', 'copydlg-title')
  dlg.innerHTML = `
    <form method="dialog" class="copydlg__body">
      <h2 class="copydlg__title" id="copydlg-title"></h2>
      <textarea class="copydlg__text" readonly rows="5" aria-labelledby="copydlg-title"></textarea>
      <p class="copydlg__num small" hidden></p>
      <div class="copydlg__actions">
        <button type="button" class="btn btn--ink copydlg__copy"></button>
        <button type="submit" class="btn btn--outline copydlg__close"></button>
      </div>
    </form>`
  dlg.querySelector('.copydlg__title').textContent = opts.number ? tr('common.msg.openByHand') : tr('common.msg.copyTitle')
  const ta = dlg.querySelector('.copydlg__text')
  ta.value = text
  const copyBtn = dlg.querySelector('.copydlg__copy')
  copyBtn.textContent = tr('common.msg.copyBtn')
  dlg.querySelector('.copydlg__close').textContent = tr('common.close')
  if (opts.number) {
    const p = dlg.querySelector('.copydlg__num')
    p.hidden = false
    p.textContent = fmt(tr('common.copyNumber'), { tel: opts.number })
  }
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      ta.focus()
      ta.select()
      try {
        document.execCommand('copy')
      } catch {}
    }
    copyBtn.textContent = tr('common.copyDone')
  })
  dlg.addEventListener('close', () => {
    if (dlg) dlg.remove()
    dlg = null
  })
  document.body.appendChild(dlg)
  if (typeof dlg.showModal === 'function') dlg.showModal()
  else dlg.setAttribute('open', '')
  ta.focus()
  ta.select()
  return dlg
}
