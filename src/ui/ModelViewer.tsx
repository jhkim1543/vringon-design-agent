// ── 3D 뷰어 · 보드 카드 안에서 GLB를 돌려 본다 ──────────────────────
// 외부 CDN을 쓰지 않는다. 정적 배포에서도 그대로 돌아야 하므로 three를 번들에 넣는다.
//
// 카드가 열릴 때마다 WebGL을 켜지 않는다. 이유가 둘이다.
//  · 브라우저는 동시에 열 수 있는 WebGL 컨텍스트 수가 제한된다 (보통 16개)
//  · 보드는 노드를 자주 다시 그려서, 자동 초기화하면 컨텍스트를 만들자마자 버리게 된다
// 그래서 눌렀을 때만 띄우고, 닫으면 정리한다.
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { t } from '../core/i18n'

function Stage({ url, height, light, onError }: {
  url: string; height: number; light?: boolean; onError: (m: string) => void
}) {
  const host = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const el = host.current
    if (!el) return
    let frame = 0
    let disposed = false
    let renderer: THREE.WebGLRenderer | null = null
    let controls: OrbitControls | null = null

    try {
      const w = el.clientWidth || 280
      const h = height
      const scene = new THREE.Scene()
      scene.background = new THREE.Color(light ? 0xf3f5f8 : 0x0f1217)

      const camera = new THREE.PerspectiveCamera(38, w / h, 0.01, 100)
      camera.position.set(0.9, 0.55, 1.6)

      renderer = new THREE.WebGLRenderer({ antialias: true })
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
      renderer.setSize(w, h)
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      el.appendChild(renderer.domElement)

      // 스튜디오 조명 · 제품이니 형태가 읽혀야 한다
      scene.add(new THREE.HemisphereLight(0xffffff, light ? 0xd8dde4 : 0x1a1f26, 1.5))
      const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(2.5, 3, 2); scene.add(key)
      const fill = new THREE.DirectionalLight(0xffffff, 0.7); fill.position.set(-2, 1, -1.5); scene.add(fill)

      controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.enablePan = false
      controls.minDistance = 0.6
      controls.maxDistance = 4
      // 캔버스 위에서는 보드가 아니라 모델이 반응해야 한다
      const stop = (e: Event) => e.stopPropagation()
      renderer.domElement.addEventListener('wheel', stop, { passive: false })
      renderer.domElement.addEventListener('pointerdown', stop)

      new GLTFLoader().load(url, (gltf) => {
        if (disposed) return
        const root = gltf.scene
        // Tripo 결과는 스케일이 제각각이다. 화면에 맞게 정규화한다.
        const box = new THREE.Box3().setFromObject(root)
        const size = box.getSize(new THREE.Vector3())
        const centre = box.getCenter(new THREE.Vector3())
        const s = 1 / Math.max(size.x, size.y, size.z, 1e-4)
        root.scale.setScalar(s)
        root.position.sub(centre.multiplyScalar(s))
        scene.add(root)
        setReady(true)

        const tick = () => {
          if (disposed) return
          frame = requestAnimationFrame(tick)
          root.rotation.y += 0.0035        // 가만히 두면 천천히 돈다
          controls!.update()
          renderer!.render(scene, camera)
        }
        tick()
      }, undefined, (err) => {
        if (!disposed) onError(String((err as Error)?.message ?? err).slice(0, 80))
      })
    } catch (e) {
      onError(String((e as Error)?.message ?? e).slice(0, 100))
    }

    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      controls?.dispose()
      renderer?.dispose()
      renderer?.domElement.parentElement?.removeChild(renderer.domElement)
    }
  }, [url, height, light, onError])

  return (
    <>
      <div ref={host} className="mv-canvas" />
      {!ready && <div className="mv-state">{t('Loading the model')}</div>}
      {ready && <div className="mv-hint">{t('Drag to turn · scroll to zoom')}</div>}
    </>
  )
}

export function ModelViewer({ url, poster, height = 200, light }: {
  url: string
  poster?: string
  height?: number
  light?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [err, setErr] = useState('')

  return (
    <div className="mv" style={{ height }}>
      {open && !err
        ? <Stage url={url} height={height} light={light} onError={setErr} />
        : (
          <button className="mv-open" onPointerDown={e => e.stopPropagation()} onClick={() => { setErr(''); setOpen(true) }}>
            {poster && <img src={poster} alt="" />}
            <span className="mv-cta">{err ? `${t('Could not load the model')} · ${err}` : t('Open 3D')}</span>
          </button>
        )}
    </div>
  )
}
