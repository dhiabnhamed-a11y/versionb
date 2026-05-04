export function getPrismaErrorCode(error: unknown) {
  if (typeof error === 'object' && error && 'code' in error && typeof error.code === 'string') {
    return error.code
  }

  return null
}

export function isMissingDatabaseObjectError(error: unknown) {
  const code = getPrismaErrorCode(error)
  if (code === 'P2021' || code === 'P2022') return true

  const message = error instanceof Error ? error.message : String(error)
  return /relation .* does not exist|column .* does not exist|table .* does not exist/i.test(message)
}
