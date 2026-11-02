// One directed world and one scroll playhead. The CC BY licensed 2019 Karoq is
// not a reconstruction of the client's individual 2021 Sportline vehicle.
// Provenance: /assets/models/karoq-LICENSE.txt and karoq-manifest.json.
export const DRIVE_JOURNEY = Object.freeze({ start: .16, end: 1, distance: 36 })
export function driveTravelDistance(progress) {
  const t = Math.max(0, Math.min(1, (progress - DRIVE_JOURNEY.start) / (DRIVE_JOURNEY.end - DRIVE_JOURNEY.start)))
  return DRIVE_JOURNEY.distance * t * t * (3 - 2 * t)
}
export async function mountDriveScene(host, options = {}) {
  if (!host) throw new Error('A drive scene host is required')
  const { Scene, PerspectiveCamera, WebGLRenderer, Group, Mesh, Vector3, Box3, Color, Matrix4,
    PlaneGeometry, BoxGeometry, TubeGeometry, CatmullRomCurve3, BufferGeometry,
    Float32BufferAttribute, MeshStandardMaterial, MeshBasicMaterial, CanvasTexture,
    HemisphereLight, DirectionalLight, PMREMGenerator, FogExp2, DoubleSide,
    ACESFilmicToneMapping, SRGBColorSpace } = await import('three')
  const [{ GLTFLoader }, { MeshoptDecoder }, { RoomEnvironment }, { mergeGeometries }] = await Promise.all([
    import('three/examples/jsm/loaders/GLTFLoader.js'),
    import('three/examples/jsm/libs/meshopt_decoder.module.js'),
    import('three/examples/jsm/environments/RoomEnvironment.js'),
    import('three/examples/jsm/utils/BufferGeometryUtils.js'),
  ])
  const MODEL_URL = '/assets/models/karoq.glb'
  const phone = () => window.matchMedia('(max-width: 767px), (max-height: 500px) and (pointer: coarse)').matches
  const clamp = (n, a = 0, b = 1) => Math.max(a, Math.min(b, n))
  const smooth = (a, b, n) => { const t = clamp((n - a) / (b - a)); return t * t * (3 - 2 * t) }
  let dead = false, lost = false, inView = true, visible = !document.hidden
  let width = 0, height = 0, frame = 0, rendered = 0, ready = false
  let progress = 0, lastSignature = '', lastRenderMs = 0, view = 'story'
  let quality = 0, slowFrames = 0, meshcount = 0, modelTriangles = 0
  let travelDistance = 0, carScreenBounds = null, plateScreenBounds = []
  let renderer, resizeObserver, intersectionObserver, environment
  const scene = new Scene()
  scene.background = new Color(0x0b1320)
  scene.fog = new FogExp2(0x0b1320, 0.032)
  const camera = new PerspectiveCamera(34, 1, 0.1, 180)
  const car = new Group(), world = new Group(), route = new Group()
  scene.add(world, car, route)
  function fallback(reason) {
    if (renderer) renderer.domElement.style.opacity = '0'
    host.classList.remove('is-scene-ready')
    options.onFallback?.(reason)
    host.dispatchEvent(new CustomEvent('prc:drive-fallback', { bubbles: true, detail: { reason } }))
  }
  try { renderer = new WebGLRenderer({ alpha: false, antialias: true, powerPreference: 'high-performance' }) }
  catch (error) { fallback('webgl-unavailable'); throw error }
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.08
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, phone() ? 1.25 : 1.5))
  const canvas = renderer.domElement
  canvas.className = 'drive-scene__canvas'
  canvas.setAttribute('aria-hidden', 'true')
  canvas.tabIndex = -1
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;opacity:0;transition:opacity .4s ease'
  host.appendChild(canvas)
  const pmrem = new PMREMGenerator(renderer)
  function makeEnvironment() {
    environment?.dispose()
    const room = new RoomEnvironment()
    environment = pmrem.fromScene(room, 0.05)
    scene.environment = environment.texture
    room.dispose()
  }
  makeEnvironment()
  const ambient = new HemisphereLight(0xd8e7ff, 0x11151b, 2.0)
  const key = new DirectionalLight(0xf5f2ec, 3.5); key.position.set(4, 6, 4)
  const rim = new DirectionalLight(0x8fb9f2, 2.7); rim.position.set(-4, 4, -5)
  const warm = new DirectionalLight(0xffc09a, 1.7); warm.position.set(8, 3, -3)
  scene.add(ambient, key, rim, warm)
  const add = (geometry, material, parent, position) => {
    const mesh = new Mesh(geometry, material)
    if (position) mesh.position.set(...position)
    parent.add(mesh); return mesh
  }
  const floorMaterial = new MeshStandardMaterial({ color: 0x060c14, roughness: 0.94, metalness: 0.04 })
  const floor = add(new PlaneGeometry(180, 180), floorMaterial, world, [10, -0.018, 0])
  floor.rotation.x = -Math.PI / 2
  const shadowCanvas = document.createElement('canvas')
  shadowCanvas.width = shadowCanvas.height = 128
  const context = shadowCanvas.getContext('2d')
  const gradient = context.createRadialGradient(64, 64, 4, 64, 64, 64)
  gradient.addColorStop(0, 'rgba(0,0,0,.93)')
  gradient.addColorStop(.45, 'rgba(0,0,0,.80)')
  gradient.addColorStop(1, 'rgba(0,0,0,0)')
  context.fillStyle = gradient; context.fillRect(0, 0, 128, 128)
  const shadowTexture = new CanvasTexture(shadowCanvas)
  const shadow = add(new PlaneGeometry(5.6, 3.25), new MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false, opacity: .88 }), world, [0, .029, 0])
  shadow.rotation.x = -Math.PI / 2
  shadow.renderOrder = 2
  // This continuous ribbon and its architecture are abstract world geometry,
  // never a claim to depict an actual Belgrade road, building or pickup address.
  const roadCurve = new CatmullRomCurve3([
    new Vector3(-8, .012, 0), new Vector3(0, .012, 0), new Vector3(8, .012, -1.2),
    new Vector3(18, .012, -4.8), new Vector3(34, .012, -7), new Vector3(55, .012, -7),
  ], false, 'centripetal')
  roadCurve.arcLengthDivisions = 1000
  const roadDistances = roadCurve.getLengths(1000)
  const roadStartDistance = roadDistances[200]
  const roadLength = roadDistances[roadDistances.length - 1]
  const roadVertices = [], roadIndices = [], edgePoints = [[], []]
  for (let i = 0; i <= 160; i++) {
    const t = i / 160, point = roadCurve.getPoint(t), tangent = roadCurve.getTangent(t)
    const side = new Vector3(-tangent.z, 0, tangent.x).normalize()
    for (const sign of [-1, 1]) {
      const edge = point.clone().addScaledVector(side, sign * 1.72)
      roadVertices.push(edge.x, edge.y, edge.z)
      edgePoints[sign < 0 ? 0 : 1].push(edge.clone().setY(.025))
    }
    if (i < 160) { const a = i * 2; roadIndices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2) }
  }
  const roadGeometry = new BufferGeometry()
  roadGeometry.setAttribute('position', new Float32BufferAttribute(roadVertices, 3))
  roadGeometry.setIndex(roadIndices); roadGeometry.computeVertexNormals()
  const roadMaterial = new MeshStandardMaterial({ color: 0x0b1520, roughness: .92, metalness: .04, side: DoubleSide, transparent: true, opacity: 0 })
  add(roadGeometry, roadMaterial, route)
  const coral = new MeshBasicMaterial({ color: 0xff815e, transparent: true, opacity: 0, toneMapped: false })
  const blue = new MeshStandardMaterial({ color: 0x405367, roughness: .5, metalness: .55, transparent: true, opacity: 0 })
  const dashMaterial = new MeshBasicMaterial({ color: 0x8ea1b2, transparent: true, opacity: 0 })
  for (const points of edgePoints) add(new TubeGeometry(new CatmullRomCurve3(points), 160, .018, 5, false), coral, route)
  const dashGeometries = []
  for (let i = 2; i < 40; i++) {
    const t = i / 42, point = roadCurve.getPoint(t), tangent = roadCurve.getTangent(t)
    const geometry = new BoxGeometry(.68, .008, .026)
    geometry.rotateY(Math.atan2(-tangent.z, tangent.x)); geometry.translate(point.x, .022, point.z)
    dashGeometries.push(geometry)
  }
  add(mergeGeometries(dashGeometries), dashMaterial, route)
  dashGeometries.forEach(g => g.dispose())
  const structureGeometries = [], lightGeometries = []
  for (const t of [.30, .43, .59, .78]) {
    const point = roadCurve.getPoint(t), tangent = roadCurve.getTangent(t)
    const temp = new Group()
    temp.position.copy(point); temp.rotation.y = Math.atan2(-tangent.z, tangent.x)
    for (const sign of [-1, 1]) add(new BoxGeometry(.11, 3.1, .11), blue, temp, [0, 1.55, sign * 2.55])
    add(new BoxGeometry(.11, .11, 5.2), blue, temp, [0, 3.1, 0])
    add(new BoxGeometry(.018, 3.04, .025), coral, temp, [-.065, 1.56, 2.49])
    add(new BoxGeometry(.018, .025, 5.0), coral, temp, [-.065, 3.03, 0])
    temp.updateMatrixWorld(true)
    temp.traverse(object => {
      if (!object.isMesh) return
      const geometry = object.geometry.clone().applyMatrix4(object.matrixWorld)
      ;(object.material === coral ? lightGeometries : structureGeometries).push(geometry)
      object.geometry.dispose()
    })
  }
  for (const [geometries, material] of [[structureGeometries, blue], [lightGeometries, coral]]) {
    add(mergeGeometries(geometries), material, route); geometries.forEach(g => g.dispose())
  }
  let gltf
  try { gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(MODEL_URL) }
  catch (error) { fallback('model-load-failed'); dispose(); throw error }
  const model = gltf.scene
  model.updateMatrixWorld(true)
  const originalBox = new Box3().setFromObject(model)
  const size = originalBox.getSize(new Vector3()), center = originalBox.getCenter(new Vector3())
  model.position.x -= center.x; model.position.y -= originalBox.min.y; model.position.z -= center.z
  const normalized = new Group()
  normalized.rotation.y = -Math.PI / 2; normalized.scale.setScalar(4.38 / size.z)
  normalized.add(model); car.add(normalized)
  const materials = new Set(), wheels = [], originalPlates = []
  model.traverse(object => {
    // Each of these four source groups owns a single centred wheel. Their
    // shared wheel_rf_dummy is deliberately excluded: rotating it orbits all four.
    if (!object.isMesh && /^wheel\d*$/.test(object.name)) wheels.push({ object, restX: object.rotation.x })
    if (!object.isMesh) return
    if ([].concat(object.material).some(material => material.name === 'boot_ok.0')) originalPlates.push(object)
    meshcount++
    modelTriangles += object.geometry.index ? object.geometry.index.count / 3 : object.geometry.attributes.position.count / 3
    for (const material of [].concat(object.material)) {
      if (materials.has(material)) continue
      materials.add(material)
      if (material.name === 'primary') {
        material.color.set(0xb6bec4); material.metalness = .73; material.roughness = .23; material.envMapIntensity = 1.1
      } else if (/glass/.test(material.name) && material.transparent) {
        material.color.set(0x24313a); material.roughness = .10; material.metalness = .08
        material.opacity = Math.max(.32, material.opacity); material.depthWrite = false; material.envMapIntensity = .8
      } else { material.roughness = Math.max(.24, material.roughness); material.envMapIntensity = .65 }
    }
  })
  car.updateMatrixWorld(true)
  // Two runtime overlays replace the source SO plates. GLB vertices and UVs
  // remain unchanged; this graphic is not the client's actual registration.
  const plateText = 'BG 099-ST'
  const plateCanvas = document.createElement('canvas')
  plateCanvas.width = 1024; plateCanvas.height = 224
  const plateContext = plateCanvas.getContext('2d')
  plateContext.fillStyle = '#f5f3ed'; plateContext.fillRect(0, 0, 1024, 224)
  plateContext.strokeStyle = '#20252a'; plateContext.lineWidth = 12
  plateContext.strokeRect(8, 8, 1008, 208)
  plateContext.fillStyle = '#173977'; plateContext.fillRect(16, 16, 78, 192)
  plateContext.fillStyle = '#ffffff'; plateContext.font = 'bold 31px Arial, sans-serif'
  plateContext.fillText('SRB', 22, 190)
  plateContext.fillStyle = '#bb2632'
  plateContext.beginPath(); plateContext.moveTo(337, 53); plateContext.lineTo(385, 53)
  plateContext.lineTo(382, 132); plateContext.quadraticCurveTo(361, 160, 340, 132)
  plateContext.closePath(); plateContext.fill()
  plateContext.fillStyle = '#ffffff'; plateContext.fillRect(357, 61, 9, 79); plateContext.fillRect(342, 91, 38, 10)
  plateContext.strokeStyle = '#d4a546'; plateContext.lineWidth = 6
  plateContext.beginPath(); plateContext.moveTo(340, 45); plateContext.lineTo(345, 29)
  plateContext.lineTo(359, 41); plateContext.lineTo(375, 29); plateContext.lineTo(382, 45); plateContext.stroke()
  plateContext.fillStyle = '#11171c'
  plateContext.font = 'bold 147px "Arial Narrow", "Liberation Sans Narrow", Arial, sans-serif'
  plateContext.fillText('BG', 111, 168, 214)
  plateContext.fillText('099-ST', 407, 168, 585)
  plateContext.fillStyle = '#8b9196'
  for (const x of [118, 960]) for (const y of [26, 197]) {
    plateContext.beginPath(); plateContext.arc(x, y, 4, 0, Math.PI * 2); plateContext.fill()
  }
  const plateTexture = new CanvasTexture(plateCanvas)
  plateTexture.colorSpace = SRGBColorSpace
  plateTexture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy())
  const plateMaterial = new MeshStandardMaterial({ map: plateTexture, roughness: .58, metalness: .08, side: DoubleSide })
  const plates = [], plateUp = new Vector3(0, 1, 0)
  for (const original of originalPlates) {
    const box = new Box3().setFromObject(original), plateSize = box.getSize(new Vector3()), plateCenter = box.getCenter(new Vector3())
    if (plateSize.z < .3 || plateSize.z > .7 || plateSize.y < .05 || plateSize.y > .2) continue
    const end = plateCenter.x > 0 ? 'front' : 'rear'
    const outward = new Vector3(end === 'front' ? 1 : -1, 0, 0)
    const positions = original.geometry.attributes.position, indices = original.geometry.index
    const a = new Vector3(), b = new Vector3(), c = new Vector3(), ab = new Vector3(), ac = new Vector3(), candidate = new Vector3()
    let area = 0
    for (let i = 0; i < (indices ? indices.count : positions.count); i += 3) {
      a.fromBufferAttribute(positions, indices ? indices.getX(i) : i).applyMatrix4(original.matrixWorld)
      b.fromBufferAttribute(positions, indices ? indices.getX(i + 1) : i + 1).applyMatrix4(original.matrixWorld)
      c.fromBufferAttribute(positions, indices ? indices.getX(i + 2) : i + 2).applyMatrix4(original.matrixWorld)
      candidate.crossVectors(ab.subVectors(b, a), ac.subVectors(c, a))
      const triangleArea = candidate.length()
      if (triangleArea <= area || Math.abs(candidate.dot(outward)) < triangleArea * .8) continue
      if (candidate.dot(outward) < 0) candidate.negate()
      outward.copy(candidate).normalize(); area = triangleArea
    }
    const right = new Vector3().crossVectors(plateUp, outward).normalize()
    const up = new Vector3().crossVectors(outward, right).normalize()
    const overlay = add(new PlaneGeometry(plateSize.z * 1.015, plateSize.y * 1.025), plateMaterial, car)
    overlay.position.copy(plateCenter).addScaledVector(outward, .0045)
    overlay.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(right, up, outward))
    original.visible = false
    plates.push({ object: overlay, end, normal: outward.clone(), width: plateSize.z * 1.015, height: plateSize.y * 1.025 })
  }
  car.updateMatrixWorld(true)
  const carBox = new Box3().setFromObject(car), corners = []
  for (const x of [carBox.min.x, carBox.max.x]) for (const y of [carBox.min.y, carBox.max.y]) for (const z of [carBox.min.z, carBox.max.z]) corners.push(new Vector3(x, y, z))
  // Four authored station holds, joined by smooth camera travel through one world.
  const stops = [
    { p: 0, eye: [7, 2.2, 6.8], target: [0, .78, 0], detail: 0, road: 0 },
    { p: .12, eye: [7, 2.2, 6.8], target: [0, .78, 0], detail: 0, road: 0 },
    { p: .19, eye: [5.4, 1.5, 6.3], target: [.5, .62, .2], detail: .35, road: .35 },
    { p: .27, eye: [2.8, 1.05, 4.9], target: [.95, .57, .4], detail: 1, road: .75 },
    { p: .42, eye: [2.8, 1.05, 4.9], target: [.95, .57, .4], detail: 1, road: 1 },
    { p: .49, eye: [6.3, 4.2, 8.6], target: [2, .75, -.15], detail: .2, road: 1 },
    { p: .55, eye: [9, 6.7, 9.3], target: [3.7, .65, -.35], detail: 0, road: 1 },
    { p: .70, eye: [9, 6.7, 9.3], target: [3.7, .65, -.35], detail: 0, road: 1 },
    { p: .80, eye: [-3, 3.4, 7.5], target: [2.2, .7, -.2], detail: 0, road: 1 },
    { p: .85, eye: [-5.3, 2.2, 4.8], target: [.8, .75, -.2], detail: 0, road: 1 },
    { p: 1, eye: [-6.7, 2.3, 4.5], target: [1.2, .8, -.25], detail: 0, road: 1 },
  ]
  function poseAt(p) {
    let index = 0
    while (index < stops.length - 2 && p > stops[index + 1].p) index++
    const a = stops[index], b = stops[index + 1], t = smooth(a.p, b.p, p)
    return { eye: a.eye.map((v, i) => v + (b.eye[i] - v) * t), target: a.target.map((v, i) => v + (b.target[i] - v) * t),
      detail: a.detail + (b.detail - a.detail) * t, road: a.road + (b.road - a.road) * t }
  }
  const target = new Vector3(), projectionPoint = new Vector3()
  const worldUp = new Vector3(0, 1, 0), travelPoint = new Vector3(), travelTangent = new Vector3()
  const baseBackground = new Color(0x0b1320), roadBackground = new Color(0x172b3d)
  function applyPose() {
    const pose = poseAt(progress)
    travelDistance = driveTravelDistance(progress)
    const routeProgress = clamp((roadStartDistance + travelDistance) / roadLength)
    roadCurve.getPointAt(routeProgress, travelPoint); roadCurve.getTangentAt(routeProgress, travelTangent)
    car.position.set(travelPoint.x, .014, travelPoint.z)
    car.rotation.y = Math.atan2(-travelTangent.z, travelTangent.x)
    const wheelRoll = -travelDistance / .345
    for (const wheel of wheels) wheel.object.rotation.x = wheel.restX + wheelRoll
    shadow.position.set(car.position.x, .029, car.position.z); shadow.rotation.z = car.rotation.y
    camera.position.set(...pose.eye).applyAxisAngle(worldUp, car.rotation.y).add(car.position)
    target.set(...pose.target).applyAxisAngle(worldUp, car.rotation.y).add(car.position)
    if (view !== 'story') {
      const angle = { front: .04, side: 1.48, rear: 2.65, 'three-quarter': .81 }[view]
      camera.position.set(Math.cos(angle) * 8, 2.1, Math.sin(angle) * 8).add(car.position)
      target.copy(car.position); target.y += .75
    }
    camera.lookAt(target); camera.zoom = 1; camera.clearViewOffset(); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true); car.updateMatrixWorld(true)
    const safe = width <= 700 ? { l: .045, r: .955, t: .50, b: .90 } : { l: .435, r: .965, t: .16, b: .84 }
    function projected() {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
      for (const original of corners) {
        projectionPoint.copy(original)
        if (view === 'story' && pose.detail > 0) {
          const clippedX = Math.max(-.1, projectionPoint.x)
          projectionPoint.x += (clippedX - projectionPoint.x) * pose.detail
        }
        projectionPoint.applyMatrix4(car.matrixWorld).project(camera)
        minX = Math.min(minX, projectionPoint.x); maxX = Math.max(maxX, projectionPoint.x)
        minY = Math.min(minY, projectionPoint.y); maxY = Math.max(maxY, projectionPoint.y)
      }
      return { minX, maxX, minY, maxY }
    }
    let bounds = projected()
    camera.zoom = Math.min(1, (safe.r - safe.l) * 2 / (bounds.maxX - bounds.minX), (safe.b - safe.t) * 2 / (bounds.maxY - bounds.minY))
    camera.updateProjectionMatrix(); bounds = projected()
    const shiftX = safe.l + safe.r - 1 - (bounds.minX + bounds.maxX) / 2
    const shiftY = 1 - safe.t - safe.b - (bounds.minY + bounds.maxY) / 2
    camera.setViewOffset(width, height, -shiftX * width / 2, shiftY * height / 2, width, height)
    function screenBox(points, matrix) {
      let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity
      for (const point of points) {
        projectionPoint.copy(point).applyMatrix4(matrix).project(camera)
        const x = (projectionPoint.x + 1) * width / 2, y = (1 - projectionPoint.y) * height / 2
        left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y)
      }
      return { left: +left.toFixed(1), right: +right.toFixed(1), top: +top.toFixed(1), bottom: +bottom.toFixed(1) }
    }
    carScreenBounds = screenBox(corners, car.matrixWorld)
    plateScreenBounds = plates.map(plate => {
      const points = []
      for (const x of [-plate.width / 2, plate.width / 2]) for (const y of [-plate.height / 2, plate.height / 2]) points.push(new Vector3(x, y, 0))
      const normal = plate.normal.clone().transformDirection(car.matrixWorld)
      const position = plate.object.getWorldPosition(new Vector3())
      return { end: plate.end, ...screenBox(points, plate.object.matrixWorld), facingCamera: normal.dot(camera.position.clone().sub(position)) > 0 }
    })
    roadMaterial.opacity = pose.road * .96; coral.opacity = pose.road * .9; blue.opacity = pose.road * .72; dashMaterial.opacity = pose.road * .3
    route.visible = pose.road > .001
    const opening = smooth(.78, 1, progress)
    scene.background.copy(baseBackground).lerp(roadBackground, opening); scene.fog.color.copy(scene.background); scene.fog.density = .032 - .012 * pose.road
    warm.intensity = 1.7 + opening * 1.4; rim.intensity = 2.7 - opening * .6; key.intensity = 3.5 + opening * .6
    canvas.dataset.progress = progress.toFixed(4); canvas.dataset.chapter = String(progress < .19 ? 1 : progress < .49 ? 2 : progress < .80 ? 3 : 4)
    canvas.dataset.camera = camera.position.toArray().map(v => v.toFixed(3)).join(',')
    return [...camera.position.toArray(), ...target.toArray(), camera.zoom, ...car.position.toArray(), car.rotation.y, pose.road, opening, width, height, view].join('|')
  }
  function canRender() { return !dead && !lost && visible && inView && width > 1 && height > 1 }
  function schedule() { if (canRender() && !frame) frame = requestAnimationFrame(render) }
  function render() {
    frame = 0
    if (!canRender()) return
    const signature = applyPose()
    if (signature === lastSignature && ready) return
    const start = performance.now()
    try { renderer.render(scene, camera) } catch { lost = true; fallback('render-failed'); return }
    lastRenderMs = performance.now() - start; lastSignature = signature; rendered++
    if (rendered > 8 && lastRenderMs > 24) slowFrames++
    else slowFrames = 0
    if (slowFrames >= 3 && !quality) { quality = 1; renderer.setPixelRatio(1); renderer.setSize(width, height, false); lastSignature = ''; schedule() }
    if (!ready) { ready = true; canvas.style.opacity = '1'; host.classList.add('is-scene-ready'); options.onReady?.() }
  }
  function resize() {
    if (dead) return
    width = Math.round(host.clientWidth); height = Math.round(host.clientHeight)
    if (width < 2 || height < 2) return
    camera.aspect = width / height
    renderer.setPixelRatio(quality ? 1 : Math.min(window.devicePixelRatio || 1, phone() ? 1.25 : 1.5))
    renderer.setSize(width, height, false); lastSignature = ''; schedule()
  }
  function onVisibility() {
    visible = !document.hidden
    if (!visible && frame) { cancelAnimationFrame(frame); frame = 0 }
    if (visible) schedule()
  }
  function onLost(event) {
    event.preventDefault(); lost = true; ready = false
    if (frame) cancelAnimationFrame(frame)
    frame = 0; lastSignature = ''; fallback('context-lost')
  }
  function onRestored() {
    if (dead) return
    try { lost = false; makeEnvironment(); resize() } catch { lost = true; fallback('context-restore-failed') }
  }
  function dispose() {
    if (dead) return
    dead = true
    if (frame) cancelAnimationFrame(frame)
    frame = 0; resizeObserver?.disconnect(); intersectionObserver?.disconnect()
    document.removeEventListener('visibilitychange', onVisibility)
    canvas.removeEventListener('webglcontextlost', onLost); canvas.removeEventListener('webglcontextrestored', onRestored)
    host.classList.remove('is-scene-ready'); scene.environment = null; environment?.dispose(); pmrem.dispose()
    const geometries = new Set(), materials = new Set(), textures = new Set()
    scene.traverse(object => {
      if (object.geometry) geometries.add(object.geometry)
      for (const material of [].concat(object.material || [])) {
        materials.add(material)
        for (const value of Object.values(material)) if (value?.isTexture) textures.add(value)
      }
    })
    for (const geometry of geometries) geometry.dispose()
    for (const material of materials) material.dispose()
    for (const texture of textures) { texture.source?.data?.close?.(); texture.dispose() }
    renderer.dispose(); renderer.forceContextLoss(); canvas.remove()
  }
  intersectionObserver = new IntersectionObserver(entries => {
    inView = entries[entries.length - 1].isIntersecting
    if (!inView && frame) { cancelAnimationFrame(frame); frame = 0 }
    if (inView) schedule()
  }, { threshold: .01 })
  intersectionObserver.observe(host)
  resizeObserver = new ResizeObserver(resize); resizeObserver.observe(host)
  document.addEventListener('visibilitychange', onVisibility)
  canvas.addEventListener('webglcontextlost', onLost); canvas.addEventListener('webglcontextrestored', onRestored)
  resize()
  return {
    setProgress(value) { progress = clamp(Number(value) || 0); view = 'story'; canvas.dataset.progress = progress.toFixed(4); schedule() },
    setView(value) { if (!['story', 'front', 'side', 'rear', 'three-quarter'].includes(value)) return; view = value; schedule() },
    stats() {
      return { progress, chapter: progress < .19 ? 1 : progress < .49 ? 2 : progress < .80 ? 3 : 4,
        camera: camera.position.toArray().map(n => +n.toFixed(4)), target: target.toArray().map(n => +n.toFixed(4)),
        model: 'Skoda Karoq 2019', modelUrl: MODEL_URL, meshcount, tris: Math.round(modelTriangles),
        rendered, running: !!frame, inView, visible, lost, view, dpr: renderer.getPixelRatio(),
        calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, lastRenderMs: Math.round(lastRenderMs * 100) / 100,
        car: car.position.toArray().map(n => +n.toFixed(4)), lens: +camera.zoom.toFixed(4),
        wheels: wheels.length, wheelRoll: +(wheels[0]?.object.rotation.x || 0).toFixed(4),
        plateText, BGplateCount: plates.length, plateScreenBounds, carScreenBounds,
        travelDistance: +travelDistance.toFixed(4), journeyStart: DRIVE_JOURNEY.start, journeyEnd: DRIVE_JOURNEY.end }
    },
    dispose,
  }
}
