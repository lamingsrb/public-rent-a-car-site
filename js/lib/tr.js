// ====================================
// tr.js — translate a JS-generated string (brief §5.0.5)
// ====================================
// Exports:
//   tr(key, enFallback = EN_COMMON[key])  -> SR value when lang is SR and the key exists, else the EN fallback
//   fmt(str, vars)                         -> replaces {name} placeholders; undefined/empty values are left as written
//   trf(key, vars, enFallback)             -> fmt(tr(key, enFallback), vars)
// The existing t() in i18n.js returns null for EN and for missing SR keys; tr() is the one every JS-built string uses.
import { t } from '../i18n.js'
import { EN_COMMON } from './common-en.js'

export function tr(key, enFallback = EN_COMMON[key]) {
  const v = t(key)
  return v != null ? v : enFallback
}

export function fmt(str, vars = {}) {
  if (str == null) return ''
  return String(str).replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null && vars[k] !== '' ? String(vars[k]) : m))
}

export function trf(key, vars, enFallback) {
  return fmt(tr(key, enFallback), vars)
}
