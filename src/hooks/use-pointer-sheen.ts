import * as React from "react"

/**
 * Makes a metal surface's highlight track the cursor. On pointer move it writes
 * the cursor position (as % of the element box) into `--sheen-x` / `--sheen-y`
 * and the angle from the element's center into `--sheen-angle`; the `.metallic`
 * and `.spun-metal` classes read those to move their specular highlight. Values
 * are written straight to the node inside a `requestAnimationFrame` — no React
 * state, so hovering never re-renders. On leave the vars are cleared so the CSS
 * fallback (a centered highlight) transitions back in.
 *
 * It also emits `--sheen-tilt-x` / `--sheen-tilt-y` (degrees) for an optional
 * parallax tilt — the `.metal-tilt` class turns those into a 3D lean toward the
 * cursor (and only under `prefers-reduced-motion: no-preference`).
 *
 * Spread the returned props onto the element you want to react:
 *   const sheen = usePointerSheen<HTMLDivElement>()
 *   <div className="spun-metal spun-gold" {...sheen} />
 *
 * Pass a forwarded ref as `externalRef` to keep it working (e.g. inside Button).
 */
/** Peak parallax lean, in degrees, at the element's edges. */
const MAX_TILT_DEG = 6

export function usePointerSheen<T extends HTMLElement = HTMLElement>(
  externalRef?: React.Ref<T>
) {
  const innerRef = React.useRef<T | null>(null)
  const frame = React.useRef<number | null>(null)

  const setRef = React.useCallback(
    (node: T | null) => {
      innerRef.current = node
      if (typeof externalRef === "function") externalRef(node)
      else if (externalRef) {
        ;(externalRef as React.MutableRefObject<T | null>).current = node
      }
    },
    [externalRef]
  )

  const onPointerMove = React.useCallback((event: React.PointerEvent<T>) => {
    const el = innerRef.current
    if (!el) return
    const { clientX, clientY } = event
    if (frame.current != null) return
    frame.current = requestAnimationFrame(() => {
      frame.current = null
      const rect = el.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      const x = ((clientX - rect.left) / rect.width) * 100
      const y = ((clientY - rect.top) / rect.height) * 100
      // Offset from center, normalized to -1..1 at the edges.
      const nx = (clientX - (rect.left + rect.width / 2)) / (rect.width / 2)
      const ny = (clientY - (rect.top + rect.height / 2)) / (rect.height / 2)
      const angle = Math.atan2(ny, nx) * (180 / Math.PI)
      el.style.setProperty("--sheen-x", `${x}%`)
      el.style.setProperty("--sheen-y", `${y}%`)
      el.style.setProperty("--sheen-angle", `${angle}deg`)
      // Lean toward the cursor: cursor high (ny<0) tips the top back.
      el.style.setProperty("--sheen-tilt-x", `${-ny * MAX_TILT_DEG}deg`)
      el.style.setProperty("--sheen-tilt-y", `${nx * MAX_TILT_DEG}deg`)
      el.dataset.sheen = "active"
    })
  }, [])

  const onPointerLeave = React.useCallback(() => {
    const el = innerRef.current
    if (frame.current != null) {
      cancelAnimationFrame(frame.current)
      frame.current = null
    }
    if (!el) return
    el.style.removeProperty("--sheen-x")
    el.style.removeProperty("--sheen-y")
    el.style.removeProperty("--sheen-angle")
    el.style.removeProperty("--sheen-tilt-x")
    el.style.removeProperty("--sheen-tilt-y")
    delete el.dataset.sheen
  }, [])

  React.useEffect(() => {
    return () => {
      if (frame.current != null) cancelAnimationFrame(frame.current)
    }
  }, [])

  return { ref: setRef, onPointerMove, onPointerLeave }
}
