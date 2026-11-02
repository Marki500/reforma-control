export function memberName(member, fallback = 'Miembro') {
  for (const value of [member?.display_name, member?.full_name, member?.name, member?.email]) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return fallback
}
