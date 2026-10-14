import test from 'node:test'
import assert from 'node:assert/strict'
import { canAccessDashboardRole, dashboardPathForRole } from './roleRoutes.js'

test('maps each authenticated role to its existing dashboard route', () => {
  assert.equal(dashboardPathForRole('admin'), '/app')
  assert.equal(dashboardPathForRole('teacher'), '/teacher/semesters')
  assert.equal(dashboardPathForRole('student'), '/app')
  assert.equal(dashboardPathForRole('parent'), '/app')
})

test('normalizes role names and rejects unknown roles', () => {
  assert.equal(dashboardPathForRole('ADMIN'), '/app')
  assert.equal(canAccessDashboardRole('teacher'), true)
  assert.equal(canAccessDashboardRole('unknown'), false)
  assert.equal(dashboardPathForRole('unknown'), '/')
})
