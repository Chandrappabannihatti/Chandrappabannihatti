import 'dotenv/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import cors from 'cors'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import multer from 'multer'
import * as XLSX from 'xlsx'
import axios from 'axios'
import { demoStore, nextId } from './demoStore.js'
import { getPool, query } from './db.js'
import { cleanString, isEmail, isPhone, passProbability, riskFromFeatures, validDepartments, validSemesters, validateStudent } from './utils.js'

const app = express()
const port = Number(process.env.PORT || 5000)
const serverDirectory = path.dirname(fileURLToPath(import.meta.url))
const jwtSecret = process.env.JWT_SECRET || 'camps-development-secret-change-me'
const useDemoData = String(process.env.USE_DEMO_DATA ?? 'true').toLowerCase() === 'true'
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } })

app.use(cors({ origin: process.env.CLIENT_ORIGIN?.split(',') || true, credentials: true }))
app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true }))

const publicUser = (user) => ({ id: user.id, name: user.name, role: user.role, department: user.department, semester: user.semester, usn: user.usn, email: user.email, designation: user.designation, initials: user.initials })

const demoAccounts = {
  admin: { id: 1, secret: 'admin@camps.edu', password: 'Admin@123', name: 'Kavya Menon', role: 'admin', department: 'ALL', email: 'admin@camps.edu', designation: 'Academic Administrator', initials: 'KM' },
  teacher: { id: 1, secret: 'teacher@camps.edu', password: 'Teacher@123', name: 'Dr. Ananya Rao', role: 'teacher', department: 'CSE', email: 'ananya.rao@pestrust.edu.in', designation: 'Assistant Professor', initials: 'AR' },
  student: { id: 33, secret: '4PM21CS033', password: 'Student@123', name: 'Ishita Kulkarni', role: 'student', department: 'CSE', semester: 7, usn: '4PM21CS033', email: 'ishita.k@pestrust.edu.in', initials: 'IK' },
  parent: { id: 2, secret: '4PM21CS033', password: 'Parent@123', name: 'Suresh Kulkarni', role: 'parent', department: 'CSE', semester: 7, usn: '4PM21CS033', initials: 'SK' },
}

function sign(user) {
  return jwt.sign({ sub: user.id, role: user.role, department: user.department, semester: user.semester, usn: user.usn, name: user.name, email: user.email }, jwtSecret, { expiresIn: '8h' })
}

function authRequired(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ message: 'Authentication required.' })
  try { req.user = jwt.verify(token, jwtSecret); next() } catch { return res.status(401).json({ message: 'Session expired. Please sign in again.' }) }
}

function roleRequired(...roles) {
  return (req, res, next) => roles.includes(req.user.role) ? next() : res.status(403).json({ message: 'You do not have permission for this action.' })
}

function scopeStudent(req, student) {
  if (req.user.role === 'admin') return true
  if (req.user.role === 'teacher') return student.department === req.user.department
  return String(student.usn).toUpperCase() === String(req.user.usn || '').toUpperCase()
}

function normalizeStudent(input, id) {
  const attendance = Number(input.attendance || 0)
  const cgpa = Number(input.cgpa || 0)
  const risk = input.risk || riskFromFeatures(input)
  return {
    id: id || input.id || nextId(demoStore.students),
    usn: cleanString(input.usn).toUpperCase(),
    name: cleanString(input.name),
    department: cleanString(input.department).toUpperCase(),
    semester: Number(input.semester),
    section: cleanString(input.section || 'A'),
    gender: cleanString(input.gender),
    email: cleanString(input.email).toLowerCase(),
    phone: cleanString(input.phone),
    parentName: cleanString(input.parentName),
    parentPhone: cleanString(input.parentPhone),
    attendance,
    cgpa,
    ia1: Number(input.ia1 || 0),
    ia2: Number(input.ia2 || 0),
    assignmentMarks: Number(input.assignmentMarks || 0),
    previousSgpa: Number(input.previousSgpa || cgpa),
    backlogs: Number(input.backlogs || 0),
    risk,
    passProbability: Number(input.passProbability || passProbability(input)),
    initials: cleanString(input.initials) || cleanString(input.name).split(/\s+/).map((word) => word[0]).join('').slice(0, 2).toUpperCase(),
  }
}

function mapStudentRow(row) {
  return { ...row, section: row.section || row.sectionName, department: row.department || row.department_code, parentName: row.parentName || row.parent_name, parentPhone: row.parentPhone || row.parent_phone, ia1: row.ia1 ?? row.ia_1 ?? 0, ia2: row.ia2 ?? row.ia_2 ?? 0, assignmentMarks: row.assignmentMarks ?? row.assignment_marks ?? 0, previousSgpa: row.previousSgpa ?? row.previous_sgpa ?? 0, backlogs: row.backlogs ?? 0, passProbability: row.passProbability ?? row.pass_probability, initials: row.initials || String(row.name || 'CA').split(/\s+/).map((word) => word[0]).join('').slice(0, 2).toUpperCase() }
}

function mapMessageRow(row) {
  return { ...row, section: row.section || row.sectionName, sender: row.sender || row.sender_name, recipient: row.recipient || row.recipient_scope, time: row.time || row.created_at, read: Boolean(row.read || row.read_at), initials: row.initials || String(row.sender_name || 'CA').split(/\s+/).map((word) => word[0]).join('').slice(0, 2).toUpperCase() }
}

function mapAnnouncementRow(row) {
  return { ...row, section: row.section || row.sectionName, type: row.type || row.visibility_type, department: row.department || row.department_code, date: row.date || row.published_at, author: row.author || row.author_name || 'Academic Office' }
}

function mapRemarkRow(row) {
  return { ...row, studentId: row.studentId || row.student_id, studentName: row.studentName || row.student_name, date: row.date || row.created_at, author: row.author || row.teacher_name || 'Teacher' }
}

async function findSection(department, semester, sectionName) {
  const rows = await query('SELECT section_id AS sectionId, department_code AS department, semester, section_name AS sectionName FROM sections WHERE department_code=:department AND semester=:semester AND section_name=:sectionName LIMIT 1', { department, semester: Number(semester), sectionName: cleanString(sectionName).toUpperCase() })
  return rows[0]
}

function demoSection(department, semester, sectionName) {
  return demoStore.sections.find((section) => section.department === department && Number(section.semester) === Number(semester) && section.sectionName === cleanString(sectionName).toUpperCase())
}

app.get('/api/health', async (_req, res) => {
  let database = 'demo'
  if (!useDemoData) {
    try { await query('SELECT 1 AS ok'); database = 'mysql' } catch { database = 'unavailable' }
  }
  res.json({ ok: true, service: 'camps-api', database, prediction: process.env.ML_SERVICE_URL ? 'flask-or-fallback' : 'deterministic-fallback' })
})

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const role = cleanString(req.body.role).toLowerCase()
    const identifier = cleanString(req.body.identifier || req.body.email || req.body.usn)
    const password = cleanString(req.body.password)
    if (!['admin', 'teacher', 'student', 'parent'].includes(role) || !identifier || !password) return res.status(400).json({ message: 'Role, identifier and password are required.' })

    if (useDemoData) {
      const account = demoAccounts[role]
      if (!account || identifier.toLowerCase() !== account.secret.toLowerCase() || password !== account.password) return res.status(401).json({ message: 'Invalid demo credentials.' })
      const user = { ...account, department: role === 'admin' ? 'ALL' : (req.body.department || account.department) }
      return res.json({ token: sign(user), user: publicUser(user) })
    }

    let rows
    if (role === 'teacher') rows = await query('SELECT id, name, email, password_hash, department_code AS department, designation FROM teachers WHERE email = :identifier AND is_active = 1 LIMIT 1', { identifier: identifier.toLowerCase() })
    else if (role === 'student') rows = await query('SELECT id, name, usn, email, password_hash, department_code AS department, semester FROM students WHERE usn = :identifier AND is_active = 1 LIMIT 1', { identifier: identifier.toUpperCase() })
    else if (role === 'parent') rows = await query('SELECT p.id, p.name, p.password_hash, s.usn, s.name AS student_name, s.department_code AS department, s.semester FROM parents p JOIN students s ON s.id = p.student_id WHERE s.usn = :identifier AND p.is_active = 1 LIMIT 1', { identifier: identifier.toUpperCase() })
    else rows = await query('SELECT id, name, email, password_hash FROM admins WHERE email = :identifier AND is_active = 1 LIMIT 1', { identifier: identifier.toLowerCase() })
    const found = rows[0]
    if (!found || !(await bcrypt.compare(password, found.password_hash))) return res.status(401).json({ message: 'Invalid credentials.' })
    const user = { ...found, role, initials: found.name.split(/\s+/).map((word) => word[0]).join('').slice(0, 2).toUpperCase() }
    res.json({ token: sign(user), user: publicUser(user) })
  } catch (error) { next(error) }
})

app.post('/api/auth/logout', authRequired, (_req, res) => res.json({ ok: true, message: 'Signed out.' }))

app.get('/api/sections', authRequired, roleRequired('teacher', 'admin'), async (req, res, next) => {
  try {
    const requestedDepartment = req.user.role === 'teacher' ? req.user.department : (req.query.department || req.user.department)
    const semester = Number(req.query.semester)
    if (!validSemesters.includes(semester)) return res.status(422).json({ message: 'Semester must be between 1 and 8.' })
    if (useDemoData) {
      const data = demoStore.sections.filter((section) => section.department === requestedDepartment && Number(section.semester) === semester).map((section) => ({ ...section, studentCount: demoStore.students.filter((student) => student.department === requestedDepartment && Number(student.semester) === semester && student.section === section.sectionName).length }))
      return res.json({ data })
    }
    const rows = await query('SELECT s.section_id AS sectionId, s.department_code AS department, s.semester, s.section_name AS sectionName, s.created_at AS createdAt, COUNT(st.id) AS studentCount FROM sections s LEFT JOIN students st ON st.section_id=s.section_id AND st.is_active=1 WHERE s.department_code=:department AND s.semester=:semester GROUP BY s.section_id ORDER BY s.section_name', { department: requestedDepartment, semester })
    res.json({ data: rows })
  } catch (error) { next(error) }
})

app.post('/api/sections', authRequired, roleRequired('teacher', 'admin'), async (req, res, next) => {
  try {
    const department = req.user.role === 'teacher' ? req.user.department : cleanString(req.body.department).toUpperCase()
    const semester = Number(req.body.semester)
    const sectionName = cleanString(req.body.sectionName || req.body.section_name || req.body.section).toUpperCase()
    if (!validDepartments.includes(department) || !validSemesters.includes(semester) || !sectionName || !/^[A-Z0-9][A-Z0-9 -]{0,9}$/.test(sectionName)) return res.status(422).json({ message: 'Department, semester and a valid section name are required.' })
    if (useDemoData) {
      if (demoStore.sections.some((section) => section.department === department && Number(section.semester) === semester && section.sectionName === sectionName)) return res.status(409).json({ message: `Section ${sectionName} already exists for this semester.` })
      const section = { sectionId: `${department}-${semester}-${sectionName}-${Date.now()}`, department, semester, sectionName, studentCount: 0, createdAt: new Date().toISOString() }
      demoStore.sections.push(section)
      return res.status(201).json({ data: section })
    }
    const result = await query('INSERT INTO sections (department_code, semester, section_name) VALUES (:department, :semester, :sectionName)', { department, semester, sectionName })
    res.status(201).json({ data: { sectionId: result.insertId, department, semester, sectionName, studentCount: 0 } })
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'That section already exists for this semester.' })
    next(error)
  }
})

app.get('/api/students', authRequired, async (req, res, next) => {
  try {
    const { search = '', semester, section, department, risk, page = 1, limit = 25, sortBy = 'usn', sortOrder = 'asc' } = req.query
    if (useDemoData) {
      const requestedDepartment = req.user.role === 'teacher' ? req.user.department : (department || 'all')
      let items = demoStore.students.filter((student) => scopeStudent(req, student) && (requestedDepartment === 'all' || student.department === requestedDepartment) && (!semester || String(student.semester) === String(semester)) && (!section || String(student.section).toUpperCase() === String(section).toUpperCase()) && (!risk || student.risk === risk) && `${student.name} ${student.usn}`.toLowerCase().includes(String(search).toLowerCase()))
      items.sort((a, b) => { const left = String(a[sortBy] ?? ''); const right = String(b[sortBy] ?? ''); return (left.localeCompare(right, undefined, { numeric: true }) * (sortOrder === 'desc' ? -1 : 1)) })
      const total = items.length
      const start = (Number(page) - 1) * Number(limit)
      return res.json({ data: items.slice(start, start + Number(limit)), pagination: { page: Number(page), limit: Number(limit), total, pages: Math.max(1, Math.ceil(total / Number(limit))) } })
    }
    const allowedSort = ['usn', 'name', 'semester', 'attendance', 'cgpa', 'risk']
    const safeSort = allowedSort.includes(sortBy) ? sortBy : 'usn'
    const dbSort = { usn: 's.usn', name: 's.name', semester: 's.semester', attendance: 'attendance', cgpa: 'cgpa', risk: 'pr.risk' }
    const order = sortOrder === 'desc' ? 'DESC' : 'ASC'
    const conditions = ['s.is_active = 1']
    const params = {}
    if (req.user.role === 'teacher') { conditions.push('s.department_code = :teacherDepartment'); params.teacherDepartment = req.user.department }
    else if (req.user.role === 'student' || req.user.role === 'parent') { conditions.push('s.usn = :userUsn'); params.userUsn = req.user.usn }
    else if (department && department !== 'all') { conditions.push('s.department_code = :department'); params.department = department }
    if (semester) { conditions.push('s.semester = :semester'); params.semester = Number(semester) }
    if (section) { conditions.push('COALESCE(sec.section_name, s.section) = :section'); params.section = String(section).toUpperCase() }
    if (risk) { conditions.push('pr.risk = :risk'); params.risk = risk }
    if (search) { conditions.push('(s.name LIKE :search OR s.usn LIKE :search)'); params.search = `%${search}%` }
    const where = conditions.join(' AND ')
    const rows = await query(`SELECT s.*, sec.section_name AS sectionName, COALESCE(a.attendance_percentage, 0) AS attendance, COALESCE(im.cgpa, 0) AS cgpa, COALESCE(pr.ia1, im.ia1, 0) AS ia1, COALESCE(pr.ia2, im.ia2, 0) AS ia2, COALESCE(ass.assignmentMarks, 0) AS assignmentMarks, COALESCE(pr.previous_sgpa, 0) AS previousSgpa, COALESCE(pr.backlogs, 0) AS backlogs, pr.risk, pr.pass_probability AS passProbability FROM students s LEFT JOIN sections sec ON sec.section_id=s.section_id LEFT JOIN (SELECT student_id, AVG(attendance_percentage) AS attendance_percentage FROM attendance GROUP BY student_id) a ON a.student_id = s.id LEFT JOIN (SELECT student_id, MAX(cgpa) AS cgpa, MAX(ia1) AS ia1, MAX(ia2) AS ia2 FROM internal_marks GROUP BY student_id) im ON im.student_id = s.id LEFT JOIN (SELECT student_id, SUM(COALESCE(marks, 0)) AS assignmentMarks FROM assignments GROUP BY student_id) ass ON ass.student_id = s.id LEFT JOIN (SELECT p1.* FROM predictions p1 INNER JOIN (SELECT student_id, MAX(created_at) AS created_at FROM predictions GROUP BY student_id) latest ON latest.student_id = p1.student_id AND latest.created_at = p1.created_at) pr ON pr.student_id = s.id WHERE ${where} ORDER BY ${dbSort[safeSort]} ${order} LIMIT :limit OFFSET :offset`, { ...params, limit: Number(limit), offset: (Number(page) - 1) * Number(limit) })
    res.json({ data: rows.map(mapStudentRow), pagination: { page: Number(page), limit: Number(limit), total: rows.length, pages: 1 } })
  } catch (error) { next(error) }
})

app.post('/api/students', authRequired, roleRequired('teacher', 'admin'), async (req, res, next) => {
  try {
    const input = req.body
    if (req.user.role === 'teacher' && input.department !== req.user.department) return res.status(403).json({ message: 'Teachers may only add students in their department.' })
    const existing = useDemoData ? demoStore.students : []
    const errors = validateStudent(input, existing)
    if (errors.length) return res.status(422).json({ message: 'Student validation failed.', errors })
    const student = normalizeStudent(input)
    if (useDemoData) { if (!demoSection(student.department, student.semester, student.section)) return res.status(422).json({ message: `Section ${student.section} does not exist for ${student.department} Semester ${student.semester}.` }); demoStore.students.unshift(student); return res.status(201).json({ data: student }) }
    const sectionRow = await findSection(student.department, student.semester, student.section)
    if (!sectionRow) return res.status(422).json({ message: `Section ${student.section} does not exist for ${student.department} Semester ${student.semester}.` })
    const result = await query('INSERT INTO students (usn, name, department_code, semester, section, section_id, gender, email, phone, parent_name, parent_phone) VALUES (:usn, :name, :department, :semester, :section, :sectionId, :gender, :email, :phone, :parentName, :parentPhone)', { ...student, sectionId: sectionRow.sectionId })
    res.status(201).json({ data: { ...student, id: result.insertId, sectionId: sectionRow.sectionId } })
  } catch (error) { next(error) }
})

app.put('/api/students/:id', authRequired, roleRequired('teacher', 'admin'), async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    if (useDemoData) {
      const index = demoStore.students.findIndex((student) => student.id === id)
      if (index < 0) return res.status(404).json({ message: 'Student not found.' })
      if (!scopeStudent(req, demoStore.students[index])) return res.status(403).json({ message: 'Student is outside your access scope.' })
      const merged = { ...demoStore.students[index], ...req.body, id }
      const errors = validateStudent(merged, demoStore.students)
      if (errors.length) return res.status(422).json({ message: 'Student validation failed.', errors })
      demoStore.students[index] = normalizeStudent(merged, id)
      return res.json({ data: demoStore.students[index] })
    }
    const rows = await query('SELECT * FROM students WHERE id = :id AND is_active = 1 LIMIT 1', { id })
    if (!rows[0] || !scopeStudent(req, { ...rows[0], department: rows[0].department_code })) return res.status(404).json({ message: 'Student not found.' })
    const merged = { ...rows[0], ...req.body, department: req.body.department || rows[0].department_code, section: req.body.section || rows[0].section || 'A' }
    const errors = validateStudent(merged, [])
    if (errors.length) return res.status(422).json({ message: 'Student validation failed.', errors })
    const sectionRow = await findSection(merged.department, merged.semester, merged.section)
    if (!sectionRow) return res.status(422).json({ message: `Section ${merged.section} does not exist for ${merged.department} Semester ${merged.semester}.` })
    await query('UPDATE students SET usn=:usn, name=:name, department_code=:department, semester=:semester, section=:section, section_id=:sectionId, gender=:gender, email=:email, phone=:phone, parent_name=:parentName, parent_phone=:parentPhone WHERE id=:id', { ...merged, id, sectionId: sectionRow.sectionId })
    res.json({ data: { ...rows[0], ...merged, id, sectionId: sectionRow.sectionId } })
  } catch (error) { next(error) }
})

app.delete('/api/students/:id', authRequired, roleRequired('teacher', 'admin'), async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    if (useDemoData) {
      const index = demoStore.students.findIndex((student) => student.id === id)
      if (index < 0) return res.status(404).json({ message: 'Student not found.' })
      if (!scopeStudent(req, demoStore.students[index])) return res.status(403).json({ message: 'Student is outside your access scope.' })
      demoStore.students.splice(index, 1)
      return res.json({ ok: true })
    }
    await query('UPDATE students SET is_active = 0 WHERE id = :id', { id })
    res.json({ ok: true })
  } catch (error) { next(error) }
})

app.post('/api/students/upload', authRequired, roleRequired('teacher', 'admin'), upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Please attach an .xlsx or .csv file.' })
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' })
    const rows = rawRows.map((row, index) => normalizeStudent({ ...row, usn: row.USN || row.usn, name: row.Name || row.name, department: row.Department || row.department || req.body.department || req.user.department, semester: row.Semester || row.semester || req.body.semester, section: row.Section || row.section || req.body.section || 'A', email: row.Email || row.email, phone: row.Phone || row.phone, parentName: row['Parent Name'] || row.parentName, parentPhone: row['Parent Phone'] || row.parentPhone, attendance: row.Attendance || row.attendance, cgpa: row.CGPA || row.cgpa }, Date.now() + index))
    const existing = useDemoData ? demoStore.students : []
    const errors = []
    const seen = new Set()
    for (const [index, row] of rows.entries()) {
      const rowErrors = validateStudent(row, [...existing, ...rows.slice(0, index)])
      if (req.user.role === 'teacher' && row.department !== req.user.department) rowErrors.push(`Department must be ${req.user.department} for this teacher.`)
      if (req.body.department && row.department !== String(req.body.department).toUpperCase()) rowErrors.push(`Department must be ${String(req.body.department).toUpperCase()} for this upload.`)
      if (req.body.semester && Number(row.semester) !== Number(req.body.semester)) rowErrors.push(`Semester must be ${Number(req.body.semester)} for this upload.`)
      if (req.body.section && row.section !== String(req.body.section).toUpperCase()) rowErrors.push(`Section must be ${String(req.body.section).toUpperCase()} for this upload.`)
      if (useDemoData) { if (!demoSection(row.department, row.semester, row.section)) rowErrors.push(`Section ${row.section} does not exist for ${row.department} Semester ${row.semester}.`) } else { const sectionRow = await findSection(row.department, row.semester, row.section); if (!sectionRow) rowErrors.push(`Section ${row.section} does not exist for ${row.department} Semester ${row.semester}.`) }
      if (seen.has(row.usn)) rowErrors.push('Duplicate USN in upload.')
      seen.add(row.usn)
      rowErrors.forEach((message) => errors.push(`Row ${index + 2}: ${message}`))
    }
    const preview = rows.map(({ id, initials, ...row }) => row)
    if (String(req.body.commit) !== 'true') return res.json({ preview, errors, valid: errors.length === 0, rowCount: rows.length })
    if (errors.length) return res.status(422).json({ message: 'Upload has validation errors. Fix them before importing.', errors, preview })
    if (useDemoData) demoStore.students.unshift(...rows)
    else for (const row of rows) { const sectionRow = await findSection(row.department, row.semester, row.section); await query('INSERT INTO students (usn, name, department_code, semester, section, section_id, gender, email, phone, parent_name, parent_phone) VALUES (:usn, :name, :department, :semester, :section, :sectionId, :gender, :email, :phone, :parentName, :parentPhone)', { ...row, sectionId: sectionRow.sectionId }) }
    res.status(201).json({ imported: rows.length, data: rows.map((row) => useDemoData ? row : ({ ...row })) })
  } catch (error) { next(error) }
})

app.get('/api/students/export', authRequired, roleRequired('teacher', 'admin'), async (req, res, next) => {
  try {
    const rows = useDemoData ? demoStore.students.filter((student) => scopeStudent(req, student)) : await query('SELECT usn AS USN, name AS Name, department_code AS Department, semester AS Semester, section AS Section, email AS Email, phone AS Phone, parent_name AS `Parent Name`, parent_phone AS `Parent Phone` FROM students WHERE is_active = 1')
    const sheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, sheet, 'Students')
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
    res.setHeader('Content-Disposition', 'attachment; filename="camps-student-roster.xlsx"')
    res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').send(buffer)
  } catch (error) { next(error) }
})

app.get('/api/messages', authRequired, async (req, res, next) => {
  try {
    const requestedDepartment = req.user.role === 'teacher' ? req.user.department : (req.query.department || req.user.department)
    const requestedSemester = req.query.semester || req.user.semester
    const requestedSection = req.query.section ? String(req.query.section).toUpperCase() : ''
    if (useDemoData) {
      const messages = (req.user.role === 'teacher' || req.user.role === 'admin'
        ? demoStore.messages
        : demoStore.messages.filter((message) => String(message.recipient).toLowerCase().includes(String(req.user.name || req.user.usn).toLowerCase()) || message.audience === 'Students'))
        .filter((message) => (!requestedDepartment || message.department === requestedDepartment) && (!requestedSemester || Number(message.semester) === Number(requestedSemester)) && (!requestedSection || String(message.section || '').toUpperCase() === requestedSection))
      return res.json({ data: messages })
    }
    const conditions = ['(m.recipient_user_id = :userId OR m.recipient_scope = :scope OR m.sender_id = :userId)']
    const params = { userId: req.user.sub, scope: requestedDepartment || 'ALL' }
    if (requestedDepartment) { conditions.push('m.department_code = :department'); params.department = requestedDepartment }
    if (requestedSemester) { conditions.push('m.semester = :semester'); params.semester = Number(requestedSemester) }
    if (requestedSection) { conditions.push('sec.section_name = :section'); params.section = requestedSection }
    const rows = await query(`SELECT m.*, sec.section_name AS sectionName, u.display_name AS sender_name FROM messages m LEFT JOIN sections sec ON sec.section_id=m.section_id LEFT JOIN users u ON u.id = m.sender_id WHERE ${conditions.join(' AND ')} ORDER BY m.created_at DESC`, params)
    res.json({ data: rows.map(mapMessageRow) })
  } catch (error) { next(error) }
})

app.post('/api/messages/send', authRequired, roleRequired('teacher', 'admin'), async (req, res, next) => {
  try {
    const { recipient, audience, subject, body, studentId, department, semester, section } = req.body
    if (!subject || !body) return res.status(422).json({ message: 'Subject and message body are required.' })
    if (req.user.role === 'teacher' && department && department !== req.user.department) return res.status(403).json({ message: 'Teachers may only message their department.' })
    const normalizedSection = cleanString(section).toUpperCase() || undefined
    const message = { id: useDemoData ? nextId(demoStore.messages) : undefined, sender: req.user.name, recipient: recipient || audience || 'Academic community', audience: audience || 'Student', department: department || req.user.department, semester: Number(semester || req.user.semester || 0) || null, section: normalizedSection, subject: cleanString(subject), body: cleanString(body), time: 'Just now', createdAt: new Date().toISOString(), read: false, initials: (req.user.name || 'CA').split(/\s+/).map((word) => word[0]).join('').slice(0, 2).toUpperCase(), studentId }
    if (normalizedSection) { const sectionRow = useDemoData ? demoSection(message.department, message.semester, normalizedSection) : await findSection(message.department, message.semester, normalizedSection); if (!sectionRow) return res.status(422).json({ message: `Section ${normalizedSection} does not exist for ${message.department} Semester ${message.semester}.` }); message.sectionId = sectionRow.sectionId }
    if (useDemoData) demoStore.messages.unshift(message)
    else await query('INSERT INTO messages (sender_id, recipient_scope, student_id, department_code, semester, section_id, audience, subject, body) VALUES (:senderId, :recipientScope, :studentId, :department, :semester, :sectionId, :audience, :subject, :body)', { senderId: req.user.sub, recipientScope: recipient || audience || 'Academic community', studentId: studentId || null, department: message.department, semester: message.semester, sectionId: message.sectionId || null, audience: message.audience, subject: message.subject, body: message.body })
    res.status(201).json({ data: message })
  } catch (error) { next(error) }
})

app.put('/api/messages/:id/read', authRequired, async (req, res, next) => {
  try {
    if (useDemoData) { const message = demoStore.messages.find((item) => item.id === Number(req.params.id)); if (message) message.read = true; return res.json({ ok: true }) }
    await query('UPDATE messages SET read_at = CURRENT_TIMESTAMP WHERE id = :id', { id: Number(req.params.id) }); res.json({ ok: true })
  } catch (error) { next(error) }
})

app.get('/api/announcements', authRequired, async (req, res, next) => {
  try {
    const requestedDepartment = req.user.role === 'teacher' ? req.user.department : (req.query.department || req.user.department)
    const requestedSemester = req.query.semester || req.user.semester
    const requestedSection = req.query.section ? String(req.query.section).toUpperCase() : ''
    if (useDemoData) {
      const items = demoStore.announcements.filter((item) => (!requestedDepartment || item.department === requestedDepartment) && (!requestedSemester || Number(item.semester) === Number(requestedSemester)) && (!requestedSection || String(item.section || '').toUpperCase() === requestedSection))
      return res.json({ data: items })
    }
    const conditions = ['is_active = 1', 'department_code = :department']
    const params = { department: requestedDepartment }
    if (requestedSemester) { conditions.push('semester = :semester'); params.semester = Number(requestedSemester) }
    if (requestedSection) { conditions.push('sec.section_name = :section'); params.section = requestedSection }
    const rows = await query(`SELECT a.*, sec.section_name AS sectionName FROM announcements a LEFT JOIN sections sec ON sec.section_id=a.section_id WHERE ${conditions.join(' AND ')} ORDER BY a.created_at DESC`, params)
    res.json({ data: rows.map(mapAnnouncementRow) })
  } catch (error) { next(error) }
})

app.post('/api/announcements', authRequired, roleRequired('teacher', 'admin'), async (req, res, next) => {
  try {
    const { title, body, type = 'Department', department, semester, section, priority = 'Normal' } = req.body
    if (!title || !body) return res.status(422).json({ message: 'Title and body are required.' })
    if (req.user.role === 'teacher' && department && department !== req.user.department) return res.status(403).json({ message: 'Teachers may only publish in their department.' })
    const normalizedSection = cleanString(section).toUpperCase() || undefined
    const item = { id: useDemoData ? nextId(demoStore.announcements) : undefined, title: cleanString(title), body: cleanString(body), type, department: type === 'College' ? null : department || req.user.department, semester: type === 'Semester' ? Number(semester) : null, section: normalizedSection, priority, author: req.user.name, date: 'Just now' }
    if (normalizedSection) { const sectionRow = useDemoData ? demoSection(item.department, item.semester, normalizedSection) : await findSection(item.department, item.semester, normalizedSection); if (!sectionRow) return res.status(422).json({ message: `Section ${normalizedSection} does not exist for ${item.department} Semester ${item.semester}.` }); item.sectionId = sectionRow.sectionId }
    if (useDemoData) demoStore.announcements.unshift(item)
    else await query('INSERT INTO announcements (title, body, visibility_type, department_code, semester, section_id, priority, author_id) VALUES (:title, :body, :type, :department, :semester, :sectionId, :priority, :authorId)', { ...item, sectionId: item.sectionId || null, authorId: req.user.sub })
    res.status(201).json({ data: item })
  } catch (error) { next(error) }
})

app.put('/api/announcements/:id', authRequired, roleRequired('teacher', 'admin'), async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    if (useDemoData) { const index = demoStore.announcements.findIndex((item) => item.id === id); if (index < 0) return res.status(404).json({ message: 'Announcement not found.' }); demoStore.announcements[index] = { ...demoStore.announcements[index], ...req.body, id }; return res.json({ data: demoStore.announcements[index] }) }
    await query('UPDATE announcements SET title=:title, body=:body, visibility_type=:type, department_code=:department, semester=:semester, priority=:priority WHERE id=:id', { ...req.body, id }); res.json({ ok: true })
  } catch (error) { next(error) }
})

app.delete('/api/announcements/:id', authRequired, roleRequired('teacher', 'admin'), async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    if (useDemoData) { demoStore.announcements = demoStore.announcements.filter((item) => item.id !== id); return res.json({ ok: true }) }
    await query('UPDATE announcements SET is_active=0 WHERE id=:id', { id }); res.json({ ok: true })
  } catch (error) { next(error) }
})

app.get('/api/remarks', authRequired, async (req, res, next) => {
  try {
    const requestedSemester = req.query.semester || req.user.semester
    const requestedSection = req.query.section ? String(req.query.section).toUpperCase() : ''
    if (useDemoData) {
      const items = (req.user.role === 'teacher' || req.user.role === 'admin' ? demoStore.remarks : demoStore.remarks.filter((remark) => remark.studentId === 4)).filter((remark) => {
        const student = demoStore.students.find((item) => item.id === remark.studentId)
        return student && student.department === req.user.department && (!requestedSemester || Number(student.semester) === Number(requestedSemester)) && (!requestedSection || String(student.section || '').toUpperCase() === requestedSection)
      })
      return res.json({ data: items })
    }
    const conditions = ['s.department_code=:department']
    const params = { department: req.user.department }
    if (requestedSemester) { conditions.push('s.semester=:semester'); params.semester = Number(requestedSemester) }
    if (requestedSection) { conditions.push('COALESCE(sec.section_name, s.section)=:section'); params.section = requestedSection }
    const rows = await query(`SELECT r.*, s.name AS student_name FROM remarks r JOIN students s ON s.id=r.student_id LEFT JOIN sections sec ON sec.section_id=s.section_id WHERE ${conditions.join(' AND ')} ORDER BY r.created_at DESC`, params); res.json({ data: rows.map(mapRemarkRow) })
  } catch (error) { next(error) }
})

app.post('/api/remarks', authRequired, roleRequired('teacher', 'admin'), async (req, res, next) => {
  try {
    const { studentId, label, note } = req.body
    if (!studentId || !label || !note) return res.status(422).json({ message: 'Student, label and note are required.' })
    const student = useDemoData ? demoStore.students.find((item) => item.id === Number(studentId)) : null
    if (req.user.role === 'teacher' && student && student.department !== req.user.department) return res.status(403).json({ message: 'Student is outside your access scope.' })
    const remark = { id: useDemoData ? nextId(demoStore.remarks) : undefined, studentId: Number(studentId), studentName: student?.name, label: cleanString(label), note: cleanString(note), date: 'Just now', author: req.user.name }
    if (useDemoData) demoStore.remarks.unshift(remark)
    else await query('INSERT INTO remarks (student_id, teacher_id, label, note) VALUES (:studentId, :teacherId, :label, :note)', { ...remark, teacherId: req.user.sub })
    res.status(201).json({ data: remark })
  } catch (error) { next(error) }
})

app.post('/api/ml/predict', authRequired, async (req, res, next) => {
  try {
    const features = { attendance: Number(req.body.attendance || 0), ia1: Number(req.body.ia1 || 0), ia2: Number(req.body.ia2 || 0), assignmentMarks: Number(req.body.assignmentMarks || 0), previousSgpa: Number(req.body.previousSgpa || 0), cgpa: Number(req.body.cgpa || 0), backlogs: Number(req.body.backlogs || 0) }
    if (process.env.ML_SERVICE_URL) {
      try { const response = await axios.post(`${process.env.ML_SERVICE_URL.replace(/\/$/, '')}/predict`, features, { timeout: 2500 }); return res.json(response.data) } catch (serviceError) { console.warn('ML service unavailable; using fallback:', serviceError.message) }
    }
    const probability = passProbability(features)
    res.json({ risk: riskFromFeatures(features), pass_probability: probability, model: 'deterministic-fallback', features })
  } catch (error) { next(error) }
})

if (process.env.NODE_ENV === 'production') {
  const clientDirectory = path.resolve(serverDirectory, '../dist')
  app.use(express.static(clientDirectory))
  app.get('*', (_req, res) => res.sendFile(path.join(clientDirectory, 'index.html')))
}

app.use((error, _req, res, _next) => {
  console.error(error)
  if (error.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ message: 'File is too large. Maximum size is 8 MB.' })
  res.status(error.status || 500).json({ message: error.message || 'Unexpected server error.' })
})

app.listen(port, '0.0.0.0', () => {
  console.log(`CAMPS API listening on http://0.0.0.0:${port} · ${useDemoData ? 'demo data mode' : 'MySQL mode'}`)
  if (!useDemoData && !getPool()) console.warn('MySQL mode is enabled but no pool is configured.')
})

export default app
