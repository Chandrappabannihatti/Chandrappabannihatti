export const validDepartments = ['CSE', 'AIML', 'CSDS', 'CE', 'ECE', 'EEE', 'ME', 'CIVIL']
export const validSemesters = [1, 2, 3, 4, 5, 6, 7, 8]
export const validAchievementTypes = ['Academic', 'Hackathon', 'Certification', 'Sports', 'Cultural', 'Leadership', 'Community service']

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
  return errors
}
