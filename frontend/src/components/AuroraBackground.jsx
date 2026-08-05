
import { useEffect, useRef } from 'react'

export default function AuroraBackground({ className = '' }) {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    if (!gl) return

    let animFrame
    let resizeObserver

    const resize = () => {
      canvas.width = container.clientWidth
      canvas.height = container.clientHeight
      gl.viewport(0, 0, canvas.width, canvas.height)
    }

    resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(container)
    resize()

    const vsSource = `
      attribute vec2 aPos;
      void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }
    `
    const fsSource = `
      precision highp float;
      uniform vec2 uRes;
      uniform float uTime;

      float band(vec2 uv, float offset, float freq, float speed){
        float y = 0.5 + offset
          + 0.10 * sin(uv.x * freq + uTime * speed)
          + 0.05 * sin(uv.x * freq * 2.3 - uTime * speed * 1.4);
        float d = abs(uv.y - y);
        return smoothstep(0.16, 0.0, d);
      }

      void main(){
        vec2 uv = gl_FragCoord.xy / uRes.xy;
        // Deep navy palette tuned to match the login card surfaces (#1b2334 / #111726)
        vec3 deep  = vec3(0.030, 0.042, 0.078);
        vec3 mid   = vec3(0.055, 0.078, 0.135);
        vec3 bandA = vec3(0.105, 0.145, 0.250);
        vec3 bandB = vec3(0.160, 0.210, 0.330);
        vec3 col = mix(deep, mid, uv.y);

        float b1 = band(uv, -0.05, 3.1, 0.35);
        float b2 = band(uv,  0.08, 4.7, 0.28);
        float b3 = band(uv, -0.18, 2.2, 0.42);

        col += bandA * b1 * 0.12;
        col += bandB * b2 * 0.18;
        col += bandA * b3 * 0.06;

        // Darker edges focus the eye toward the cards
        float vign = smoothstep(1.0, 0.35, length(uv - vec2(0.5, 0.45)));
        col *= mix(0.55, 1.0, vign);

        gl_FragColor = vec4(col, 1.0);
      }
    `

    const compile = (type, src) => {
      const s = gl.createShader(type)
      gl.shaderSource(s, src)
      gl.compileShader(s)
      return s
    }

    const prog = gl.createProgram()
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, vsSource))
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fsSource))
    gl.linkProgram(prog)
    gl.useProgram(prog)

    const quad = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1])
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW)
    const aPos = gl.getAttribLocation(prog, 'aPos')
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

    const uRes = gl.getUniformLocation(prog, 'uRes')
    const uTime = gl.getUniformLocation(prog, 'uTime')

    const render = (t) => {
      gl.uniform2f(uRes, canvas.width, canvas.height)
      gl.uniform1f(uTime, t * 0.001)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      animFrame = requestAnimationFrame(render)
    }
    animFrame = requestAnimationFrame(render)

    // Handle context loss
    const handleContextLost = (e) => {
      e.preventDefault()
      cancelAnimationFrame(animFrame)
    }
    const handleContextRestored = () => {
      animFrame = requestAnimationFrame(render)
    }
    canvas.addEventListener('webglcontextlost', handleContextLost)
    canvas.addEventListener('webglcontextrestored', handleContextRestored)

    return () => {
      cancelAnimationFrame(animFrame)
      resizeObserver?.disconnect()
      canvas.removeEventListener('webglcontextlost', handleContextLost)
      canvas.removeEventListener('webglcontextrestored', handleContextRestored)
    }
  }, [])

  return (
    <div ref={containerRef} className={`aurora-container ${className}`} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', opacity: 0.45 }}
      />
      <div className="aurora-hatch-overlay" />
    </div>
  )
}
