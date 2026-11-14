import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import {
  Compass,
  Maximize2,
  Pause,
  Play,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import type { WaypointPanorama } from '../types/eva'

interface Panorama360ViewerProps {
  panorama: WaypointPanorama
  title: string
  className?: string
  showExpand?: boolean
  onExpand?: () => void
}

const VERTEX_SHADER_SRC = `
  attribute vec2 a_pos;
  varying vec2 v_ndc;
  void main() {
    v_ndc = a_pos;
    gl_Position = vec4(a_pos, 0.0, 1.0);
  }
`

const FRAGMENT_SHADER_SRC = `
  precision highp float;
  varying vec2 v_ndc;
  uniform sampler2D u_tex;
  uniform float u_yaw;
  uniform float u_pitch;
  uniform float u_tanHalfH;
  uniform float u_aspect;
  uniform float u_haov;
  uniform float u_vaov;
  uniform float u_manualWrap;

  void main() {
    vec3 localRay = vec3(
      v_ndc.x * u_tanHalfH,
      v_ndc.y * (u_tanHalfH / u_aspect),
      1.0
    );

    float cp = cos(u_pitch);
    float sp = sin(u_pitch);
    vec3 pRay = vec3(
      localRay.x,
      localRay.y * cp + localRay.z * sp,
      -localRay.y * sp + localRay.z * cp
    );

    float cy = cos(u_yaw);
    float sy = sin(u_yaw);
    vec3 wRay = vec3(
      pRay.x * cy + pRay.z * sy,
      pRay.y,
      -pRay.x * sy + pRay.z * cy
    );

    float az = atan(wRay.x, wRay.z);
    float elev = atan(wRay.y, length(wRay.xz));
    float u = 0.5 + (az / u_haov);
    float v = 0.5 + (elev / u_vaov);

    if (v < 0.0 || v > 1.0) {
      gl_FragColor = vec4(0.035, 0.051, 0.086, 1.0);
      return;
    }

    if (u_manualWrap > 0.5) {
      u = fract(u);
    }
    gl_FragColor = texture2D(u_tex, vec2(u, v));
  }
`

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180
}

function clamp(val: number, min: number, max: number): number {
  return val < min ? min : val > max ? max : val
}

function normalizeCompassDeg(yawRad: number): number {
  const deg = (yawRad * 180) / Math.PI
  return Math.round(((deg % 360) + 360) % 360)
}

function headingLabel(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  return dirs[Math.round(deg / 45) % 8]
}

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
): WebGLShader | null {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader)
    return null
  }
  return shader
}

/** Draw image downscaled to fit WebGL MAX_TEXTURE_SIZE if needed on constrained GPUs. */
function fitImageToMaxTexture(
  img: HTMLImageElement,
  maxTex: number,
): HTMLImageElement | HTMLCanvasElement {
  if (img.naturalWidth <= maxTex && img.naturalHeight <= maxTex) {
    return img
  }
  const scale = Math.min(maxTex / img.naturalWidth, maxTex / img.naturalHeight)
  const off = document.createElement('canvas')
  off.width = Math.max(1, Math.floor(img.naturalWidth * scale))
  off.height = Math.max(1, Math.floor(img.naturalHeight * scale))
  const ctx = off.getContext('2d')
  if (ctx) {
    ctx.drawImage(img, 0, 0, off.width, off.height)
    return off
  }
  return img
}

export function Panorama360Viewer({
  panorama,
  title,
  className = 'h-44 w-full',
  showExpand = true,
  onExpand,
}: Panorama360ViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [autoRotate, setAutoRotate] = useState(true)
  const [compassDeg, setCompassDeg] = useState(() =>
    normalizeCompassDeg(degToRad(panorama.initialYawDeg ?? 0)),
  )

  const cameraRef = useRef({
    yaw: degToRad(panorama.initialYawDeg ?? 0),
    pitch: degToRad(panorama.initialPitchDeg ?? 0),
    hfovDeg: 70,
    dragging: false,
    lastX: 0,
    lastY: 0,
  })
  const autoRotateRef = useRef(autoRotate)

  useEffect(() => {
    autoRotateRef.current = autoRotate
  }, [autoRotate])

  // Prevent pointer drags & wheel zoom inside Leaflet Popups from bubbling to the map
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    L.DomEvent.disableClickPropagation(el)
    L.DomEvent.disableScrollPropagation(el)
  }, [])

  // Initialize WebGL cylindrical panorama renderer + ResizeObserver + animation loop
  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return

    const gl2 = canvas.getContext('webgl2', {
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    })
    const isWebGL2 = Boolean(gl2)
    const gl: WebGLRenderingContext | null =
      gl2 ??
      canvas.getContext('webgl', {
        antialias: true,
        alpha: false,
      })

    if (!gl) {
      return
    }

    const vShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SRC)
    const fShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SRC)
    if (!vShader || !fShader) return

    const program = gl.createProgram()
    if (!program) return
    gl.attachShader(program, vShader)
    gl.attachShader(program, fShader)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program)
      return
    }
    gl.useProgram(program)

    const quadBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    )
    const aPos = gl.getAttribLocation(program, 'a_pos')
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

    const uTex = gl.getUniformLocation(program, 'u_tex')
    const uYaw = gl.getUniformLocation(program, 'u_yaw')
    const uPitch = gl.getUniformLocation(program, 'u_pitch')
    const uTanHalfH = gl.getUniformLocation(program, 'u_tanHalfH')
    const uAspect = gl.getUniformLocation(program, 'u_aspect')
    const uHaov = gl.getUniformLocation(program, 'u_haov')
    const uVaov = gl.getUniformLocation(program, 'u_vaov')
    const uManualWrap = gl.getUniformLocation(program, 'u_manualWrap')

    const texture = gl.createTexture()
    let texReady = false
    let disposed = false
    let rafId = 0
    let lastTs = performance.now()
    let lastCompassUi = -1

    const syncCanvasSize = () => {
      const rect = container.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = Math.max(1, Math.round(rect.width * dpr))
      const h = Math.max(1, Math.round(rect.height * dpr))
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
        gl.viewport(0, 0, w, h)
      }
    }

    syncCanvasSize()
    const resizeObserver = new ResizeObserver(syncCanvasSize)
    resizeObserver.observe(container)

    const img = new Image()
    img.onload = () => {
      if (disposed) return
      const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number
      const source = fitImageToMaxTexture(img, maxTex)

      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1)
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGB,
        gl.RGB,
        gl.UNSIGNED_BYTE,
        source,
      )
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      // WebGL1 disallows gl.REPEAT on NPOT dimensions; shader handles fract(u) fallback there
      gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_WRAP_S,
        isWebGL2 ? gl.REPEAT : gl.CLAMP_TO_EDGE,
      )
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

      texReady = true
      setStatus('ready')
    }
    img.onerror = () => {
      if (!disposed) setStatus('error')
    }
    img.src = panorama.url

    const vaovRad = degToRad(panorama.verticalFovDeg)
    const haovRad = degToRad(panorama.horizontalFovDeg ?? 360)

    const renderFrame = (now: number) => {
      if (disposed) return
      const dt = Math.min(0.05, (now - lastTs) / 1000)
      lastTs = now

      const cam = cameraRef.current
      if (autoRotateRef.current && !cam.dragging && texReady) {
        cam.yaw += dt * 0.08
      }

      const aspect = Math.max(0.5, canvas.width / Math.max(1, canvas.height))
      const maxHfovForAspect =
        (2 *
          Math.atan(Math.tan(vaovRad * 0.48) * aspect) *
          180) /
        Math.PI
      const effectiveMaxHfov = clamp(maxHfovForAspect, 42, 92)
      cam.hfovDeg = clamp(cam.hfovDeg, 24, effectiveMaxHfov)

      const hfovRad = degToRad(cam.hfovDeg)
      const tanHalfH = Math.tan(hfovRad * 0.5)
      const vfovHalfRad = Math.atan(tanHalfH / aspect)
      const maxPitchRad = Math.max(0.04, vaovRad * 0.47 - vfovHalfRad)
      cam.pitch = clamp(cam.pitch, -maxPitchRad, maxPitchRad)

      const heading = normalizeCompassDeg(cam.yaw)
      if (heading !== lastCompassUi) {
        lastCompassUi = heading
        setCompassDeg(heading)
      }

      gl.clearColor(0.035, 0.051, 0.086, 1)
      gl.clear(gl.COLOR_BUFFER_BIT)

      if (texReady) {
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, texture)
        gl.uniform1i(uTex, 0)
        gl.uniform1f(uYaw, cam.yaw)
        gl.uniform1f(uPitch, cam.pitch)
        gl.uniform1f(uTanHalfH, tanHalfH)
        gl.uniform1f(uAspect, aspect)
        gl.uniform1f(uHaov, haovRad)
        gl.uniform1f(uVaov, vaovRad)
        gl.uniform1f(uManualWrap, isWebGL2 ? 0.0 : 1.0)
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      }

      rafId = window.requestAnimationFrame(renderFrame)
    }

    rafId = window.requestAnimationFrame(renderFrame)

    return () => {
      disposed = true
      window.cancelAnimationFrame(rafId)
      resizeObserver.disconnect()
      gl.deleteTexture(texture)
      gl.deleteBuffer(quadBuffer)
      gl.deleteProgram(program)
      gl.deleteShader(vShader)
      gl.deleteShader(fShader)
    }
  }, [panorama.horizontalFovDeg, panorama.url, panorama.verticalFovDeg])

  const adjustZoom = (deltaFov: number) => {
    cameraRef.current.hfovDeg = clamp(
      cameraRef.current.hfovDeg + deltaFov,
      24,
      92,
    )
  }

  const resetView = () => {
    cameraRef.current.yaw = degToRad(panorama.initialYawDeg ?? 0)
    cameraRef.current.pitch = degToRad(panorama.initialPitchDeg ?? 0)
    cameraRef.current.hfovDeg = 70
  }

  return (
    <div
      ref={containerRef}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => {
        e.stopPropagation()
        if (e.button !== 0) return
        setAutoRotate(false)
        cameraRef.current.dragging = true
        cameraRef.current.lastX = e.clientX
        cameraRef.current.lastY = e.clientY
        e.currentTarget.setPointerCapture(e.pointerId)
      }}
      onPointerMove={(e) => {
        const cam = cameraRef.current
        if (!cam.dragging) return
        e.stopPropagation()
        const dx = e.clientX - cam.lastX
        const dy = e.clientY - cam.lastY
        cam.lastX = e.clientX
        cam.lastY = e.clientY
        const rect = containerRef.current?.getBoundingClientRect()
        const pxScale = rect ? rect.width : 320
        const radPerPx = degToRad(cam.hfovDeg) / Math.max(160, pxScale)
        cam.yaw -= dx * radPerPx * 1.15
        cam.pitch += dy * radPerPx * 1.15
      }}
      onPointerUp={(e) => {
        cameraRef.current.dragging = false
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId)
        }
      }}
      onPointerCancel={() => {
        cameraRef.current.dragging = false
      }}
      onWheel={(e) => {
        e.stopPropagation()
        adjustZoom(e.deltaY > 0 ? 6 : -6)
      }}
      className={`group relative cursor-grab select-none overflow-hidden rounded-lg border border-cyan-500/35 bg-slate-950 active:cursor-grabbing ${className}`}
    >
      <canvas ref={canvasRef} className="block h-full w-full" />

      {status === 'loading' && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-slate-950/90 font-mono text-[10px] text-cyan-200">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-400/30 border-t-cyan-400" />
          <span>LOADING 360° MOSAIC...</span>
        </div>
      )}

      {status === 'error' && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-950/95 px-3 text-center font-mono text-[10px] text-slate-400">
          360° Panorama failed to load ({panorama.url})
        </div>
      )}

      {/* Top HUD Overlay: 360 Badge + Controls */}
      <div className="pointer-events-none absolute inset-x-2 top-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 rounded-full border border-cyan-400/45 bg-[#090d16]/85 px-2 py-0.5 font-mono text-[9px] font-bold tracking-wider text-cyan-200 backdrop-blur-md">
          <Compass className="h-3 w-3 text-cyan-400" />
          <span>360°</span>
          <span className="text-slate-400">|</span>
          <span>
            {String(compassDeg).padStart(3, '0')}° {headingLabel(compassDeg)}
          </span>
        </div>

        <div
          className="pointer-events-auto flex items-center gap-1"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => setAutoRotate((v) => !v)}
            title={autoRotate ? 'Pause 360° Spin' : 'Resume 360° Spin'}
            aria-label={autoRotate ? 'Pause 360° Spin' : 'Resume 360° Spin'}
            className="flex h-6 w-6 items-center justify-center rounded border border-slate-700/80 bg-[#090d16]/85 text-slate-200 backdrop-blur-md transition hover:border-cyan-400/60 hover:text-cyan-200"
          >
            {autoRotate ? (
              <Pause className="h-3 w-3" />
            ) : (
              <Play className="h-3 w-3" />
            )}
          </button>
          <button
            type="button"
            onClick={() => adjustZoom(-10)}
            title="Zoom In"
            aria-label="Zoom In"
            className="flex h-6 w-6 items-center justify-center rounded border border-slate-700/80 bg-[#090d16]/85 text-slate-200 backdrop-blur-md transition hover:border-cyan-400/60 hover:text-cyan-200"
          >
            <ZoomIn className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => adjustZoom(10)}
            title="Zoom Out"
            aria-label="Zoom Out"
            className="flex h-6 w-6 items-center justify-center rounded border border-slate-700/80 bg-[#090d16]/85 text-slate-200 backdrop-blur-md transition hover:border-cyan-400/60 hover:text-cyan-200"
          >
            <ZoomOut className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={resetView}
            title="Reset 360° Camera"
            aria-label="Reset 360° Camera"
            className="flex h-6 w-6 items-center justify-center rounded border border-slate-700/80 bg-[#090d16]/85 text-slate-200 backdrop-blur-md transition hover:border-cyan-400/60 hover:text-cyan-200"
          >
            <RotateCcw className="h-3 w-3" />
          </button>
          {showExpand && onExpand && (
            <button
              type="button"
              onClick={onExpand}
              title="Open Fullscreen 360° View"
              aria-label="Open Fullscreen 360° View"
              className="flex h-6 items-center gap-1 rounded border border-cyan-400/50 bg-cyan-500/20 px-1.5 font-mono text-[9px] font-bold text-cyan-100 backdrop-blur-md transition hover:bg-cyan-500/35"
            >
              <Maximize2 className="h-2.5 w-2.5" />
              <span>360°</span>
            </button>
          )}
        </div>
      </div>

      {/* Bottom Caption & Drag Hint */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-[#090d16]/95 via-[#090d16]/55 to-transparent px-2.5 py-1.5 font-mono text-[9px] text-slate-200">
        <span className="truncate">{title}</span>
        <span className="shrink-0 text-cyan-300/90">DRAG TO LOOK</span>
      </div>
    </div>
  )
}
