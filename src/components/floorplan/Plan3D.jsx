import { useEffect, useRef, useState } from 'react'
import { planBounds } from '../../utils/floorPlan'
import { buildPlanScene, disposeScene } from '../../utils/plan3d'

export default function Plan3D({ plan }) {
  const host = useRef(), reset = useRef(), [cutaway, setCutaway] = useState(false), [status, setStatus] = useState('Cargando vista 3D…')
  useEffect(() => {
    let disposed = false, cleanup = () => {}
    setStatus('Cargando vista 3D…')
    Promise.all([import('three'), import('three/addons/controls/OrbitControls.js')]).then(([THREE, { OrbitControls }]) => {
      if (disposed) return
      let renderer
      try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false }) }
      catch { setStatus('Este dispositivo no permite WebGL. Puedes seguir editando y exportando el plano en 2D.'); return }
      const node = host.current, scene = new THREE.Scene(), bounds = planBounds(plan)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setClearColor('#f5f3ed'); renderer.localClippingEnabled = true
      renderer.domElement.setAttribute('aria-label', 'Vista 3D de la distribución'); renderer.domElement.setAttribute('role', 'img')
      renderer.domElement.style.touchAction = 'none'; node.appendChild(renderer.domElement)
      const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 2000), controls = new OrbitControls(camera, renderer.domElement)
      controls.maxPolarAngle = Math.PI / 2 - 0.03; controls.minDistance = 0.5; controls.maxDistance = 800
      const cx = bounds.x + bounds.width / 2, cz = bounds.y + bounds.height / 2, size = Math.max(bounds.width, bounds.height, 4)
      const resetCamera = () => { camera.position.set(cx + size * 0.95, size * 1.1, cz + size * 1.1); controls.target.set(cx, 0.4, cz); controls.update() }
      reset.current = resetCamera
      scene.add(new THREE.HemisphereLight('#ffffff', '#b2aa98', 2.4))
      const sun = new THREE.DirectionalLight('#fff4df', 2.5); sun.position.set(cx - 8, 14, cz + 5); scene.add(sun)
      const model = buildPlanScene(THREE, plan, { cutaway }); scene.add(model)
      const grid = new THREE.GridHelper(Math.min(1000, Math.ceil(size * 1.8)), Math.min(100, Math.ceil(size * 1.8)), '#cec8bb', '#e2ded4'); grid.position.set(cx, -0.025, cz); scene.add(grid)
      const render = () => renderer.render(scene, camera)
      const resize = () => { const { width, height } = node.getBoundingClientRect(); renderer.setSize(Math.max(1, width), Math.max(1, height)); camera.aspect = Math.max(1, width) / Math.max(1, height); camera.updateProjectionMatrix(); render() }
      const observer = new ResizeObserver(resize); observer.observe(node)
      controls.addEventListener('change', render); resetCamera(); resize(); setStatus('')
      const contextLost = event => { event.preventDefault(); setStatus('La vista 3D ha perdido el contexto gráfico. Vuelve a 2D y abre 3D otra vez. Tus cambios se conservan.') }
      renderer.domElement.addEventListener('webglcontextlost', contextLost)
      cleanup = () => { observer.disconnect(); controls.removeEventListener('change', render); controls.dispose(); renderer.domElement.removeEventListener('webglcontextlost', contextLost); disposeScene(scene); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); reset.current = null }
    }).catch(() => { if (!disposed) setStatus('No se pudo cargar la vista 3D. Vuelve a 2D e inténtalo otra vez.') })
    return () => { disposed = true; cleanup() }
  }, [plan, cutaway])
  return <div className="absolute inset-0 bg-[#f5f3ed]" aria-label="Visor 3D">
    <div ref={host} className="absolute inset-0" />
    <div className="absolute left-4 right-4 top-4 flex flex-wrap items-center justify-between gap-2"><span className="rounded-lg bg-white/95 px-3 py-2 text-xs text-stone-600">Vista de volumen · medidas del plano</span><div className="flex gap-2"><button className="min-h-11 rounded-lg border border-stone-200 bg-white px-3 text-xs" aria-pressed={cutaway} onClick={() => setCutaway(value => !value)}>{cutaway ? 'Mostrar paredes completas' : 'Recortar paredes a 1 m'}</button><button className="min-h-11 rounded-lg border border-stone-200 bg-white px-3 text-xs" onClick={() => reset.current?.()}>Centrar 3D</button></div></div>
    {status && <p role="status" className="absolute left-1/2 top-1/2 max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-5 text-center text-sm text-stone-600">{status}</p>}
    <p className="pointer-events-none absolute bottom-4 left-4 right-4 rounded-lg bg-white/95 px-3 py-2 text-xs text-stone-500">Arrastra: girar · Rueda: acercar · Botón derecho: desplazar · Móvil: un dedo gira, dos desplazan y amplían. Edita la distribución en 2D.</p>
  </div>
}
