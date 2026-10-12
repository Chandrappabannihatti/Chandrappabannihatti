import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveBackAction } from './backNavigation.js'

test('uses the in-app history when the browser history index is deep enough', () => {
  assert.deepEqual(resolveBackAction({ historyIndex: 2, minHistoryIndex: 2, fallbackPath: '/admin/subjects' }), {
    type: 'history',
    delta: -1,
  })
})

test('uses the fallback for a direct admin page load', () => {
  assert.deepEqual(resolveBackAction({ historyIndex: 0, minHistoryIndex: 1, fallbackPath: '/admin/subjects' }), {
    type: 'fallback',
    path: '/admin/subjects',
    replace: true,
  })
})

test('uses the fallback when BrowserRouter has no history index', () => {
  assert.deepEqual(resolveBackAction({ fallbackPath: '/' }), {
    type: 'fallback',
    path: '/',
    replace: true,
  })
})
