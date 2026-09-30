export const validDepartments = ['CSE', 'AIML', 'CSDS', 'CE', 'ECE', 'EEE', 'ME', 'CIVIL']
export const validSemesters = [1, 2, 3, 4, 5, 6, 7, 8]
export const validAchievementTypes = ['Academic', 'Hackathon', 'Certification', 'Sports', 'Cultural', 'Leadership', 'Community service']

export const academicAttributeRules = [
  { key: 'attendancePercentage', min: 0, max: 100 },
  { key: 'averageInternalMarks', min: 0, max: 100 },
  { key: 'averageAssignmentScore', min: 0, max: 100 },
  { key: 'previousGpa', min: 0, max: 10 },
  { key: 'currentGpa', min: 0, max: 10 },
  { key: 'participationScore', min: 0, max: 100 },
]

export const predictionAttributeKeys = ['attendancePercentage', 'averageInternalMarks', 'averageAssignmentScore', 'previousGpa', 'participationScore']

export function cleanString(value) {
  return String(value ?? '').trim()
}

export function numeric(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

export function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanString(value))
}

export function isPhone(value) {
  return /^\+?[0-9 ()-]{10,18}$/.test(cleanString(value))
}

function firstValue(input, keys, fallback = 0) {
  for (const key of keys) if (input[key] !== undefined && input[key] !== null && input[key] !== '') return input[key]
  return fallback
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, numeric(value)))
}

export function academicFields(input = {}) {
  return {
    attendancePercentage: clamp(firstValue(input, ['attendancePercentage', 'attendance_percentage', 'attendance']), 0, 100),
    averageInternalMarks: clamp(firstValue(input, ['averageInternalMarks', 'average_internal_marks']), 0, 100),
    averageAssignmentScore: clamp(firstValue(input, ['averageAssignmentScore', 'average_assignment_score']), 0, 100),
    previousGpa: clamp(firstValue(input, ['previousGpa', 'previous_gpa']), 0, 10),
    currentGpa: clamp(firstValue(input, ['currentGpa', 'current_gpa']), 0, 10),
    participationScore: clamp(firstValue(input, ['participationScore', 'participation_score']), 0, 100),
  }
}

export function predictionFields(input = {}) {
  const fields = academicFields(input)
  return Object.fromEntries(predictionAttributeKeys.map((key) => [key, fields[key]]))
}

export function predictAcademic(input = {}) {
  const fields = predictionFields(input)
  const score = fields.attendancePercentage * 0.3
    + fields.averageInternalMarks * 0.25
    + fields.averageAssignmentScore * 0.15
    + (fields.previousGpa / 10) * 15
    + fields.participationScore * 0.15
  const result = score >= 60 ? 'Pass' : 'Fail'
  const risk = score >= 75 ? 'Low Risk' : score >= 55 ? 'Medium Risk' : 'High Risk'
  return { result, risk, score: Number(score.toFixed(2)) }
}

export function normalizeRisk(value) {
  const text = cleanString(value).toLowerCase()
  if (text.includes('high')) return 'High Risk'
  if (text.includes('medium')) return 'Medium Risk'
  if (text.includes('low')) return 'Low Risk'
  return ''
}

export function validateAcademicFields(input = {}) {
  const source = input || {}
  return academicAttributeRules.flatMap(({ key, min, max }) => {
    const snakeKey = key.replace(/[A-Z]/g, (character) => `_${character.toLowerCase()}`)
    const aliases = key === 'attendancePercentage' ? [key, snakeKey, 'attendance'] : [key, snakeKey]
    const raw = firstValue(source, aliases, null)
    if (raw === '' || raw === undefined || raw === null || !Number.isFinite(Number(raw))) return [`${key} must be numeric.`]
    return Number(raw) < min || Number(raw) > max ? [`${key} must be between ${min} and ${max}.`] : []
  })
}

export function validateAchievement(input) {
  const errors = []
  const studentId = Number(input.studentId)
  const achievementType = cleanString(input.achievementType || input.type)
  const date = cleanString(input.date || input.achievementDate)
  const title = cleanString(input.title)
  const description = cleanString(input.description)
  if (!Number.isInteger(studentId) || studentId <= 0) errors.push('A student is required.')
  if (!validAchievementTypes.includes(achievementType)) errors.push('Choose a valid achievement type.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) errors.push('A valid achievement date is required.')
  if (!title) errors.push('Achievement title is required.')
  if (title.length > 180) errors.push('Achievement title must be 180 characters or fewer.')
  if (!description) errors.push('Achievement description is required.')
  if (description.length > 4000) errors.push('Achievement description must be 4000 characters or fewer.')
  return errors
}

export function validateSubject(input, existing = []) {
  const errors = []
  const department = cleanString(input.department).toUpperCase()
  const semester = Number(input.semester)
  const subjectCode = cleanString(input.subjectCode || input.subject_code).toUpperCase()
  const subjectName = cleanString(input.subjectName || input.subject_name)
  const credits = Number(input.credits)
  if (!validDepartments.includes(department)) errors.push('Department must be one of CSE, AIML, CSDS, CE, ECE, EEE, ME or CIVIL.')
  if (!validSemesters.includes(semester)) errors.push('Semester must be between 1 and 8.')
  if (!/^[A-Z0-9][A-Z0-9 -]{1,29}$/.test(subjectCode)) errors.push('Subject code must be 2–30 letters, numbers or spaces.')
  if (!subjectName) errors.push('Subject name is required.')
  if (subjectName.length > 160) errors.push('Subject name must be 160 characters or fewer.')
  if (!Number.isFinite(credits) || credits <= 0 || credits > 30) errors.push('Credits must be greater than 0 and no more than 30.')
  if (existing.some((subject) => String(subject.department).toUpperCase() === department && Number(subject.semester) === semester && String(subject.subjectCode).toUpperCase() === subjectCode && String(subject.id || subject.subjectId) !== String(input.id || input.subjectId))) errors.push('That subject code already exists for this department and semester.')
  return errors
}

export function validateStudent(input, existing = []) {
  const errors = []
  const usn = cleanString(input.usn).toUpperCase()
  const name = cleanString(input.name)
  const department = cleanString(input.department).toUpperCase()
  const semester = Number(input.semester)
  const section = cleanString(input.section || 'A').toUpperCase()
  const email = cleanString(input.email).toLowerCase()
  const phone = cleanString(input.phone)
  if (!usn) errors.push('USN is required.')
  if (!name) errors.push('Name is required.')
  if (!validDepartments.includes(department)) errors.push('Department must be one of CSE, AIML, CSDS, CE, ECE, EEE, ME or CIVIL.')
  if (!validSemesters.includes(semester)) errors.push('Semester must be between 1 and 8.')
  if (!/^[A-Z0-9][A-Z0-9 -]{0,9}$/.test(section)) errors.push('Section must be a valid section name.')
  if (!isEmail(email)) errors.push('A valid email is required.')
  if (phone && !isPhone(phone)) errors.push('Phone number is invalid.')
  if (existing.some((student) => String(student.usn).toUpperCase() === usn && String(student.id) !== String(input.id))) errors.push('USN already exists.')
  errors.push(...validateAcademicFields(input))
  return errors
}
