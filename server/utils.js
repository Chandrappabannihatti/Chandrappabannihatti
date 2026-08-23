export const validDepartments = ['CSE', 'AIML', 'CSDS', 'ECE', 'EEE', 'ME', 'CIVIL']
export const validSemesters = [1, 2, 3, 4, 5, 6, 7, 8]

export function cleanString(value) {
  return String(value ?? '').trim()
}

export function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanString(value))
}

export function isPhone(value) {
  return /^\+?[0-9 ()-]{10,18}$/.test(cleanString(value))
}

export function riskFromFeatures({ attendance = 0, cgpa = 0, backlogs = 0 }) {
  if (Number(attendance) < 70 || Number(cgpa) < 6.5 || Number(backlogs) >= 3) return 'High'
  if (Number(attendance) < 78 || Number(cgpa) < 7.2 || Number(backlogs) > 0) return 'Medium'
  return 'Low'
}

export function passProbability({ attendance = 0, ia1 = 0, ia2 = 0, assignmentMarks = 0, previousSgpa = 0, cgpa = 0, backlogs = 0 }) {
  const score = Number(attendance) * 0.38 + ((Number(ia1) + Number(ia2)) / 2) * 0.25 + Number(assignmentMarks) * 0.12 + Number(previousSgpa) * 4 + Number(cgpa) * 3 - Number(backlogs) * 8
  return Math.max(24, Math.min(99, Math.round(score)))
}

export function validateStudent(input, existing = []) {
  const errors = []
  const usn = cleanString(input.usn).toUpperCase()
  const name = cleanString(input.name)
  const department = cleanString(input.department).toUpperCase()
  const semester = Number(input.semester)
  const email = cleanString(input.email).toLowerCase()
  const phone = cleanString(input.phone)
  if (!usn) errors.push('USN is required.')
  if (!name) errors.push('Name is required.')
  if (!validDepartments.includes(department)) errors.push('Department must be one of CSE, AIML, CSDS, ECE, EEE, ME or CIVIL.')
  if (!validSemesters.includes(semester)) errors.push('Semester must be between 1 and 8.')
  if (!isEmail(email)) errors.push('A valid email is required.')
  if (phone && !isPhone(phone)) errors.push('Phone number is invalid.')
  if (existing.some((student) => String(student.usn).toUpperCase() === usn && String(student.id) !== String(input.id))) errors.push('USN already exists.')
  return errors
}
