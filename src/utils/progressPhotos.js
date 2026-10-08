export function filterProgressPhotos(photos, filters) {
  const search = filters.search.trim().toLocaleLowerCase('es')
  return photos.filter(photo => {
    const haystack = `${photo.title} ${photo.notes} ${photo.rooms?.name || ''}`.toLocaleLowerCase('es')
    return (!search || haystack.includes(search))
      && (!filters.phase || photo.phase === filters.phase)
      && (!filters.room_id || photo.room_id === filters.room_id)
  })
}

export function storageObjectPath(url) {
  try {
    const parsed = new URL(url)
    const marker = '/storage/v1/object/public/images/'
    const index = parsed.pathname.indexOf(marker)
    return index === -1 ? null : decodeURIComponent(parsed.pathname.slice(index + marker.length))
  } catch { return null }
}
