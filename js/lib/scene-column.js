// ====================================
// scene-column.js — the procedural Three.js column (brief §6, slot G)
// ====================================
// Default export createColumnStage() -> the §6.1 stage object { attach, detach, intro, setProgress, setTilt, pause, resume,
//   refreshColors, dispose, ready } (+ QA helpers: stats(), setGovernor(on), engine).  Named export renderPoster(preset, el) for ?poster=.
// Imported ONLY by js/lib/column-stage.js (dynamic import, idle, MODE === 'full' and WebGL present).  Section modules never touch Three.
// One WebGLRenderer; the canvas is re-parented between the hero anchor (preset 'day') and the contact anchor (preset 'dusk').
// The sculpture is built from js/lib/column-geometry.js (the same centre-lines as column.svg): satin navy tubes, ink-grey wheels,
// a thin orange rim line on each wheel (never a filled orange area, brief §1.5).  Colours come from the --sculpt-* tokens.
// Loop: gsap.ticker (no second rAF).  Pauses when the anchor is off-screen, the tab is hidden, or a section pauses it.
// Governor (§6.7): three consecutive frames > 24 ms after the first 60 -> DPR 1 -> dust/parallax off + half rate -> poster + prc.lite.
// Debug params (poster mode only): ?ortho=1 (OrthographicCamera framing exactly the 210x300 logo box), ?yaw=<rad>, ?flat=1 (unlit silhouette).
import {
  WebGLRenderer, Scene, PerspectiveCamera, OrthographicCamera, Group, Mesh, Points, Color, Vector3,
  SRGBColorSpace, ACESFilmicToneMapping, PMREMGenerator, CatmullRomCurve3, TubeGeometry, CapsuleGeometry, TorusGeometry,
  SphereGeometry, PlaneGeometry, BufferGeometry, BufferAttribute, MeshPhysicalMaterial, MeshStandardMaterial, MeshBasicMaterial,
  ShaderMaterial, CanvasTexture, DirectionalLight, PointLight, BackSide, DoubleSide,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { gsap, IS_TOUCH } from '../motion.js'
import { COLUMN_PARTS, WHEELS, toWorld, R, WHEEL_R } from './column-geometry.js'

const POSTER_YAW = -0.4 // the posters are baked at this yaw; the live stage starts at it so the swap is imperceptible
const CAM_Z = 7.0
const FOV = 30
const PRESETS = {
  day: { key: 0xffe1c4, keyI: 2.4, baseYaw: -0.18, idleSpeed: 0.25, scale: 1, scrollScale: 0.16, dust: true, tint: 'navy', metal: 0.0, bodyEnv: 0.42, wheelEnv: 0.5 },
  dusk: { key: 0xffd2ae, keyI: 1.8, baseYaw: -0.3, idleSpeed: 0.15, scale: 0.9, scrollScale: 0, dust: false, tint: 'peach', metal: 0.25, bodyEnv: 1.0, wheelEnv: 1.0 },
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)
const isSmall = () => IS_TOUCH || window.innerWidth < 900
const pxCap = () => (isSmall() ? 1.25 : 1.5)

// ---------- tokens -> THREE.Color ----------
function tok(name, fallback) {
  const c = new Color()
  let v = ''
  try {
    v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  } catch {}
  try {
    c.set(v || fallback)
  } catch {
    c.set(fallback)
  }
  return c
}

function palette() {
  return {
    body: tok('--sculpt-body', 0x12182b),
    wheel: tok('--sculpt-wheel', 0x4b5268),
    rim: tok('--sculpt-rim', 0xff3600),
    glow: tok('--sculpt-glow', 0xff5a2a),
    zenith: tok('--sculpt-env-zenith', 0xbfd3e6),
    horizon: tok('--sculpt-env-horizon', 0xfff1e6),
    ground: tok('--sculpt-env-ground', 0xe9d6c6),
    duskTop: tok('--sculpt-dusk-top', 0x12182b),
    duskBottom: tok('--sculpt-dusk-bottom', 0x6b3a33),
    duskSun: tok('--sculpt-dusk-sun', 0xffb27a),
    peach: tok('--peach', 0xf2c7b8),
  }
}

// ---------- geometry ----------
function buildGeometry(small) {
  const tubular = small ? 90 : 200
  const radial = small ? 6 : 10
  const parts = []
  COLUMN_PARTS.forEach((part, i) => {
    const z = ((i % 5) - 2) * 0.02 // deterministic z offsets: a little parallax between strokes
    if (part.kind === 'curve') {
      const v = part.pts.map((p) => {
        const [x, y] = toWorld(p)
        return new Vector3(x, y, z)
      })
      parts.push(new TubeGeometry(new CatmullRomCurve3(v, false, 'catmullrom', 0.5), tubular, R, radial, false))
      // round caps (the logo has round line caps; an open tube would show a hole)
      for (const e of [v[0], v[v.length - 1]]) {
        const s = new SphereGeometry(R, radial, Math.max(4, radial >> 1))
        s.translate(e.x, e.y, e.z)
        parts.push(s)
      }
    } else {
      const [a, b] = part.pts.map(toWorld)
      const len = Math.hypot(b[0] - a[0], b[1] - a[1])
      const g = new CapsuleGeometry(R, len, 4, radial)
      g.rotateZ(Math.atan2(b[1] - a[1], b[0] - a[0]) - Math.PI / 2)
      g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, z)
      parts.push(g)
    }
  })
  const seg = small ? [10, 48] : [14, 72]
  const rings = WHEELS.map((w) => {
    const [x, y] = toWorld(w)
    const g = new TorusGeometry(WHEEL_R, R, seg[0], seg[1])
    g.translate(x, y, 0)
    return g
  })
  // thin rim line on the outer edge of each wheel's front face: tube radius 0.012 (about 2-3 px at the hero size)
  const rimR = WHEEL_R + R * 0.78
  const rimZ = Math.sqrt(R * R - (R * 0.78) ** 2) + 0.004
  const rimSeg = small ? [6, 48] : [8, 72]
  const rims = WHEELS.map((w) => {
    const [x, y] = toWorld(w)
    const g = new TorusGeometry(rimR, 0.012, rimSeg[0], rimSeg[1])
    g.translate(x, y, rimZ)
    return g
  })
  const out = { body: mergeGeometries(parts), wheels: mergeGeometries(rings), rim: mergeGeometries(rims) }
  parts.forEach((g) => g.dispose())
  rings.forEach((g) => g.dispose())
  rims.forEach((g) => g.dispose())
  return out
}

// ---------- environment (PMREM, generated once per preset, never downloaded) ----------
const SKY_VERT = 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }'
const SKY_FRAG =
  'uniform vec3 top, mid, bottom; varying vec3 vP; void main(){ float h = vP.y; vec3 c = h > 0.0 ? mix(mid, top, smoothstep(0.0, 0.9, h)) : mix(mid, bottom, smoothstep(0.0, -0.6, h)); gl_FragColor = vec4(c, 1.0); }'

function emissivePlane(w, h, color, mult, pos, look = new Vector3()) {
  const m = new MeshBasicMaterial({ color: new Color(color).multiplyScalar(mult), side: DoubleSide, toneMapped: false })
  const mesh = new Mesh(new PlaneGeometry(w, h), m)
  mesh.position.copy(pos)
  mesh.lookAt(look)
  return mesh
}

function buildEnvScene(preset, pal) {
  const sc = new Scene()
  const top = preset === 'dusk' ? pal.duskTop : pal.zenith
  const bottom = preset === 'dusk' ? pal.duskBottom : pal.ground
  const mid = preset === 'dusk' ? pal.duskBottom.clone().lerp(pal.duskTop, 0.5) : pal.horizon
  const sky = new Mesh(
    new SphereGeometry(20, 32, 16),
    new ShaderMaterial({ side: BackSide, depthWrite: false, uniforms: { top: { value: top }, mid: { value: mid }, bottom: { value: bottom } }, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG }),
  )
  sc.add(sky)
  const strip = preset === 'dusk' ? 5 : 8
  if (preset === 'dusk') {
    // a low warm sun disc instead of the softbox
    const disc = new Mesh(new SphereGeometry(1.1, 24, 12), new MeshBasicMaterial({ color: pal.duskSun.clone().multiplyScalar(10), toneMapped: false }))
    disc.scale.z = 0.01
    disc.position.set(-6, 1, -8)
    disc.lookAt(0, 0, 0)
    sc.add(disc)
  } else {
    sc.add(emissivePlane(6, 4, 0xfff3e0, 9, new Vector3(-5, 4, 3.5)))
  }
  sc.add(emissivePlane(0.3, 5, pal.horizon, strip, new Vector3(-6, 0, 2.5)))
  sc.add(emissivePlane(0.3, 5, pal.horizon, strip, new Vector3(6, 0, 2.5)))
  sc.add(emissivePlane(0.25, 4, pal.glow, 3, new Vector3(5, -3, 3)))
  return sc
}

function disposeScene(sc) {
  sc.traverse((o) => {
    if (o.geometry) o.geometry.dispose()
    if (o.material) o.material.dispose()
  })
}

// ---------- contact shadow + dust ----------
function makeShadowTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grd.addColorStop(0, 'rgba(255,255,255,1)')
  grd.addColorStop(0.55, 'rgba(255,255,255,0.45)')
  grd.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, 128, 128)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}

function makeDust(pal, count = 90) {
  const pos = new Float32Array(count * 3)
  const size = new Float32Array(count)
  const col = new Float32Array(count * 3)
  const speed = new Float32Array(count)
  const phase = new Float32Array(count)
  const a = pal.glow.clone().lerp(pal.peach, 0.35)
  const b = pal.peach
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 3.2
    pos[i * 3 + 1] = (Math.random() - 0.5) * 4
    pos[i * 3 + 2] = (Math.random() - 0.5) * 3
    size[i] = 1.5 + Math.random() * 1.5
    speed[i] = 0.02 + Math.random() * 0.03
    phase[i] = Math.random() * 6.283
    const c = Math.random() < 0.5 ? a : b
    col.set([c.r, c.g, c.b], i * 3)
  }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(pos, 3))
  geo.setAttribute('aSize', new BufferAttribute(size, 1))
  geo.setAttribute('aColor', new BufferAttribute(col, 3))
  const mat = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uPx: { value: 1 } },
    vertexShader: 'attribute float aSize; attribute vec3 aColor; uniform float uPx; varying vec3 vC; void main(){ vC = aColor; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv; gl_PointSize = aSize * uPx; }',
    fragmentShader: 'varying vec3 vC; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(vC, 0.35 * smoothstep(0.5, 0.25, d));\n#include <colorspace_fragment>\n}',
  })
  const pts = new Points(geo, mat)
  pts.frustumCulled = false
  return {
    object: pts,
    setPx(px) {
      mat.uniforms.uPx.value = px
    },
    update(dt, t) {
      for (let i = 0; i < count; i++) {
        let y = pos[i * 3 + 1] + speed[i] * dt
        if (y > 2) y = -2
        pos[i * 3 + 1] = y
        pos[i * 3] += Math.sin(t * 0.5 + phase[i]) * 0.0006
      }
      geo.attributes.position.needsUpdate = true
    },
    setColors(p) {
      const x = p.glow.clone().lerp(p.peach, 0.35)
      for (let i = 0; i < count; i++) {
        const c = i % 2 ? x : p.peach
        col.set([c.r, c.g, c.b], i * 3)
      }
      geo.attributes.aColor.needsUpdate = true
    },
    dispose() {
      geo.dispose()
      mat.dispose()
    },
  }
}

// ---------- the engine: renderer + scene + objects (shared by the live stage and renderPoster) ----------
function createEngine({ poster = false, ortho = false, flat = false } = {}) {
  const small = poster ? false : isSmall()
  const renderer = new WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: poster })
  renderer.setClearColor(0x000000, 0)
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  const canvas = renderer.domElement
  canvas.setAttribute('aria-hidden', 'true')
  canvas.tabIndex = -1
  canvas.style.cssText = 'position:absolute;inset:0;display:block;width:100%;height:100%;pointer-events:none'

  let pal = palette()
  const scene = new Scene()
  const camera = ortho ? new OrthographicCamera(-1.05, 1.05, 1.5, -1.5, 0.1, 50) : new PerspectiveCamera(FOV, 1, 0.1, 50)
  camera.position.set(0, 0, CAM_Z)
  camera.lookAt(0, 0, 0)

  const geo = buildGeometry(small)
  const bodyMat = flat
    ? new MeshBasicMaterial({ color: 0x000000 })
    : new MeshPhysicalMaterial({ color: pal.body, metalness: 0.55, roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.08, envMapIntensity: 1.4 })
  const wheelMat = flat
    ? new MeshBasicMaterial({ color: 0x000000 })
    : new MeshPhysicalMaterial({ color: pal.wheel, metalness: 0.1, roughness: 0.34, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 0.7 })
  const rimMat = flat
    ? new MeshBasicMaterial({ color: 0x000000 })
    : new MeshStandardMaterial({ color: pal.rim, metalness: 0, roughness: 0.4, emissive: pal.rim, emissiveIntensity: 0.25 })
  const group = new Group()
  const body = new Mesh(geo.body, bodyMat)
  const wheels = new Mesh(geo.wheels, wheelMat)
  const rimMesh = new Mesh(geo.rim, rimMat)
  group.add(body, wheels, rimMesh)
  scene.add(group)

  const key = new DirectionalLight(PRESETS.day.key, PRESETS.day.keyI)
  key.position.set(3, 4, 5)
  const rimLight = new PointLight(pal.rim, 15, 12)
  rimLight.position.set(-3, -1, -2)
  scene.add(key, rimLight)

  const shadowTex = makeShadowTexture()
  const shadowMat = new MeshBasicMaterial({ map: shadowTex, color: pal.body, transparent: true, opacity: 0.22, depthWrite: false })
  const shadow = new Mesh(new PlaneGeometry(2.6, 2.6), shadowMat)
  shadow.position.set(0, -1.68, -0.3)
  shadow.scale.set(1, 0.3, 1)
  if (!flat) scene.add(shadow)

  let dust = null
  const envs = {}
  const pmrem = new PMREMGenerator(renderer)
  function envFor(preset) {
    if (envs[preset]) return envs[preset]
    const es = buildEnvScene(preset, pal)
    const rt = pmrem.fromScene(es, 0.04)
    disposeScene(es)
    envs[preset] = rt
    return rt
  }

  let preset = 'day'
  const _hsl = { h: 0, s: 0, l: 0 }
  const _white = new Color(0xffffff)
  function tintBody() {
    const P = PRESETS[preset]
    if (P.tint === 'peach') {
      // dusk sits on a dark ground: a warm champagne body so the sculpture stays legible
      bodyMat.color.copy(pal.peach).lerp(_white, 0.45)
      wheelMat.color.copy(pal.wheel).lerp(pal.peach, 0.3)
    } else {
      // day: the navy token, lifted to a lit lacquer navy (a metal with the raw #12182B albedo would read black)
      pal.body.getHSL(_hsl)
      bodyMat.color.setHSL(_hsl.h, Math.min(1, _hsl.s + 0.3), 0.05)
      wheelMat.color.copy(pal.wheel).lerp(pal.body, 0.38)
    }
    // the orange rim line: token orange on day; on the dark dusk ground it blooms to red, so it leans toward the softer glow orange
    rimMat.color.copy(pal.rim)
    if (P.tint === 'peach') rimMat.color.lerp(pal.glow, 0.9).lerp(pal.peach, 0.3)
    rimMat.emissive.copy(rimMat.color)
    rimMat.emissiveIntensity = P.tint === 'peach' ? 0.08 : 0.25
    bodyMat.metalness = P.metal
    bodyMat.envMapIntensity = P.bodyEnv
    wheelMat.envMapIntensity = P.wheelEnv
  }
  function applyPreset(name) {
    preset = PRESETS[name] ? name : 'day'
    const P = PRESETS[preset]
    key.color.set(P.key)
    rimLight.intensity = P.tint === 'peach' ? 4 : 15
    key.intensity = P.keyI
    if (!flat) {
      scene.environment = envFor(preset).texture
      tintBody()
    }
    if (dust) dust.object.visible = P.dust && dustWanted
  }
  let dustWanted = true
  function enableDust(on) {
    dustWanted = on
    if (on && !dust && !small && !poster && !flat) {
      dust = makeDust(pal)
      dust.setPx(renderer.getPixelRatio())
      scene.add(dust.object)
    }
    if (dust) dust.object.visible = on && PRESETS[preset].dust
  }

  let aspect = 1
  function setSize(w, h) {
    w = Math.max(1, Math.round(w))
    h = Math.max(1, Math.round(h))
    renderer.setSize(w, h, false)
    aspect = w / h
    if (!ortho) {
      camera.aspect = aspect
      // a narrow anchor (phone contact) gets a longer lens distance so the 2.2-unit-wide sculpture never clips
      camera.position.z = CAM_Z * Math.max(1, 0.7 / aspect)
      camera.updateProjectionMatrix()
    }
  }
  function setPixelRatio(v) {
    renderer.setPixelRatio(v)
    if (dust) dust.setPx(v)
  }
  function refreshColors() {
    pal = palette()
    if (!flat) {
      tintBody()
      shadowMat.color.copy(pal.body)
      rimLight.color.copy(pal.rim)
      for (const k of Object.keys(envs)) {
        envs[k].dispose()
        delete envs[k]
      }
      scene.environment = envFor(preset).texture
      if (dust) dust.setColors(pal)
    }
  }
  let restored = false
  function rebuildAfterContextRestore() {
    restored = true // objects created before the loss belong to the dead context: dispose() must not touch them again
    for (const k of Object.keys(envs)) delete envs[k] // the PMREM targets died with the context
    pal = palette()
    scene.environment = flat ? null : envFor(preset).texture
  }
  function render() {
    renderer.render(scene, camera)
  }
  function dispose() {
    try {
      scene.environment = null
      if (restored) {
        renderer.forceContextLoss()
        canvas.remove()
        return
      }
      for (const k of Object.keys(envs)) envs[k].dispose()
      pmrem.dispose()
      geo.body.dispose()
      geo.wheels.dispose()
      geo.rim.dispose()
      bodyMat.dispose()
      wheelMat.dispose()
      rimMat.dispose()
      shadow.geometry.dispose()
      shadowMat.dispose()
      shadowTex.dispose()
      if (dust) dust.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      canvas.remove()
    } catch {}
  }

  return {
    renderer, canvas, scene, camera, group, key, rimLight, shadow, small,
    get dust() {
      return dust
    },
    get aspect() {
      return aspect
    },
    palette: () => pal,
    envFor, applyPreset, enableDust, setSize, setPixelRatio, refreshColors, rebuildAfterContextRestore, render, dispose,
  }
}

// ---------- the stage ----------
export default function createColumnStage() {
  const touchLike = !window.matchMedia('(pointer: fine)').matches
  const eng = createEngine()
  const { renderer, canvas, group, key, rimLight, shadow } = eng
  const dprCap = pxCap()
  eng.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap))
  eng.enableDust(true)

  let readyResolve
  const ready = new Promise((r) => {
    readyResolve = r
  })
  let anchor = null
  let presetName = 'day'
  let io = null
  let ro = null
  let roTimer = 0
  let inView = false
  let userPaused = false
  let docVisible = document.visibilityState !== 'hidden'
  let running = false
  let lost = false
  let dead = false
  let firstFrame = false
  let introPlayed = false
  let introTween = null
  let autoIntroTimer = 0
  let govOn = true

  // animated state
  let tProg = 0
  let cProg = 0
  let introYaw = 0
  let clock = 0
  let lastNow = 0
  const pointer = { x: 0, y: 0, tx: 0, ty: 0, external: false }

  // governor
  let level = 0
  let framesSinceAttach = 0
  let slow = 0
  let lock = 0
  let tickN = 0
  const samples = new Float32Array(240)
  let sampleI = 0

  // ----- poster <-> canvas handoff (the poster <img> under the canvas fades out once live) -----
  function posterImgs() {
    return anchor ? anchor.querySelectorAll('img.cover__poster, img.column-poster') : []
  }
  function setLive(on) {
    if (!anchor) return
    anchor.classList.toggle('is-live', on)
    posterImgs().forEach((img) => {
      img.style.transition = 'opacity .3s ease'
      img.style.opacity = on ? '0' : ''
    })
  }

  // ----- loop control -----
  function shouldRun() {
    return !!anchor && inView && docVisible && !userPaused && !lost && !dead
  }
  function sync() {
    const want = shouldRun()
    if (want && !running) {
      running = true
      lastNow = performance.now()
      gsap.ticker.add(tick)
    } else if (!want && running) {
      running = false
      gsap.ticker.remove(tick)
      slow = 0
    }
  }

  function yawFor(P, t) {
    const idleSpeed = touchLike ? 0.4 : P.idleSpeed
    const base = P.baseYaw + Math.sin(clock * idleSpeed) * 0.35
    const px = level >= 2 || touchLike ? 0 : pointer.x
    const prog = P.scrollScale ? cProg * (0.55 - P.baseYaw) : cProg * 0.25 // dusk keeps only a gentle drift
    return base + introYaw + px * 0.25 + prog
  }

  function pose(dt) {
    const P = PRESETS[presetName]
    cProg += (tProg - cProg) * Math.min(1, 0.12 * dt * 60)
    if (!touchLike && !pointer.external) {
      pointer.x += (pointer.tx - pointer.x) * Math.min(1, 0.08 * dt * 60)
      pointer.y += (pointer.ty - pointer.y) * Math.min(1, 0.08 * dt * 60)
    } else if (pointer.external) {
      pointer.x += (pointer.tx - pointer.x) * Math.min(1, 0.12 * dt * 60)
      pointer.y += (pointer.ty - pointer.y) * Math.min(1, 0.12 * dt * 60)
    }
    const floatS = Math.sin(clock * 0.6)
    group.rotation.y = yawFor(P, clock)
    group.rotation.x = level >= 2 || touchLike ? 0 : -pointer.y * 0.12
    group.position.y = floatS * 0.06
    // integration: the canvas box is already scaled by the cover scrub and the 42 deg yaw enlarges the near edge by ~10 %; the frame is
    // tight, so the sculpture shrinks slightly with progress instead of growing (it used to clip against the canvas top edge)
    group.scale.setScalar(P.scale * (1 - (P.scrollScale ? 0.1 : 0) * cProg))
    key.position.x = 3 + (level >= 2 ? 0 : pointer.x * 3)
    rimLight.position.x = -3 + cProg * 6
    shadow.material.opacity = 0.22 - floatS * 0.03
    shadow.scale.x = 1 - floatS * 0.04
    if (eng.dust && eng.dust.object.visible) eng.dust.update(dt, clock)
  }

  function renderNow(dt = 0) {
    pose(dt)
    eng.render()
    if (!firstFrame) {
      firstFrame = true
      setLive(true)
      readyResolve({ poster: false })
      scheduleWarm()
    }
  }

  function tick() {
    const now = performance.now()
    let ms = now - lastNow
    lastNow = now
    if (ms > 100) {
      slow = 0
      ms = 16.7 // a tab switch or GC hitch counts for nothing
    }
    const dt = Math.min(ms, 100) / 1000
    clock += dt
    samples[sampleI++ % samples.length] = ms
    tickN++
    // governor
    framesSinceAttach++
    if (govOn && framesSinceAttach > 60) {
      if (lock > 0) lock--
      else if (ms > 24) {
        slow++
        if (slow >= 3) {
          slow = 0
          lock = 90
          degrade()
          if (dead) return
        }
      } else slow = 0
    }
    if (level >= 2 && (tickN & 1)) return // every 2nd tick
    renderNow(dt)
  }

  function degrade() {
    level++
    if (level === 1) {
      eng.setPixelRatio(1)
      resize()
    } else if (level === 2) {
      eng.enableDust(false)
      pointer.tx = pointer.ty = pointer.x = pointer.y = 0
    } else {
      // level 3: poster + lite on the next load
      try {
        sessionStorage.setItem('prc.lite', '1')
      } catch {}
      setLive(false)
      teardown()
    }
  }

  // ----- sizing -----
  function resize() {
    if (!anchor || dead) return
    const w = anchor.clientWidth
    const h = anchor.clientHeight
    if (w < 2 || h < 2) return
    eng.setSize(w, h)
    if (firstFrame && !running) renderNow(0) // keep a paused canvas crisp after a resize
  }
  function onResize() {
    clearTimeout(roTimer)
    roTimer = window.setTimeout(resize, 120)
  }

  // ----- pointer (fine pointers only) -----
  function onPointer(e) {
    if (pointer.external || touchLike) return
    pointer.tx = (e.clientX / window.innerWidth) * 2 - 1
    pointer.ty = (e.clientY / window.innerHeight) * 2 - 1
  }
  if (!touchLike) window.addEventListener('pointermove', onPointer, { passive: true })

  function onVisibility() {
    docVisible = document.visibilityState !== 'hidden'
    sync()
  }
  document.addEventListener('visibilitychange', onVisibility)

  // ----- context loss -----
  function onLost(e) {
    e.preventDefault()
    lost = true
    setLive(false)
    sync()
  }
  function onRestored() {
    try {
      eng.rebuildAfterContextRestore()
      eng.applyPreset(presetName)
      lost = false
      resize()
      renderNow(0)
      setLive(true)
      sync()
    } catch (err) {
      console.warn('[scene-column] restore failed:', err && err.message ? err.message : err)
    }
  }
  canvas.addEventListener('webglcontextlost', onLost)
  canvas.addEventListener('webglcontextrestored', onRestored)

  // ----- prewarm the other preset's environment in idle time (so attaching dusk later never hitches) -----
  let warmed = false
  function scheduleWarm() {
    if (warmed) return
    warmed = true
    const run = () => {
      if (dead) return
      try {
        eng.envFor(presetName === 'dusk' ? 'day' : 'dusk')
      } catch {}
    }
    if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 4000 })
    else setTimeout(run, 1500)
  }

  function teardown() {
    dead = true
    running = false
    gsap.ticker.remove(tick)
    clearTimeout(roTimer)
    clearTimeout(autoIntroTimer)
    if (introTween) introTween.kill()
    if (io) io.disconnect()
    if (ro) ro.disconnect()
    window.removeEventListener('pointermove', onPointer)
    document.removeEventListener('visibilitychange', onVisibility)
    canvas.removeEventListener('webglcontextlost', onLost)
    canvas.removeEventListener('webglcontextrestored', onRestored)
    eng.dispose()
    readyResolve({ poster: true })
  }

  // ----- public API (§6.1) -----
  function detach() {
    if (!anchor) return
    if (canvas.parentNode === anchor) anchor.removeChild(canvas)
    if (io) io.disconnect()
    if (ro) ro.disconnect()
    setLive(false)
    anchor = null
    inView = false
    sync()
  }

  function attach(el, preset = 'day') {
    if (dead || !el) return
    if (anchor) detach()
    anchor = el
    presetName = PRESETS[preset] ? preset : 'day'
    if (getComputedStyle(anchor).position === 'static') anchor.style.position = 'relative'
    anchor.appendChild(canvas) // moves the node: no new WebGL context
    eng.applyPreset(presetName)
    // the live stage starts at the yaw the poster was baked at, so the swap is imperceptible
    introPlayed = false
    if (introTween) introTween.kill()
    introYaw = POSTER_YAW - PRESETS[presetName].baseYaw
    framesSinceAttach = 0
    slow = 0
    if (io) io.disconnect()
    if (ro) ro.disconnect()
    ro = new ResizeObserver(onResize)
    ro.observe(anchor)
    io = new IntersectionObserver(
      (entries) => {
        const last = entries[entries.length - 1]
        inView = last.isIntersecting
        sync()
      },
      { rootMargin: '10%', threshold: 0.05 },
    )
    io.observe(anchor)
    // first frame straight away so the harness / poster swap never waits for the observer round-trip
    const r = anchor.getBoundingClientRect()
    inView = r.bottom > -window.innerHeight * 0.1 && r.top < window.innerHeight * 1.1
    userPaused = false
    pointer.external = false // the new owner starts with the stage's own pointer listener (a hero setTilt must not outlive the hero)
    pointer.tx = 0
    pointer.ty = 0
    resize()
    try {
      renderNow(0)
    } catch (e) {
      console.warn('[scene-column] first frame failed:', e && e.message ? e.message : e)
      setLive(false)
      teardown()
      return
    }
    setLive(true) // every attach (not only the first ever frame): the poster under this anchor's canvas fades out
    // dusk has no hero intro: it eases from the poster yaw to its base yaw by itself; a day stage whose intro() never comes does the same
    clearTimeout(autoIntroTimer)
    if (presetName === 'dusk') intro()
    else autoIntroTimer = window.setTimeout(intro, 1500)
    sync()
  }

  function intro() {
    if (dead || introPlayed) return
    introPlayed = true
    clearTimeout(autoIntroTimer)
    if (introTween) introTween.kill()
    introTween = gsap.to(
      { v: introYaw },
      {
        v: 0,
        duration: 1.1,
        ease: 'power3.out',
        onUpdate() {
          introYaw = this.targets()[0].v
        },
        onComplete() {
          introYaw = 0
        },
      },
    )
  }

  const stage = {
    poster: false,
    ready,
    attach,
    detach,
    owns(el) {
      return !!el && anchor === el
    },
    intro,
    setProgress(p) {
      tProg = clamp01(+p || 0)
    },
    setTilt(x, y) {
      // an explicit tilt takes over from the pointer listener; setTilt(0, 0) hands it back
      const nx = Math.max(-1, Math.min(1, +x || 0))
      const ny = Math.max(-1, Math.min(1, +y || 0))
      pointer.external = !!(nx || ny)
      pointer.tx = nx
      pointer.ty = ny
    },
    pause() {
      userPaused = true
      sync()
    },
    resume() {
      userPaused = false
      sync()
    },
    refreshColors() {
      if (dead) return
      eng.refreshColors()
      if (firstFrame) renderNow(0)
    },
    dispose() {
      if (dead) return
      setLive(false)
      detach()
      teardown()
    },
    // QA helpers (not part of the §6.1 contract)
    setGovernor(on) {
      govOn = !!on
    },
    stats() {
      const n = Math.min(tickN, samples.length)
      const a = Array.from(samples.slice(0, n)).sort((x, y) => x - y)
      const info = renderer.info
      return {
        level,
        running,
        inView,
        dead,
        lost,
        frames: tickN,
        p50: a.length ? a[a.length >> 1] : 0,
        p95: a.length ? a[Math.floor(a.length * 0.95)] : 0,
        calls: info.render.calls,
        triangles: info.render.triangles,
        pixelRatio: renderer.getPixelRatio(),
        canvas: [canvas.width, canvas.height],
      }
    },
    engine: eng,
  }
  return stage
}

// ---------- ?poster=day|dusk : one deterministic frame, drawing buffer preserved, 840x1200 ----------
export async function renderPoster(preset = 'day', el) {
  const q = new URLSearchParams(location.search)
  const ortho = q.get('ortho') === '1'
  const flat = q.get('flat') === '1'
  const yaw = q.has('yaw') ? parseFloat(q.get('yaw')) : POSTER_YAW
  const eng = createEngine({ poster: true, ortho, flat })
  const host = el || document.body
  const w = host.clientWidth || 420
  const h = host.clientHeight || 600
  eng.setPixelRatio(2)
  eng.setSize(w, h)
  eng.applyPreset(preset)
  const P = PRESETS[preset] || PRESETS.day
  eng.group.rotation.y = yaw
  eng.group.scale.setScalar(ortho ? 1 : P.scale)
  eng.group.position.y = ortho ? 0 : 0
  if (!ortho) {
    eng.key.position.x = 3
    eng.rimLight.position.x = -3
  }
  host.appendChild(eng.canvas)
  eng.render()
  await new Promise((r) => requestAnimationFrame(() => r()))
  eng.render()
  window.__posterCanvas = eng.canvas
  return eng
}
