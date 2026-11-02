// ====================================
// vehicles.js — the one place sections read the fleet from (brief §10.5)
// ====================================
// Exports: GROUP_ORDER, getVehicles(), getVehicle(id), vehicleName(v, lang), vehicleLabel(v, lang), priceLabel(v, lang),
//          specLine(v, lang), hasPhotos(v), hasCut(v), showCar(id, opts), groupCounts()
// Source: data/fleet.json (read-only archive copy). Display order is fixed here (not the JSON order):
//   hatchback (5) -> suv (4) -> sedan (4) -> van (1) = 14.
// hasCut(v) is data-driven: true only when the cut-out render exists in the generated media index (js/lib/media-index.js);
//   currently false for skoda-karoq, toyota-yaris-cross, toyota-yaris -> sections fall back to the card render.
// showCar(id, {open}) is how Cover/Reel/Price/Atlas open a car in the Fleet section:
//   it dispatches document event `prc:showcar` { id, open, source } once Fleet is ready (window.__prcFleetReady === true),
//   otherwise it queues { id, open } in window.__prcShowCarQueue (Fleet drains the queue in init and sets the flag).
//   Unknown id -> one console.warn, nothing else happens. Fleet announces completion with `prc:showcar:done`.
import FLEET from '../../data/fleet.json'
import { mediaInfo } from './media.js'
import { currentLang } from '../i18n.js'
import { tr, fmt } from './tr.js'

export const GROUP_ORDER = ['hatchback', 'suv', 'sedan', 'van']

const ORDER = [
  'polo-comfort', 'skoda-fabia-2', 'skoda-fabia', 'toyota-yaris', 'skoda-scala',
  'toyota-yaris-cross', 'skoda-kamiq-2', 'skoda-kamiq', 'skoda-karoq',
  'skoda-octavia', 'toyota-corolla-2', 'skoda-superb', 'skoda-superb-2',
  'mercedes-v',
]

const byId = new Map(FLEET.vehicles.map((v) => [v.id, v]))
const LIST = ORDER.map((id) => byId.get(id)).filter(Boolean)
// anything the JSON has that ORDER does not know still shows up, at the end of its group
FLEET.vehicles.forEach((v) => {
  if (!ORDER.includes(v.id)) LIST.push(v)
})
LIST.sort((a, b) => GROUP_ORDER.indexOf(a.category.key) - GROUP_ORDER.indexOf(b.category.key) || LIST.indexOf(a) - LIST.indexOf(b))

const lg = (lang) => (lang || currentLang()) === 'sr' ? 'sr' : 'en'

export function getVehicles() {
  return LIST.slice()
}

export function getVehicle(id) {
  return byId.get(id) || null
}

export function vehicleName(v, lang) {
  return v ? v.name : ''
}

/** "Škoda Fabia · 2021"; the van reads "Mercedes V-Class · 8 seats" / "Mercedes V-Class · 8 sedišta". */
export function vehicleLabel(v, lang) {
  if (!v) return ''
  if (v.category.key === 'van') return `${v.name} · ${fmt(tr('common.seats'), { n: v.seats })}`
  return v.year ? `${v.name} · ${v.year}` : v.name
}

/** "from €20 / day*" (EN) / "od 20 € / dan*" (SR). Empty string when the price is unknown (never invent one). */
export function priceLabel(v, lang) {
  if (!v || v.price_from_eur == null) return ''
  return fmt(tr('common.price.from'), { n: Math.round(v.price_from_eur) })
}

/** "Automatic · Hybrid · 92 hp · 5 seats" — null fields are skipped. */
export function specLine(v, lang) {
  if (!v) return ''
  const l = lg(lang)
  const parts = []
  if (v.transmission && v.transmission[l]) parts.push(v.transmission[l])
  if (v.fuel && v.fuel[l]) parts.push(v.fuel[l])
  if (v.hp) parts.push(`${v.hp} ${tr('common.unit.hp')}`)
  if (v.seats) parts.push(fmt(tr('common.seats'), { n: v.seats }))
  return parts.join(' · ')
}

export function hasPhotos(v) {
  return !!(v && v.photos && v.photos.length)
}

export function hasCut(v) {
  return !!(v && v.card && v.card.cut && mediaInfo(v.card.cut))
}

export function showCar(id, opts = {}) {
  if (!byId.has(id)) {
    console.warn('[vehicles] showCar: unknown id', id)
    return false
  }
  const detail = { id, open: opts.open !== false, source: opts.source || '' }
  if (window.__prcFleetReady === true) {
    document.dispatchEvent(new CustomEvent('prc:showcar', { detail }))
  } else {
    ;(window.__prcShowCarQueue = window.__prcShowCarQueue || []).push({ id, open: detail.open })
  }
  return true
}

/** { hatchback: 5, suv: 4, sedan: 4, van: 1 } */
export function groupCounts() {
  const out = {}
  GROUP_ORDER.forEach((k) => (out[k] = 0))
  LIST.forEach((v) => {
    out[v.category.key] = (out[v.category.key] || 0) + 1
  })
  return out
}
