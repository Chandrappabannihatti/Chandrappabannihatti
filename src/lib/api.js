import axios from 'axios'

// API-first by default. Set VITE_DEMO_MODE=true when reviewing the UI without the Node service.
export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true'

let authToken = ''

export function setAuthToken(token) {
  authToken = token || ''
}

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 5000,
  headers: { 'Content-Type': 'application/json' },
})

client.interceptors.request.use((config) => {
  try {
    const session = JSON.parse(localStorage.getItem('camps_session'))
    const token = authToken || session?.token
    if (token) config.headers.Authorization = `Bearer ${token}`
  } catch { /* ignore malformed local storage */ }
  return config
})

const unwrap = (request) => request.then((response) => response.data)

const api = {
  login: (payload) => unwrap(client.post('/auth/login', payload)),
  logout: () => unwrap(client.post('/auth/logout')),
  getSections: (params) => unwrap(client.get('/sections', { params })),
  createSection: (payload) => unwrap(client.post('/sections', payload)),
  getSubjects: (params) => unwrap(client.get('/subjects', { params })),
  createSubject: (payload) => unwrap(client.post('/subjects', payload)),
  updateSubject: (id, payload) => unwrap(client.put(`/subjects/${id}`, payload)),
  deleteSubject: (id) => unwrap(client.delete(`/subjects/${id}`)),
  getSubjectRecords: (id, params) => unwrap(client.get(`/subjects/${id}/records`, { params })),
  saveSubjectAttendance: (id, payload) => unwrap(client.put(`/subjects/${id}/attendance`, payload)),
  saveSubjectMarks: (id, payload) => unwrap(client.put(`/subjects/${id}/marks`, payload)),
  getStudents: (params) => unwrap(client.get('/students', { params })),
  createStudent: (payload) => unwrap(client.post('/students', payload)),
  updateStudent: (id, payload) => unwrap(client.put(`/students/${id}`, payload)),
  deleteStudent: (id) => unwrap(client.delete(`/students/${id}`)),
  uploadStudents: (file, commit = false, scope = {}) => {
    const form = new FormData()
    form.append('file', file)
    form.append('commit', String(commit))
    if (scope.department) form.append('department', scope.department)
    if (scope.semester) form.append('semester', String(scope.semester))
    if (scope.section) form.append('section', scope.section)
    return unwrap(client.post('/students/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } }))
  },
  exportStudents: (params) => client.get('/students/export', { params, responseType: 'blob' }),
  sendMessage: (payload) => unwrap(client.post('/messages/send', payload)),
  getMessages: (params) => unwrap(client.get('/messages', { params })),
  markMessageRead: (id) => unwrap(client.put(`/messages/${id}/read`)),
  getAnnouncements: (params) => unwrap(client.get('/announcements', { params })),
  createAnnouncement: (payload) => unwrap(client.post('/announcements', payload)),
  updateAnnouncement: (id, payload) => unwrap(client.put(`/announcements/${id}`, payload)),
  deleteAnnouncement: (id) => unwrap(client.delete(`/announcements/${id}`)),
  createRemark: (payload) => unwrap(client.post('/remarks', payload)),
  getRemarks: (params) => unwrap(client.get('/remarks', { params })),
  getAchievements: (params) => unwrap(client.get('/achievements', { params })),
  createAchievement: (payload) => unwrap(client.post('/achievements', payload)),
  predict: (payload) => unwrap(client.post('/ml/predict', payload)),
}

export default api
