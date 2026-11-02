// ====================================
// contact.js — back cover: message composer + dusk finish (brief 5.9). The dusk column moved to footer.js on 2026-11-01.
// ====================================
// The composer only builds text and hands it to a channel (contact.js openChannel). No <form>, no network request.
// Phone / e-mail / messenger values come from CONTACT: hrefs through data-contact (main.js fillContactLinks),
// printed text through data-contact-text (lib/contact.js fillContactTexts, called here so the section is complete before main.js runs).
// Events listened to: prc:showcar { id, fill?, source? } and prc:askcar { id } (preselect the car), prc:langchange (relabel).
import '../css/contact.css'
import { gsap, ScrollTrigger, mm, REDUCED } from './motion.js'
import { MODE } from './lib/motion-mode.js'
import { initReveals, showAll } from './lib/reveal.js'
import { CONTACT, contactLinks, fillContactTexts } from './lib/contact.js'
import { getVehicles, getVehicle, vehicleLabel } from './lib/vehicles.js'
import { toast, showCopyDialog } from './lib/toast.js'
import { tr, trf } from './lib/tr.js'
import { currentLang } from './i18n.js'

// The customer may be in any time zone. Rental dates use Belgrade's civil day,
// including its daylight-saving changes; UTC's day and the device's day can differ.
function belgradeToday() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Belgrade', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  const part = (type) => parts.find((p) => p.type === type).value
  return `${part('year')}-${part('month')}-${part('day')}`
}

function messageDate(value) {
  if (!value) return tr('common.msg.blank')
  // A date-only value has no time zone. Noon UTC preserves the selected civil
  // date without converting through the visitor's local time zone.
  return new Intl.DateTimeFormat(currentLang() === 'sr' ? 'sr-Latn' : 'en-GB', {
    timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric',
  }).format(new Date(`${value}T12:00:00Z`))
}

/** Clipboard write that never throws; resolves true when the text is on the clipboard. */
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/** Send a user-edited text (openChannel only knows the templates). Mirrors openChannel for each channel. */
async function sendCustom(channel, text) {
  if (channel === 'wa') {
    window.open(`${CONTACT.wa}?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
    return
  }
  if (channel === 'mail') {
    // the shared builder owns the scheme and subject; only the body is swapped for the edited text
    location.href = contactLinks().mail.replace(/([?&]body=).*$/, (_, k) => k + encodeURIComponent(text))
    return
  }
  if (channel === 'tel') {
    location.href = CONTACT.telHref
    return
  }
  const copied = await copyText(text)
  if (copied) toast(tr('common.msg.copied'))
  else showCopyDialog(text, { channel })
  location.href = channel === 'viber' ? CONTACT.viber : CONTACT.telegram
  if (copied) {
    setTimeout(() => {
      if (document.visibilityState === 'visible') showCopyDialog(text, { channel, number: CONTACT.telDisplay })
    }, 1600)
  }
}

function initComposer(root) {
  const $ = (sel) => root.querySelector(sel)
  const carSel = $('#cf-car')
  const pickSel = $('#cf-pickup')
  const dropSel = $('#cf-dropoff')
  const fromIn = $('#cf-from')
  const toIn = $('#cf-to')
  const pickTime = $('#cf-pickup-time')
  const dropTime = $('#cf-dropoff-time')
  const error = $('#cf-error')
  const msg = $('#cf-msg')
  const area = $('#cf-text')
  const editBtn = $('#cf-edit')
  if (!carSel || !pickSel || !dropSel || !fromIn || !toIn || !pickTime || !dropTime || !msg || !area || !editBtn) return

  let editing = false
  let dirty = false
  let attempted = false

  // ---- vehicle options (labels carry the year so duplicate names stay distinct) ----
  const vehicles = getVehicles()
  const fillCars = () => {
    const keep = carSel.value
    carSel.querySelectorAll('option[data-v]').forEach((o) => o.remove())
    vehicles.forEach((v) => {
      const o = document.createElement('option')
      o.value = v.id
      o.dataset.v = '1'
      o.textContent = vehicleLabel(v)
      carSel.appendChild(o)
    })
    carSel.value = keep && getVehicle(keep) ? keep : ''
  }
  fillCars()

  const dateFields = [fromIn, toIn, pickTime, dropTime]
  const updateLimits = () => {
    const today = belgradeToday()
    fromIn.min = today
    toIn.min = fromIn.value && fromIn.value >= today ? fromIn.value : today
    dropTime.min = fromIn.value && fromIn.value === toIn.value ? pickTime.value : ''
  }

  // Sending remains possible without dates for a general question. Once a
  // rental period is entered, require a complete, ordered date/time pair.
  const validate = (show = false) => {
    const today = belgradeToday()
    const from = fromIn.value
    const to = toIn.value
    const pt = pickTime.value
    const dt = dropTime.value
    let issue = null
    const fail = (key, fallback, fields) => { if (!issue) issue = { text: tr(key, fallback), fields } }
    if (dateFields.some((f) => f.validity.badInput)) {
      fail('contact.error.invalid', 'Enter valid dates and times.', dateFields.filter((f) => f.validity.badInput))
    } else if (from && from < today) {
      fail('contact.error.past', 'Choose a pick-up date from today onwards (Belgrade time).', [fromIn])
    } else if (to && to < today) {
      fail('contact.error.returnPast', 'The return date cannot be in the past.', [toIn])
    } else if ((from || to || pt || dt) && (!from || !to)) {
      fail('contact.error.dates', 'Choose both dates, or clear the dates and times for a general enquiry.', [!from && fromIn, !to && toIn].filter(Boolean))
    } else if ((from || to) && (!pt || !dt)) {
      fail('contact.error.times', 'Choose a pick-up time and a return time.', [!pt && pickTime, !dt && dropTime].filter(Boolean))
    } else if (from && to && `${to}T${dt}` <= `${from}T${pt}`) {
      fail('contact.error.order', 'Return must be after pick-up. Check the dates and times.', [toIn, dropTime])
    }
    if (show) {
      dateFields.forEach((field) => {
        const invalid = !!(issue && issue.fields.includes(field))
        field.setAttribute('aria-invalid', String(invalid))
        if (invalid) field.setAttribute('aria-describedby', 'cf-error')
        else field.removeAttribute('aria-describedby')
      })
      if (error) {
        error.textContent = issue ? issue.text : ''
        error.hidden = !issue
      }
    }
    return issue
  }

  const selectedLabel = (select) => select.selectedOptions[0]?.textContent.trim() || tr('common.msg.blank')
  const autoText = () => {
    const pickup = selectedLabel(pickSel)
    const dropoff = dropSel.value === 'same' ? pickup : selectedLabel(dropSel)
    const car = carSel.value ? vehicleLabel(getVehicle(carSel.value)) : tr('contact.messageAny', 'Not chosen yet')
    const blank = tr('common.msg.blank')
    return [
      tr('contact.messageIntro', 'Hello Public Rent a Car! Please send me a quote and confirm availability.'),
      trf('contact.messageCar', { car }, 'Car: {car}'),
      trf('contact.messagePickup', { location: pickup, date: messageDate(fromIn.value), time: pickTime.value || blank }, 'Pick-up: {location}, {date}, {time}'),
      trf('contact.messageReturn', { location: dropoff, date: messageDate(toIn.value), time: dropTime.value || blank }, 'Return: {location}, {date}, {time}'),
    ].join('\n')
  }
  const currentText = () => (editing && dirty && area.value.trim() ? area.value.trim() : '')

  const render = () => {
    updateLimits()
    if (attempted) validate(true)
    const text = autoText()
    if (msg.textContent !== text) msg.textContent = text // unchanged text is not re-announced by the live region
    if (editing && !dirty) area.value = text
  }

  ;[carSel, pickSel, dropSel, fromIn, toIn, pickTime, dropTime].forEach((el) => {
    el.addEventListener('input', render)
    el.addEventListener('change', render)
  })
  ;[pickSel, dropSel, fromIn, toIn, pickTime, dropTime].forEach((field) => {
    field.addEventListener('change', () => {
      document.dispatchEvent(new CustomEvent('prc:tripupdate', { detail: {
        pickup: pickSel.value, dropoff: dropSel.value,
        from: fromIn.value, to: toIn.value,
        pickupTime: pickTime.value, dropoffTime: dropTime.value,
      } }))
    })
  })
  root.addEventListener('focusin', updateLimits)
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render() })

  area.addEventListener('input', () => {
    dirty = true
  })
  editBtn.addEventListener('click', () => {
    editing = !editing
    dirty = false
    editBtn.setAttribute('aria-pressed', String(editing))
    msg.hidden = editing
    area.hidden = !editing
    if (editing) {
      area.value = autoText()
      area.focus()
    } else {
      render()
    }
  })

  // ---- send ----
  root.querySelectorAll('[data-send]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const channel = btn.dataset.send
      if (channel !== 'tel') {
        attempted = true
        updateLimits()
        const issue = validate(true)
        if (issue) {
          issue.fields[0]?.focus()
          return
        }
      }
      const custom = currentText()
      const text = custom || autoText()
      try {
        if (channel === 'copy') {
          if (await copyText(text)) toast(tr('common.msg.copied'))
          else showCopyDialog(text, { channel: 'copy' })
          return
        }
        await sendCustom(channel, text)
      } catch (err) {
        console.warn('[contact] send failed', err)
      }
    })
  })

  // ---- preselect from the fleet ("Ask about this car") ----
  const setCar = (id) => {
    if (!id || !getVehicle(id)) return
    carSel.value = id
    render()
  }
  document.addEventListener('prc:showcar', (e) => {
    const d = e.detail || {}
    if (d.fill || d.source === 'ask') setCar(d.id)
  })
  document.addEventListener('prc:askcar', (e) => setCar(e.detail && e.detail.id))
  document.addEventListener('prc:choosecar', (e) => setCar(e.detail && e.detail.id))
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href="#contact"][data-car]')
    if (a) setCar(a.dataset.car)
  })

  // Shared with the first-screen trip controls. Applying a trip never sends a
  // message or replaces the selected car; undefined properties keep their value.
  document.addEventListener('prc:tripchange', (e) => {
    const trip = e.detail || {}
    const setLocation = (select, value) => {
      if (value == null) return
      const normalized = value === 'milosa' ? 'milos' : value
      if ([...select.options].some((option) => option.value === normalized)) select.value = normalized
    }
    setLocation(pickSel, trip.pickup)
    setLocation(dropSel, trip.dropoff)
    for (const [key, field] of [['from', fromIn], ['to', toIn], ['pickupTime', pickTime], ['dropoffTime', dropTime]]) {
      if (trip[key] != null) field.value = String(trip[key])
    }
    render()
  })

  // ---- language swap: relabel the vehicles and the preview ----
  document.addEventListener('prc:langchange', () => {
    fillCars()
    fillContactTexts(root)
    render()
  })

  render()
}

function showStaticState(root) {
  showAll(root)
  root.classList.add('is-static')
  root.style.removeProperty('--dusk-w')
}

export function init() {
  const root = document.getElementById('contact')
  if (!root) return
  fillContactTexts(root)
  try {
    initComposer(root)
  } catch (e) {
    console.error('[contact] composer', e)
  }
  initReveals(root)

  mm.add({ reduce: '(prefers-reduced-motion: reduce)' }, (ctx) => {
    if (REDUCED || ctx.conditions.reduce || MODE === 'static') {
      showStaticState(root)
      return
    }
    // the dusk deepens with the section (the column lives in the footer since 2026-11-01; footer.js attaches it there)
    gsap.set(root, { '--dusk-w': 0.35 })
    const st = ScrollTrigger.create({
      id: 'contact-dusk',
      trigger: root,
      start: 'top bottom',
      end: 'bottom bottom',
      scrub: true,
      onUpdate: (self) => gsap.set(root, { '--dusk-w': 0.35 + 0.65 * self.progress }),
    })
    return () => {
      st.kill()
      root.style.removeProperty('--dusk-w')
    }
  })
}
