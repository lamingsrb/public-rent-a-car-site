// ====================================
// column-geometry.js — centre-lines of the logo column, in LOGO PIXELS (brief §6.3)
// ====================================
// Exports: PX, CX, CY, R, WHEEL_R, toWorld([x, y]), COLUMN_PARTS, WHEELS, catmullToBezier(pts), partPathD(part)
// Pure data + maths, no DOM and no Three: imported by scripts/gen-column-svg.mjs (-> public/assets/img/column.svg, the nav
// lockup and favicon) AND by the Three scene (slot G, scene-column.js), so the 2D mark and the 3D sculpture can never drift.
// Source: public-car-logo.png, 210 x 300 px, y down. Brief starting values (IoU 0.80 against the logo alpha) were tuned by coordinate
// descent against the real logo (stroke 9 px, round caps): IoU 0.93. Residual is stroke-edge anti-aliasing. Correct them HERE only.
//
// World mapping: X = (px - CX) * PX, Y = (CY - py) * PX. Stroke width ~9 px -> tube radius R = 0.045.
// catmullToBezier(pts) returns an SVG path string in logo px (signature fixed by the brief); partPathD(part) wraps it for bars.
export const PX = 0.01, CX = 105, CY = 150, R = 0.045, WHEEL_R = 0.235
export const toWorld = ([x, y]) => [(x - CX) * PX, (CY - y) * PX]

export const COLUMN_PARTS = [
  { id: 'capital', kind: 'curve', pts: [[15.5,6],[80.5,6],[151,6],[185,17],[201.5,42],[204,65],[192.5,89.5],[170,103],[138,105]] },
  { id: 'volute',  kind: 'curve', pts: [[4,37.5],[70,37.5],[131.5,37],[151.5,38],[165.5,42.5],[173.5,57.5],[169.5,74],[155.5,81],[142.5,75.5],[139.5,64],[146,56],[149,55.5],[155,59]] },
  { id: 'rail',    kind: 'curve', pts: [[137.5,40.5],[126.5,49.5],[121,62.5],[122.5,80.5],[131,94],[144.5,102.5]] },
  { id: 'bar3',    kind: 'bar',   pts: [[25.5,59.5],[105,59.5]] },
  { id: 'bar4',    kind: 'bar',   pts: [[45.5,83],[105.5,83]] },
  { id: 'shaftL',  kind: 'bar',   pts: [[105,104],[105,192]] },
  { id: 'shaftR',  kind: 'bar',   pts: [[139,108.5],[139,192]] },
  { id: 'base1',   kind: 'bar',   pts: [[68.5,210.75],[173.5,210.75]] },
  { id: 'base2',   kind: 'bar',   pts: [[68.5,227.5],[173,227.5]] },
]
export const WHEELS = [[92, 270], [153.5, 270]]

// Uniform Catmull-Rom (tension 0.5, as THREE.CatmullRomCurve3 'catmullrom') -> SVG cubic Bezier path in logo px.
// End points are reflected (P[-1] = 2 P0 - P1, P[n] = 2 Pn-1 - Pn-2), exactly like Three, so the SVG matches the 3D tubes.
export function catmullToBezier(pts) {
  const P = [[2*pts[0][0]-pts[1][0], 2*pts[0][1]-pts[1][1]], ...pts,
             [2*pts.at(-1)[0]-pts.at(-2)[0], 2*pts.at(-1)[1]-pts.at(-2)[1]]]
  let d = `M${pts[0][0]} ${pts[0][1]}`
  for (let i = 1; i < P.length - 2; i++) {
    const [p0, p1, p2, p3] = [P[i-1], P[i], P[i+1], P[i+2]]
    const c1 = [p1[0] + (p2[0]-p0[0]) / 6, p1[1] + (p2[1]-p0[1]) / 6]
    const c2 = [p2[0] - (p3[0]-p1[0]) / 6, p2[1] - (p3[1]-p1[1]) / 6]
    d += ` C${c1.map(n => +n.toFixed(2))} ${c2.map(n => +n.toFixed(2))} ${p2}`
  }
  return d
}

/** SVG path data (logo px) for one part: bars are a straight segment, curves go through catmullToBezier. */
export function partPathD(part) {
  if (part.kind === 'bar') return `M${part.pts[0][0]} ${part.pts[0][1]} L${part.pts[1][0]} ${part.pts[1][1]}`
  return catmullToBezier(part.pts)
}
