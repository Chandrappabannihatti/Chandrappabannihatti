import { demoStore } from './demoStore.js'
import { query } from './db.js'
import { cleanString, normalizeRisk } from './utils.js'

const DEFAULT_COLLEGE_NAME = 'PES Institute of Technology and Management'
const DEFAULT_COLLEGE_LOCATION = 'Shivamogga, Karnataka'

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function dateOrNull(value) {
  if (!value) return null
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  const text = String(value)
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : text
}

function academicYear() {
  return cleanString(process.env.ACADEMIC_YEAR) || null
}

function mapStudent(row) {
  return {
    id: Number(row.id),
    usn: cleanString(row.usn).toUpperCase(),
    name: cleanString(row.name),
    department: cleanString(row.department || row.department_code).toUpperCase(),
    semester: Number(row.semester),
    section: cleanString(row.section || row.sectionName || 'A').toUpperCase(),
    academicYear: cleanString(row.academicYear || row.academic_year) || null,
    email: cleanString(row.email),
    dateOfBirth: dateOrNull(row.dateOfBirth || row.date_of_birth),
    gender: cleanString(row.gender),
    bloodGroup: cleanString(row.bloodGroup || row.blood_group),
    address: cleanString(row.address),
    phone: cleanString(row.phone),
    parentName: cleanString(row.parentName || row.parent_name),
    fatherName: cleanString(row.fatherName || row.father_name),
    motherName: cleanString(row.motherName || row.mother_name),
    attendancePercentage: numberOrNull(row.attendancePercentage ?? row.attendance_percentage),
    averageInternalMarks: numberOrNull(row.averageInternalMarks ?? row.average_internal_marks),
    averageAssignmentScore: numberOrNull(row.averageAssignmentScore ?? row.average_assignment_score),
    previousGpa: numberOrNull(row.previousGpa ?? row.previous_gpa),
    currentGpa: numberOrNull(row.currentGpa ?? row.current_gpa),
    participationScore: numberOrNull(row.participationScore ?? row.participation_score),
    result: row.result === 'Pass' || row.result === 'Fail' ? row.result : null,
    risk: normalizeRisk(row.risk) || null,
  }
}

function httpError(status, message) {
  const error = new Error(message)
  error.status = status
  return error
}

function normalizeScope(scope = {}) {
  return {
    department: cleanString(scope.department).toUpperCase(),
    semester: scope.semester === undefined || scope.semester === '' ? null : Number(scope.semester),
    section: cleanString(scope.section).toUpperCase(),
  }
}

function assertScope({ user, student, scope, isStudentInUserScope, requireTeacherScope = false }) {
  if (!isStudentInUserScope(student)) throw httpError(403, 'This student is outside your authorized access scope.')
  if (user.role === 'teacher') {
    if (scope.department && scope.department !== student.department) throw httpError(403, 'This report card is outside your department scope.')
    if (requireTeacherScope && (scope.semester === null || !scope.section)) throw httpError(422, 'Teacher report-card downloads require department, semester and section scope.')
    if (scope.semester !== null && scope.semester !== student.semester) throw httpError(403, 'This report card is outside your semester scope.')
    if (scope.section && scope.section !== student.section) throw httpError(403, 'This report card is outside your section scope.')
  }
  if (user.role === 'admin') {
    if (scope.department && user.department && user.department !== 'ALL' && scope.department !== user.department) throw httpError(403, 'This admin session is outside the selected department scope.')
    if (scope.semester !== null && scope.semester !== student.semester) throw httpError(403, 'This report card is outside the requested semester scope.')
    if (scope.section && scope.section !== student.section) throw httpError(403, 'This report card is outside the requested section scope.')
  }
}

async function loadDemoReportCard(studentId) {
  const student = demoStore.students.find((item) => Number(item.id) === Number(studentId))
  if (!student) return null
  const mappedStudent = mapStudent(student)
  const subjects = demoStore.subjects
    .filter((subject) => subject.isActive !== false && subject.department === mappedStudent.department && Number(subject.semester) === mappedStudent.semester)
    .sort((left, right) => String(left.subjectCode).localeCompare(String(right.subjectCode)))
    .map((subject) => {
      const record = demoStore.subjectRecords.find((item) => Number(item.subjectId) === Number(subject.id || subject.subjectId) && Number(item.studentId) === mappedStudent.id)
      return {
        subjectCode: subject.subjectCode,
        subjectName: subject.subjectName,
        credits: numberOrNull(subject.credits),
        attendancePercentage: numberOrNull(record?.attendancePercentage),
        averageInternalMarks: numberOrNull(record?.averageInternalMarks),
        assignmentScore: null,
      }
    })
  const achievements = demoStore.achievements
    .filter((item) => Number(item.studentId) === mappedStudent.id)
    .sort((left, right) => String(right.date || '').localeCompare(String(left.date || '')))
    .map((item) => ({
      date: dateOrNull(item.date),
      achievementType: cleanString(item.achievementType),
      title: cleanString(item.title),
      description: cleanString(item.description),
    }))
  const remarks = demoStore.remarks
    .filter((item) => Number(item.studentId) === mappedStudent.id)
    .sort((left, right) => String(right.date || '').localeCompare(String(left.date || '')))
    .map((item) => ({ date: dateOrNull(item.date), label: cleanString(item.label), note: cleanString(item.note), author: cleanString(item.author) }))
  return { student: mappedStudent, subjects, achievements, remarks, prediction: { result: mappedStudent.result, risk: mappedStudent.risk, modelVersion: null } }
}

async function loadDatabaseReportCard(studentId) {
  const studentRows = await query(`SELECT s.id, s.usn, s.name, s.department_code AS department, s.semester,
      COALESCE(sec.section_name, s.section) AS section, s.email, s.date_of_birth AS dateOfBirth,
      s.gender, s.blood_group AS bloodGroup, s.address, s.phone, s.parent_name AS parentName,
      s.father_name AS fatherName, s.mother_name AS motherName, s.attendance_percentage AS attendancePercentage,
      s.average_internal_marks AS averageInternalMarks, s.average_assignment_score AS averageAssignmentScore,
      s.previous_gpa AS previousGpa, s.current_gpa AS currentGpa, s.participation_score AS participationScore,
      s.result, s.risk
    FROM students s
    LEFT JOIN sections sec ON sec.section_id = s.section_id
    WHERE s.id=:studentId AND s.is_active=1 LIMIT 1`, { studentId })
  if (!studentRows[0]) return null
  const student = mapStudent(studentRows[0])
  const [subjectRows, assignmentRows, achievementRows, remarkRows, predictionRows] = await Promise.all([
    query(`SELECT sub.subject_code AS subjectCode, sub.subject_name AS subjectName, sub.credits,
        sr.attendance_percentage AS attendancePercentage, sr.average_internal_marks AS averageInternalMarks
      FROM subjects sub
      LEFT JOIN subject_records sr ON sr.subject_id=sub.subject_id AND sr.student_id=:studentId
      WHERE sub.department_code=:department AND sub.semester=:semester AND sub.is_active=1
      ORDER BY sub.subject_code`, { studentId, department: student.department, semester: student.semester }),
    query(`SELECT subject_code AS subjectCode, SUM(marks) AS marks, SUM(max_marks) AS maxMarks
      FROM assignments WHERE student_id=:studentId AND marks IS NOT NULL GROUP BY subject_code`, { studentId }),
    query(`SELECT achievement_date AS date, achievement_type AS achievementType, title, description
      FROM achievements WHERE student_id=:studentId ORDER BY achievement_date DESC, created_at DESC`, { studentId }),
    query(`SELECT r.created_at AS date, r.label, r.note, t.name AS author
      FROM remarks r LEFT JOIN teachers t ON t.id=r.teacher_id
      WHERE r.student_id=:studentId AND r.is_visible=1 ORDER BY r.created_at DESC`, { studentId }),
    query(`SELECT result, risk, model_version AS modelVersion FROM predictions
      WHERE student_id=:studentId ORDER BY created_at DESC, id DESC LIMIT 1`, { studentId }),
  ])
  const assignmentMap = new Map(assignmentRows.map((row) => {
    const marks = numberOrNull(row.marks)
    const maxMarks = numberOrNull(row.maxMarks)
    return [String(row.subjectCode).toUpperCase(), marks !== null && maxMarks ? (marks / maxMarks) * 100 : null]
  }))
  const subjects = subjectRows.map((row) => ({
    subjectCode: cleanString(row.subjectCode),
    subjectName: cleanString(row.subjectName),
    credits: numberOrNull(row.credits),
    attendancePercentage: numberOrNull(row.attendancePercentage),
    averageInternalMarks: numberOrNull(row.averageInternalMarks),
    assignmentScore: assignmentMap.get(String(row.subjectCode).toUpperCase()) ?? null,
  }))
  return {
    student,
    subjects,
    achievements: achievementRows.map((row) => ({ date: dateOrNull(row.date), achievementType: cleanString(row.achievementType), title: cleanString(row.title), description: cleanString(row.description) })),
    remarks: remarkRows.map((row) => ({ date: dateOrNull(row.date), label: cleanString(row.label), note: cleanString(row.note), author: cleanString(row.author) })),
    prediction: predictionRows[0]
      ? { result: predictionRows[0].result === 'Pass' || predictionRows[0].result === 'Fail' ? predictionRows[0].result : null, risk: normalizeRisk(predictionRows[0].risk) || null, modelVersion: cleanString(predictionRows[0].modelVersion) }
      : { result: student.result, risk: student.risk, modelVersion: null },
  }
}

export async function loadReportCard({ studentId, user, scope = {}, useDemoData, isStudentInUserScope, requireTeacherScope = false }) {
  const numericStudentId = Number(studentId)
  if (!Number.isInteger(numericStudentId) || numericStudentId <= 0) throw httpError(422, 'A valid student record is required.')
  const report = useDemoData ? await loadDemoReportCard(numericStudentId) : await loadDatabaseReportCard(numericStudentId)
  if (!report) throw httpError(404, 'Student record not found.')
  const normalizedScope = normalizeScope(scope)
  assertScope({ user, student: report.student, scope: normalizedScope, isStudentInUserScope, requireTeacherScope })
  return {
    ...report,
    academicYear: report.student.academicYear || academicYear() || null,
    generatedAt: new Date().toISOString(),
    college: {
      name: cleanString(process.env.COLLEGE_NAME) || DEFAULT_COLLEGE_NAME,
      location: cleanString(process.env.COLLEGE_LOCATION) || DEFAULT_COLLEGE_LOCATION,
      logoPath: cleanString(process.env.COLLEGE_LOGO_PATH) || null,
    },
  }
}

export { httpError }
