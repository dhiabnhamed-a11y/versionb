export function isValidProjectId(id: unknown) {
  return typeof id === 'string' && id.length >= 8 && id.length <= 128 && /^[a-zA-Z0-9_-]+$/.test(id)
}
