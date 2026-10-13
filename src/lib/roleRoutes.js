const dashboardPaths = Object.freeze({
  admin: '/app',
  teacher: '/teacher/semesters',
  student: '/app',
  parent: '/app',
})

export function dashboardPathForRole(role) {
  return dashboardPaths[String(role || '').toLowerCase()] || '/'
}

export function canAccessDashboardRole(role) {
  return Object.prototype.hasOwnProperty.call(dashboardPaths, String(role || '').toLowerCase())
}
