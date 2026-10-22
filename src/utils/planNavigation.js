// All positions use the baseline SVG matrix, so panning and zoom remain stable
// even while the viewBox changes or the canvas has letterboxing.
export function gestureView(view, start, current, scale = 1) {
  const width = Math.max(3, Math.min(120, view.width / Math.max(0.01, scale)))
  const ratio = width / view.width
  return { x: start.x - (current.x - view.x) * ratio, y: start.y - (current.y - view.y) * ratio, width, height: view.height * ratio }
}
export const zoomView = (view, factor, anchor = { x: view.x + view.width / 2, y: view.y + view.height / 2 }) => gestureView(view, anchor, anchor, 1 / factor)
export function touchPair(points) {
  const [a, b] = [...points.values()]
  return { center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, distance: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)) }
}
