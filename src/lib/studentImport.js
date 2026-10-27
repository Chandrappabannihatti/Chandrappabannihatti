import { ACADEMIC_ATTRIBUTES, academicFields, predictAcademic } from './academic.js'

export const DEFAULT_STUDENT_PASSWORD = 'Student@123'

// These are the shared spreadsheet headers used by both the Excel and CSV
// workflows. Scope is supplied by the authenticated workspace, not trusted
// from a password or spreadsheet cell.
export const STUDENT_IMPORT_COLUMNS = [
  'USN',
  'Student Name',
  'Department',
  'Semester',
  'Section',
  'Gender',
  'Email Address',
  'Initial Student Login Password',
  'Phone Number',
  'Parent/Guardian Name',
  'Parent Phone',
  'Date of Birth',
  'Blood Group',
  'Address',
  'Father/Guardian Name',
  'Mother Name',
  'Parent Email',
  'Certifications',
  'Skills',
  ...ACADEMIC_ATTRIBUTES.map(({ label }) => label),
]

const aliases = {
  usn: ['USN', 'usn'],
  name: ['Student Name', 'Name', 'name'],
  department: ['Department', 'department'],
  semester: ['Semester', 'semester'],
  section: ['Section', 'section'],
  gender: ['Gender', 'gender'],
  email: ['Email Address', 'Email', 'email'],
  phone: ['Phone Number', 'Phone', 'phone'],
  parentName: ['Parent/Guardian Name', 'Parent Name', 'parentName'],
  parentPhone: ['Parent Phone', 'parentPhone'],
  fatherName: ['Father/Guardian Name', 'Father Name', 'fatherName'],
  motherName: ['Mother Name', 'motherName'],
  parentEmail: ['Parent Email', 'parentEmail'],
  dateOfBirth: ['Date of Birth', 'dateOfBirth'],
  bloodGroup: ['Blood Group', 'bloodGroup'],
  address: ['Address', 'address'],
  certifications: ['Certifications', 'certifications'],
  skills: ['Skills', 'skills'],
  attendancePercentage: ['Attendance Percentage', 'AttendancePercentage', 'attendancePercentage'],
  averageInternalMarks: ['Average Internal Marks', 'AverageInternalMarks', 'averageInternalMarks'],
  averageAssignmentScore: ['Average Assignment Score', 'AverageAssignmentScore', 'averageAssignmentScore'],
  previousGpa: ['Previous GPA', 'PreviousGPA', 'previousGpa'],
  currentGpa: ['Current GPA', 'CurrentGPA', 'currentGpa'],
  participationScore: ['Participation Score', 'ParticipationScore', 'participationScore'],
}

export function createStudentImportTemplate(scope = {}) {
  return {
    USN: '4PM25CS101',
    'Student Name': 'Sample Student',
    Department: String(scope.department || '').toUpperCase(),
    Semester: scope.semester || '',
    Section: String(scope.section || '').toUpperCase(),
    Gender: 'Female',
    'Email Address': 'sample@pestrust.edu.in',
    'Initial Student Login Password': DEFAULT_STUDENT_PASSWORD,
    'Phone Number': '+91 98450 00000',
    'Parent/Guardian Name': 'Parent Name',
    'Parent Phone': '+91 98450 00001',
    'Date of Birth': '2004-06-15',
    'Blood Group': 'O+',
    Address: 'Residential address',
    'Father/Guardian Name': 'Parent Name',
    'Mother Name': 'Mother Name',
    'Parent Email': 'parent@example.com',
    Certifications: 'NPTEL, AWS',
    Skills: 'Python, React',
    'Attendance Percentage': 80,
    'Average Internal Marks': 75,
    'Average Assignment Score': 80,
    'Previous GPA': 7.4,
    'Current GPA': 7.5,
    'Participation Score': 78,
  }
}

export function rejectedImportRecords(rows = []) {
  return rows
    .filter((row) => row.issues?.length || ['out-of-scope', 'duplicate', 'invalid', 'failed'].includes(row.status))
    .map((row) => ({
      'Row Number': row.rowNumber,
      USN: row.usn || '',
      'Student Name': row.name || '',
      Department: row.department || '',
      Semester: row.semester || '',
      Section: row.section || '',
      Gender: row.gender || '',
      'Email Address': row.email || '',
      'Phone Number': row.phone || '',
      'Parent/Guardian Name': row.parentName || '',
      'Parent Phone': row.parentPhone || '',
      'Date of Birth': row.dateOfBirth || '',
      'Blood Group': row.bloodGroup || '',
      Address: row.address || '',
      'Father/Guardian Name': row.fatherName || '',
      'Mother Name': row.motherName || '',
      'Parent Email': row.parentEmail || '',
      Certifications: Array.isArray(row.certifications) ? row.certifications.join(', ') : row.certifications || '',
      Skills: Array.isArray(row.skills) ? row.skills.join(', ') : row.skills || '',
      'Attendance Percentage': row.attendancePercentage ?? '',
      'Average Internal Marks': row.averageInternalMarks ?? '',
      'Average Assignment Score': row.averageAssignmentScore ?? '',
      'Previous GPA': row.previousGpa ?? '',
      'Current GPA': row.currentGpa ?? '',
      'Participation Score': row.participationScore ?? '',
      Status: row.status || 'invalid',
      Issues: (row.issues || []).join(' | '),
    }))
}

export function readImportCell(row = {}, field, fallback = '') {
  const labels = aliases[field] || (Array.isArray(field) ? field : [field])
  for (const label of labels) {
    if (row[label] !== undefined && row[label] !== null && row[label] !== '') return row[label]
  }
  return fallback
}

function text(value) {
  return String(value ?? '').trim()
}

function numberValue(value) {
  const normalized = text(value)
  if (!normalized) return Number.NaN
  const result = Number(normalized)
  return Number.isFinite(result) ? result : Number.NaN
}

function emailIsValid(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text(value))
}

function phoneIsValid(value) {
  return /^\+?[0-9 ()-]{10,18}$/.test(text(value))
}

function normalizeDate(value) {
  const valueText = text(value)
  if (!valueText) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(valueText)) return valueText
  if (/^\d+(\.\d+)?$/.test(valueText)) {
    const serial = Number(valueText)
    if (serial > 0) {
      const parsed = new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000)
      if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10)
    }
  }
  const parsed = new Date(valueText)
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10)
}

function unique(items) {
  return [...new Set(items.filter(Boolean))]
}

export function normalizeImportRows(rawRows = [], scope = {}, existingStudents = []) {
  const department = text(scope.department).toUpperCase()
  const semester = Number(scope.semester) || 0
  const section = text(scope.section).toUpperCase()
  const configuredDepartments = Array.isArray(scope.departments)
    ? new Set(scope.departments.map((value) => text(value.code || value).toUpperCase()).filter(Boolean))
    : null
  const existingUsns = new Set(existingStudents.map((student) => text(student.usn).toUpperCase()).filter(Boolean))
  const existingEmails = new Set(existingStudents.map((student) => text(student.email).toLowerCase()).filter(Boolean))
  const seenUsns = new Set()
  const seenEmails = new Set()

  return rawRows.map((rawRow, index) => {
    const usn = text(readImportCell(rawRow, 'usn')).toUpperCase()
    const name = text(readImportCell(rawRow, 'name'))
    const rowDepartment = text(readImportCell(rawRow, 'department', department)).toUpperCase()
    const rowSemester = numberValue(readImportCell(rawRow, 'semester', semester))
    const rowSection = text(readImportCell(rawRow, 'section', section)).toUpperCase()
    const email = text(readImportCell(rawRow, 'email')).toLowerCase()
    const phone = text(readImportCell(rawRow, 'phone'))
    const academicRaw = Object.fromEntries(ACADEMIC_ATTRIBUTES.map(({ key }) => [key, readImportCell(rawRow, key)]))
    const academic = Object.fromEntries(Object.entries(academicRaw).map(([key, value]) => [key, numberValue(value)]))
    const scopeIssues = []
    const validationIssues = []

    if (department && rowDepartment !== department) scopeIssues.push(`Department is ${rowDepartment || 'missing'}; expected ${department}.`)
    if (semester && rowSemester !== semester) scopeIssues.push(`Semester is ${Number.isFinite(rowSemester) ? rowSemester : 'missing'}; expected ${semester}.`)
    if (section && rowSection !== section) scopeIssues.push(`Section is ${rowSection || 'missing'}; expected ${section}.`)

    if (!usn) validationIssues.push('USN is required.')
    else if (usn.length > 30) validationIssues.push('USN must be 30 characters or fewer.')
    if (!name) validationIssues.push('Name is required.')
    const departmentIsKnown = configuredDepartments ? configuredDepartments.has(rowDepartment) : Boolean(rowDepartment)
    if (!departmentIsKnown) validationIssues.push('Department is required and must be present in the active department list.')
    if (!emailIsValid(email)) validationIssues.push('A valid email is required.')
    if (!Number.isInteger(rowSemester) || rowSemester < 1 || rowSemester > 8) validationIssues.push('Semester must be an integer from 1 to 8.')
    if (!/^[A-Z0-9][A-Z0-9 -]{0,9}$/.test(rowSection)) validationIssues.push('Section must be a valid section name.')
    if (phone && !phoneIsValid(phone)) validationIssues.push('Phone number is invalid.')
    ACADEMIC_ATTRIBUTES.forEach(({ key, label, min, max }) => {
      const value = academic[key]
      if (!Number.isFinite(value)) validationIssues.push(`${label} is required and must be numeric.`)
      else if (value < min || value > max) validationIssues.push(`${label} must be between ${min} and ${max}.`)
    })

    const duplicateIssues = []
    if (usn && seenUsns.has(usn)) duplicateIssues.push('Duplicate USN in this file.')
    if (usn && existingUsns.has(usn)) duplicateIssues.push('USN already exists in the loaded roster.')
    if (email && seenEmails.has(email)) duplicateIssues.push('Duplicate email in this file.')
    if (email && existingEmails.has(email)) duplicateIssues.push('Email already exists in the loaded roster.')
    if (usn) seenUsns.add(usn)
    if (email) seenEmails.add(email)

    const allIssues = unique([...scopeIssues, ...duplicateIssues, ...validationIssues])
    const status = scopeIssues.length ? 'out-of-scope' : duplicateIssues.length ? 'duplicate' : validationIssues.length ? 'invalid' : 'ready'
    const normalizedAcademic = Object.fromEntries(Object.entries(academic).map(([key, value]) => [key, Number.isFinite(value) ? value : 0]))
    const outcome = predictAcademic(normalizedAcademic)
    const row = {
      id: `import-${Date.now()}-${index}`,
      rowNumber: index + 2,
      usn,
      name,
      department: rowDepartment,
      semester: Number.isFinite(rowSemester) ? rowSemester : '',
      section: rowSection,
      gender: text(readImportCell(rawRow, 'gender')),
      email,
      phone,
      parentName: text(readImportCell(rawRow, 'parentName')),
      parentPhone: text(readImportCell(rawRow, 'parentPhone')),
      fatherName: text(readImportCell(rawRow, 'fatherName')),
      motherName: text(readImportCell(rawRow, 'motherName')),
      parentEmail: text(readImportCell(rawRow, 'parentEmail')).toLowerCase(),
      dateOfBirth: normalizeDate(readImportCell(rawRow, 'dateOfBirth')),
      bloodGroup: text(readImportCell(rawRow, 'bloodGroup')),
      address: text(readImportCell(rawRow, 'address')),
      certifications: text(readImportCell(rawRow, 'certifications')),
      skills: text(readImportCell(rawRow, 'skills')),
      ...normalizedAcademic,
      ...outcome,
      scopeMatch: scopeIssues.length === 0,
      status,
      issues: allIssues,
      scopeIssues,
      duplicateIssues,
      validationIssues,
      ready: status === 'ready',
    }
    return row
  })
}

export function importSummary(rows = [], imported = 0) {
  const total = rows.length
  const matching = rows.filter((row) => row.scopeMatch).length
  const ready = rows.filter((row) => row.ready).length
  const outOfScope = rows.filter((row) => row.status === 'out-of-scope').length
  const duplicates = rows.filter((row) => row.status === 'duplicate').length
  const invalid = rows.filter((row) => row.status === 'invalid').length
  const failed = rows.filter((row) => row.status === 'failed').length
  const skipped = outOfScope + duplicates + invalid
  return {
    total,
    matching,
    ready,
    skipped,
    outOfScope,
    duplicates,
    invalid,
    failed,
    imported: Number(imported),
  }
}

export function importStatusLabel(status) {
  if (status === 'ready') return 'Ready'
  if (status === 'imported') return 'Imported'
  if (status === 'out-of-scope') return 'Rejected · different scope'
  if (status === 'duplicate') return 'Rejected · duplicate record'
  if (status === 'failed') return 'Failed during save'
  return 'Needs attention'
}
