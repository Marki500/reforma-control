export const furnitureCatalog = {
  sofa: { name: 'Sofá', width: 2.1, depth: 0.9, height: 0.85, color: '#8b967d' },
  bed: { name: 'Cama', width: 1.5, depth: 2, height: 0.55, color: '#c4b49d' },
  table: { name: 'Mesa', width: 1.4, depth: 0.8, height: 0.75, color: '#b79470' },
  wardrobe: { name: 'Armario', width: 1.8, depth: 0.6, height: 2.2, color: '#c1b6a5' },
  chair: { name: 'Silla', width: 0.45, depth: 0.5, height: 0.85, color: '#9c8876' },
}

export function furnitureCorners(item) {
  const angle = item.rotation * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle)
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => ({ x: item.x + x * item.width / 2 * c - y * item.depth / 2 * s, y: item.y + x * item.width / 2 * s + y * item.depth / 2 * c }))
}

export function validFurniture(item) {
  return item && typeof item.id === 'string' && Object.hasOwn(furnitureCatalog, item.type) && typeof item.name === 'string' && item.name.length <= 80
    && ['x', 'y'].every(key => Number.isFinite(item[key]) && Math.abs(item[key]) <= 500)
    && ['width', 'depth', 'height'].every(key => Number.isFinite(item[key]) && item[key] >= 0.1 && item[key] <= 10)
    && Number.isFinite(item.rotation) && Math.abs(item.rotation) <= 360 && (item.locked === undefined || typeof item.locked === 'boolean')
}
