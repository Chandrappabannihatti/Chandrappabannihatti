export function resolveBackAction({ historyIndex, minHistoryIndex = 2, fallbackPath = '/app' } = {}) {
  const canReturnToAppRoute = Number.isInteger(historyIndex) && historyIndex >= minHistoryIndex
  return canReturnToAppRoute
    ? { type: 'history', delta: -1 }
    : { type: 'fallback', path: fallbackPath, replace: true }
}
