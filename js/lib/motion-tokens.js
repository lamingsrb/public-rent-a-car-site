// ====================================
// motion-tokens.js — shared motion constants (brief §7.2). Section code never types a magic number.
// ====================================
// Exports: DUR { micro, ui, reveal, scene, long }, EASE { out, inOut, press } (CustomEase objects usable as gsap `ease`),
//          DIST { y, yLarge, x, stagger, staggerLines, staggerCards }
// CSS counterparts: --dur-1..5, --ease-out / --ease-in-out / --ease-press (tokens.css).
import { CustomEase } from '../motion.js' // motion.js registers CustomEase first

// Lazar 2026-10-31 (D-11): faster transformations, readability kept — reveal .72->.5, scene 1.1->.8, long 1.6->1.1.
export const DUR = { micro: 0.12, ui: 0.2, reveal: 0.5, scene: 0.8, long: 1.1 }
export const EASE = {
  out: CustomEase.create('prcOut', '.16,1,.3,1'),
  inOut: CustomEase.create('prcInOut', '.65,0,.35,1'),
  press: CustomEase.create('prcPress', '.3,0,.2,1'),
}
export const DIST = { y: 24, yLarge: 60, x: 40, stagger: 0.05, staggerLines: 0.06, staggerCards: 0.08 }
