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
import { cleanString, isEmail, isPhone, passProbability, riskFromFeatures, validDepartments, validSemesters, validateAchievement, validateStudent, validateSubject } from './utils.js'

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

function selectedAdminDepartment(req) {
  return req.user.role === 'admin' && req.user.department && req.user.department !== 'ALL' ? req.user.department : ''
}

function scopeStudent(req, student) {
  if (req.user.role === 'admin') return true
  if (req.user.role === 'teacher') return student.department === req.user.department
  return String(student.usn).toUpperCase() === String(req.user.usn || '').toUpperCase()
}

function normalizeList(value) {
  if (Array.isArray(value)) return value.map((item) => cleanString(item)).filter(Boolean)
  const text = cleanString(value)
  if (!text) return []
  try { const parsed = JSON.parse(text); if (Array.isArray(parsed)) return normalizeList(parsed) } catch { /* comma-separated fallback */ }
  return text.split(',').map((item) => cleanString(item)).filter(Boolean)
}

function normalizeDate(value) {
  const text = cleanString(value)
  if (!text) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text
  if (/^\d+(\.\d+)?$/.test(text)) {
    const serial = Number(text)
    if (serial > 0) {
      const parsed = new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000)
      if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10)
    }
  }
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10)
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
    gender: cleanString(input.gender) || null,
    dateOfBirth: normalizeDate(input.dateOfBirth || input.date_of_birth),
    bloodGroup: cleanString(input.bloodGroup || input.blood_group),
    address: cleanString(input.address),
    email: cleanString(input.email).toLowerCase(),
    phone: cleanString(input.phone),
    parentName: cleanString(input.parentName),
    fatherName: cleanString(input.fatherName || input.father_name || input.parentName),
    motherName: cleanString(input.motherName || input.mother_name),
    parentPhone: cleanString(input.parentPhone || input.parent_phone),
    parentEmail: cleanString(input.parentEmail || input.parent_email),
    certifications: normalizeList(input.certifications),
    skills: normalizeList(input.skills),
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
  return {
    ...row,
    section: row.section || row.sectionName,
    department: row.department || row.department_code,
    parentName: row.parentName || row.parent_name,
    fatherName: row.fatherName || row.father_name || row.parentName || row.parent_name,
    motherName: row.motherName || row.mother_name,
    parentPhone: row.parentPhone || row.parent_phone,
    parentEmail: row.parentEmail || row.parent_email,
    dateOfBirth: normalizeDate(row.dateOfBirth || row.date_of_birth),
    bloodGroup: row.bloodGroup || row.blood_group,
    certifications: normalizeList(row.certifications),
    skills: normalizeList(row.skills),
    ia1: row.ia1 ?? row.ia_1 ?? 0,
    ia2: row.ia2 ?? row.ia_2 ?? 0,
    assignmentMarks: row.assignmentMarks ?? row.assignment_marks ?? 0,
    previousSgpa: row.previousSgpa ?? row.previous_sgpa ?? 0,
    backlogs: row.backlogs ?? 0,
    passProbability: row.passProbability ?? row.pass_probability,
    initials: row.initials || String(row.name || 'CA').split(/\s+/).map((word) => word[0]).join('').slice(0, 2).toUpperCase(),
  }
}

function mapSubjectRow(row) {
  return {
    ...row,
    id: row.id ?? row.subjectId ?? row.subject_id,
    subjectId: row.subjectId ?? row.subject_id ?? row.id,
    department: row.department || row.department_code,
    semester: Number(row.semester),
    subjectCode: row.subjectCode || row.subject_code,
    subjectName: row.subjectName || row.subject_name,
    credits: Number(row.credits || 0),
    isActive: row.isActive ?? row.is_active ?? true,
  }
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

function mapAchievementRow(row) {
  return { ...row, studentId: row.studentId ?? row.student_id, studentName: row.studentName || row.student_name, usn: row.usn, department: row.department || row.department_code, semester: Number(row.semester), section: row.section || row.sectionName, achievementType: row.achievementType || row.achievement_type, date: row.date || row.achievement_date, title: row.title, description: row.description, author: row.author || row.teacher_name || 'Teacher' }
}

async function findSection(department, semester, sectionName) {
  const rows = await query('SELECT section_id AS sectionId, department_code AS department, semester, section_name AS sectionName FROM sections WHERE department_code=:department AND semester=:semester AND section_name=:sectionName LIMIT 1', { department, semester: Number(semester), sectionName: cleanString(sectionName).toUpperCase() })
  return rows[0]
}

function demoSection(department, semester, sectionName) {
  return demoStore.sections.find((section) => section.department === department && Number(section.semester) === Number(semester) && section.sectionName === cleanString(sectionName).toUpperCase())
}

async function findSubject(subjectId, department, semester, subjectCode) {
  if (useDemoData) {
    return demoStore.subjects.find((subject) => (!subjectId || Number(subject.id || subject.subjectId) === Number(subjectId)) && (!department || subject.department === department) && (!semester || Number(subject.semester) === Number(semester)) && (!subjectCode || subject.subjectCode === subjectCode) && subject.isActive !== false)
  }
  const conditions = ['is_active = 1']
  const params = {}
  if (subjectId) { conditions.push('subject_id = :subjectId'); params.subjectId = Number(subjectId) }
  if (department) { conditions.push('department_code = :department'); params.department = department }
  if (semester) { conditions.push('semester = :semester'); params.semester = Number(semester) }
  if (subjectCode) { conditions.push('subject_code = :subjectCode'); params.subjectCode = subjectCode }
  const rows = await query(`SELECT subject_id AS subjectId, department_code AS department, semester, subject_code AS subjectCode, subject_name AS subjectName, credits, is_active AS isActive FROM subjects WHERE ${conditions.join(' AND ')} LIMIT 1`, params)
  return rows[0]
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
      const requestedDepartment = cleanString(req.body.department).toUpperCase()
      if (requestedDepartment && !validDepartments.includes(requestedDepartment)) return res.status(422).json({ message: 'Choose a valid department.' })
      if (role !== 'admin' && requestedDepartment && requestedDepartment !== account.department) return res.status(403).json({ message: `This demo ${role} account is scoped to ${account.department}. Choose that department to continue.` })
      const user = { ...account, department: role === 'admin' ? requestedDepartment || account.department : account.department }
      return res.json({ token: sign(user), user: publicUser(user) })
    }

    let rows
    if (role === 'teacher') rows = await query('SELECT id, name, email, password_hash, department_code AS department, designation FROM teachers WHERE email = :identifier AND is_active = 1 LIMIT 1', { identifier: identifier.toLowerCase() })
    else if (role === 'student') rows = await query('SELECT id, name, usn, email, password_hash, department_code AS department, semester FROM students WHERE usn = :identifier AND is_active = 1 LIMIT 1', { identifier: identifier.toUpperCase() })
    else if (role === 'parent') rows = await query('SELECT p.id, p.name, p.password_hash, s.usn, s.name AS student_name, s.department_code AS department, s.semester FROM parents p JOIN students s ON s.id = p.student_id WHERE s.usn = :identifier AND p.is_active = 1 LIMIT 1', { identifier: identifier.toUpperCase() })
    else rows = await query('SELECT id, name, email, password_hash FROM admins WHERE email = :identifier AND is_active = 1 LIMIT 1', { identifier: identifier.toLowerCase() })
    const found = rows[0]
    if (!found || !(await bcrypt.compare(password, found.password_hash))) return res.status(401).json({ message: 'Invalid credentials.' })
    const requestedDepartment = cleanString(req.body.department).toUpperCase()
    if (requestedDepartment && !validDepartments.includes(requestedDepartment)) return res.status(422).json({ message: 'Choose a valid department.' })
    if (role !== 'admin' && requestedDepartment && requestedDepartment !== found.department) return res.status(403).json({ message: `This ${role} account is scoped to ${found.department}. Choose that department to continue.` })
    const user = { ...found, role, department: role === 'admin' ? requestedDepartment || found.department || 'ALL' : found.department, initials: found.name.split(/\s+/).map((word) => word[0]).join('').slice(0, 2).toUpperCase() }
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

app.get('/api/subjects', authRequired, async (req, res, next) => {
  try {
    const learner = req.user.role === 'student' || req.user.role === 'parent'
    const adminDepartment = selectedAdminDepartment(req)
    const requestedDepartment = ['teacher', 'student', 'parent'].includes(req.user.role) ? req.user.department : adminDepartment || cleanString(req.query.department).toUpperCase()
    const requestedSemester = learner ? Number(req.user.semester) : Number(req.query.semester || 0)
    if (requestedDepartment && requestedDepartment !== 'ALL' && !validDepartments.includes(requestedDepartment)) return res.status(422).json({ message: 'Choose a valid department.' })
    if (requestedSemester && !validSemesters.includes(requestedSemester)) return res.status(422).json({ message: 'Semester must be between 1 and 8.' })
    if (useDemoData) {
      const data = demoStore.subjects.filter((subject) => subject.isActive !== false && (!requestedDepartment || requestedDepartment === 'ALL' || subject.department === requestedDepartment) && (!requestedSemester || Number(subject.semester) === requestedSemester))
      return res.json({ data: data.map(mapSubjectRow) })
    }
    const conditions = ['is_active = 1']
    const params = {}
    if (requestedDepartment && requestedDepartment !== 'ALL') { conditions.push('department_code = :department'); params.department = requestedDepartment }
    if (requestedSemester) { conditions.push('semester = :semester'); params.semester = requestedSemester }
    const rows = await query(`SELECT subject_id AS subjectId, department_code AS department, semester, subject_code AS subjectCode, subject_name AS subjectName, credits, is_active AS isActive FROM subjects WHERE ${conditions.join(' AND ')} ORDER BY department_code, semester, subject_code`, params)
    res.json({ data: rows.map(mapSubjectRow) })
  } catch (error) { next(error) }
})

app.post('/api/subjects', authRequired, roleRequired('admin'), async (req, res, next) => {
  try {
    const input = { ...req.body, department: cleanString(req.body.department).toUpperCase(), semester: Number(req.body.semester), subjectCode: cleanString(req.body.subjectCode || req.body.subject_code).toUpperCase(), subjectName: cleanString(req.body.subjectName || req.body.subject_name), credits: Number(req.body.credits) }
    const adminDepartment = selectedAdminDepartment(req)
    if (adminDepartment && input.department !== adminDepartment) return res.status(403).json({ message: 'This admin session is scoped to the selected department.' })
    const existing = useDemoData ? demoStore.subjects : []
    const errors = validateSubject(input, existing)
    if (errors.length) return res.status(422).json({ message: 'Subject validation failed.', errors })
    if (useDemoData) {
      const subject = { id: nextId(demoStore.subjects), subjectId: nextId(demoStore.subjects), ...input, isActive: true, createdAt: new Date().toISOString() }
      demoStore.subjects.push(subject)
      return res.status(201).json({ data: mapSubjectRow(subject) })
    }
    const result = await query('INSERT INTO subjects (department_code, semester, subject_code, subject_name, credits) VALUES (:department, :semester, :subjectCode, :subjectName, :credits)', input)
    res.status(201).json({ data: mapSubjectRow({ ...input, subjectId: result.insertId, isActive: true }) })
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'That subject code already exists for this department and semester.' })
    next(error)
  }
})

app.put('/api/subjects/:subjectId', authRequired, roleRequired('admin'), async (req, res, next) => {
  try {
    const subjectId = Number(req.params.subjectId)
    const adminDepartment = selectedAdminDepartment(req)
    if (useDemoData) {
      const index = demoStore.subjects.findIndex((subject) => Number(subject.id || subject.subjectId) === subjectId && (!adminDepartment || subject.department === adminDepartment))
      if (index < 0) return res.status(404).json({ message: 'Subject not found.' })
      const merged = { ...demoStore.subjects[index], ...req.body, id: demoStore.subjects[index].id, subjectId }
      merged.department = cleanString(merged.department).toUpperCase()
      if (adminDepartment && merged.department !== adminDepartment) return res.status(403).json({ message: 'This admin session is scoped to the selected department.' })
      merged.semester = Number(merged.semester)
      merged.subjectCode = cleanString(merged.subjectCode || merged.subject_code).toUpperCase()
      merged.subjectName = cleanString(merged.subjectName || merged.subject_name)
      merged.credits = Number(merged.credits)
      const errors = validateSubject(merged, demoStore.subjects)
      if (errors.length) return res.status(422).json({ message: 'Subject validation failed.', errors })
      demoStore.subjects[index] = { ...merged, isActive: true }
      return res.json({ data: mapSubjectRow(demoStore.subjects[index]) })
    }
    const existing = await findSubject(subjectId, adminDepartment || undefined)
    if (!existing) return res.status(404).json({ message: 'Subject not found.' })
    const merged = { ...mapSubjectRow(existing), ...req.body, subjectId, id: subjectId, department: cleanString(req.body.department || existing.department).toUpperCase(), semester: Number(req.body.semester || existing.semester), subjectCode: cleanString(req.body.subjectCode || existing.subjectCode).toUpperCase(), subjectName: cleanString(req.body.subjectName || existing.subjectName), credits: Number(req.body.credits || existing.credits) }
    if (adminDepartment && merged.department !== adminDepartment) return res.status(403).json({ message: 'This admin session is scoped to the selected department.' })
    const errors = validateSubject(merged, [])
    if (errors.length) return res.status(422).json({ message: 'Subject validation failed.', errors })
    await query('UPDATE subjects SET department_code=:department, semester=:semester, subject_code=:subjectCode, subject_name=:subjectName, credits=:credits WHERE subject_id=:subjectId AND is_active=1', merged)
    res.json({ data: mapSubjectRow(merged) })
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'That subject code already exists for this department and semester.' })
    next(error)
  }
})

app.delete('/api/subjects/:subjectId', authRequired, roleRequired('admin'), async (req, res, next) => {
  try {
    const subjectId = Number(req.params.subjectId)
    const adminDepartment = selectedAdminDepartment(req)
    if (useDemoData) {
      const index = demoStore.subjects.findIndex((subject) => Number(subject.id || subject.subjectId) === subjectId && (!adminDepartment || subject.department === adminDepartment))
      if (index < 0) return res.status(404).json({ message: 'Subject not found.' })
      demoStore.subjects.splice(index, 1)
      return res.json({ ok: true })
    }
    const result = adminDepartment
      ? await query('DELETE FROM subjects WHERE subject_id=:subjectId AND department_code=:department', { subjectId, department: adminDepartment })
      : await query('DELETE FROM subjects WHERE subject_id=:subjectId', { subjectId })
    if (!result.affectedRows) return res.status(404).json({ message: 'Subject not found.' })
    res.json({ ok: true })
  } catch (error) { next(error) }
})

app.get('/api/subjects/:subjectId/records', authRequired, roleRequired('teacher', 'admin'), async (req, res, next) => {
  try {
    const department = req.user.role === 'teacher' ? req.user.department : selectedAdminDepartment(req) || cleanString(req.query.department).toUpperCase()
    const semester = Number(req.query.semester)
    const section = cleanString(req.query.section).toUpperCase()
    const subject = await findSubject(Number(req.params.subjectId), department, semester)
    if (!subject) return res.status(404).json({ message: 'Subject not found in the selected scope.' })
    if (!validSemesters.includes(Number(subject.semester))) return res.status(422).json({ message: 'Subject semester is invalid.' })
    if (useDemoData) {
      const students = demoStore.students.filter((student) => scopeStudent(req, student) && student.department === subject.department && Number(student.semester) === Number(subject.semester) && (!section || String(student.section).toUpperCase() === section))
      const data = students.map((student) => {
        const record = demoStore.subjectRecords.find((item) => Number(item.subjectId) === Number(subject.id || subject.subjectId) && Number(item.studentId) === Number(student.id))
        return { studentId: student.id, attendance: record?.attendance ?? 0, ia1: record?.ia1 ?? 0, ia2: record?.ia2 ?? 0 }
      })
      return res.json({ data })
    }
    const conditions = ['st.is_active=1', 'st.department_code=:department', 'st.semester=:semester']
    const params = { department: subject.department, semester: Number(subject.semester), subjectCode: subject.subjectCode }
    if (section) { conditions.push('COALESCE(sec.section_name, st.section)=:section'); params.section = section }
    const rows = await query(`SELECT st.id AS studentId, COALESCE(att.attendance, 0) AS attendance, COALESCE(im.ia1, 0) AS ia1, COALESCE(im.ia2, 0) AS ia2 FROM students st LEFT JOIN sections sec ON sec.section_id=st.section_id LEFT JOIN (SELECT student_id, AVG(attendance_percentage) AS attendance FROM attendance WHERE subject_code=:subjectCode GROUP BY student_id) att ON att.student_id=st.id LEFT JOIN internal_marks im ON im.student_id=st.id AND im.subject_code=:subjectCode AND im.semester=:semester WHERE ${conditions.join(' AND ')} ORDER BY st.usn`, params)
    res.json({ data: rows })
  } catch (error) { next(error) }
})

async function subjectStudent(req, subject, input) {
  const studentId = Number(input.studentId)
  if (!Number.isInteger(studentId) || studentId <= 0) return null
  if (useDemoData) return demoStore.students.find((student) => Number(student.id) === studentId && scopeStudent(req, student) && student.department === subject.department && Number(student.semester) === Number(subject.semester) && (!input.section || String(student.section).toUpperCase() === String(input.section).toUpperCase()))
  const rows = await query('SELECT s.id, s.department_code AS department, s.semester, COALESCE(sec.section_name, s.section) AS section FROM students s LEFT JOIN sections sec ON sec.section_id=s.section_id WHERE s.id=:studentId AND s.is_active=1 LIMIT 1', { studentId })
  const student = rows[0]
  if (!student || !scopeStudent(req, student) || student.department !== subject.department || Number(student.semester) !== Number(subject.semester) || (input.section && String(student.section).toUpperCase() !== String(input.section).toUpperCase())) return null
  return student
}

app.put('/api/subjects/:subjectId/attendance', authRequired, roleRequired('teacher', 'admin'), async (req, res, next) => {
  try {
    const semester = Number(req.body.semester)
    const adminDepartment = selectedAdminDepartment(req)
    if (adminDepartment && req.body.department && cleanString(req.body.department).toUpperCase() !== adminDepartment) return res.status(403).json({ message: 'This admin session is scoped to the selected department.' })
    const subject = await findSubject(Number(req.params.subjectId), req.user.role === 'teacher' ? req.user.department : adminDepartment || cleanString(req.body.department).toUpperCase(), semester)
    if (!subject) return res.status(404).json({ message: 'Subject not found in the selected scope.' })
    const attendance = Number(req.body.attendance)
    if (!Number.isFinite(attendance) || attendance < 0 || attendance > 100) return res.status(422).json({ message: 'Attendance must be between 0 and 100.' })
    const student = await subjectStudent(req, subject, req.body)
    if (!student) return res.status(403).json({ message: 'Student is outside the selected subject scope.' })
    const section = cleanString(req.body.section).toUpperCase()
    if (useDemoData) {
      const subjectId = Number(subject.id || subject.subjectId)
      const current = demoStore.subjectRecords.find((item) => Number(item.subjectId) === subjectId && Number(item.studentId) === Number(student.id))
      if (current) current.attendance = attendance
      else demoStore.subjectRecords.push({ subjectId, studentId: Number(student.id), attendance, ia1: 0, ia2: 0 })
      return res.json({ data: { studentId: Number(student.id), attendance } })
    }
    await query('INSERT INTO attendance (student_id, subject_code, attendance_date, status, attendance_percentage, marked_by) VALUES (:studentId, :subjectCode, CURDATE(), :status, :attendance, :teacherId) ON DUPLICATE KEY UPDATE status=VALUES(status), attendance_percentage=VALUES(attendance_percentage), marked_by=VALUES(marked_by)', { studentId: Number(student.id), subjectCode: subject.subjectCode, status: cleanString(req.body.status) || 'Present', attendance, teacherId: req.user.sub })
    res.json({ data: { studentId: Number(student.id), attendance } })
  } catch (error) { next(error) }
})

app.put('/api/subjects/:subjectId/marks', authRequired, roleRequired('teacher', 'admin'), async (req, res, next) => {
  try {
    const semester = Number(req.body.semester)
    const adminDepartment = selectedAdminDepartment(req)
    if (adminDepartment && req.body.department && cleanString(req.body.department).toUpperCase() !== adminDepartment) return res.status(403).json({ message: 'This admin session is scoped to the selected department.' })
    const subject = await findSubject(Number(req.params.subjectId), req.user.role === 'teacher' ? req.user.department : adminDepartment || cleanString(req.body.department).toUpperCase(), semester)
    if (!subject) return res.status(404).json({ message: 'Subject not found in the selected scope.' })
    const ia1 = Number(req.body.ia1)
    const ia2 = Number(req.body.ia2)
    if (![ia1, ia2].every((value) => Number.isFinite(value) && value >= 0 && value <= 50)) return res.status(422).json({ message: 'IA marks must be between 0 and 50.' })
    const student = await subjectStudent(req, subject, req.body)
    if (!student) return res.status(403).json({ message: 'Student is outside the selected subject scope.' })
    if (useDemoData) {
      const subjectId = Number(subject.id || subject.subjectId)
      const current = demoStore.subjectRecords.find((item) => Number(item.subjectId) === subjectId && Number(item.studentId) === Number(student.id))
      if (current) { current.ia1 = ia1; current.ia2 = ia2 } else demoStore.subjectRecords.push({ subjectId, studentId: Number(student.id), attendance: 0, ia1, ia2 })
      return res.json({ data: { studentId: Number(student.id), ia1, ia2 } })
    }
    await query('INSERT INTO internal_marks (student_id, subject_code, semester, ia1, ia2, cgpa, recorded_by) VALUES (:studentId, :subjectCode, :semester, :ia1, :ia2, NULL, :teacherId) ON DUPLICATE KEY UPDATE ia1=VALUES(ia1), ia2=VALUES(ia2), recorded_by=VALUES(recorded_by)', { studentId: Number(student.id), subjectCode: subject.subjectCode, semester: Number(subject.semester), ia1, ia2, teacherId: req.user.sub })
    res.json({ data: { studentId: Number(student.id), ia1, ia2 } })
  } catch (error) { next(error) }
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
    const result = await query('INSERT INTO students (usn, name, department_code, semester, section, section_id, gender, date_of_birth, blood_group, address, email, phone, parent_name, father_name, mother_name, parent_phone, parent_email, certifications, skills) VALUES (:usn, :name, :department, :semester, :section, :sectionId, :gender, :dateOfBirth, :bloodGroup, :address, :email, :phone, :parentName, :fatherName, :motherName, :parentPhone, :parentEmail, :certifications, :skills)', { ...student, sectionId: sectionRow.sectionId, dateOfBirth: student.dateOfBirth || null, bloodGroup: student.bloodGroup || null, address: student.address || null, fatherName: student.fatherName || null, motherName: student.motherName || null, parentEmail: student.parentEmail || null, certifications: JSON.stringify(student.certifications || []), skills: JSON.stringify(student.skills || []) })
    res.status(201).json({ data: { ...student, id: result.insertId, sectionId: sectionRow.sectionId } })
  } catch (error) { next(error) }
})

app.put('/api/students/:id', authRequired, roleRequired('teacher', 'admin'), async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    if (req.user.role === 'teacher' && req.body.department && cleanString(req.body.department).toUpperCase() !== req.user.department) return res.status(403).json({ message: 'Teachers may only keep students in their department.' })
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
    const merged = { ...rows[0], ...req.body, department: cleanString(req.body.department || rows[0].department_code).toUpperCase(), section: cleanString(req.body.section || rows[0].section || 'A').toUpperCase() }
    const errors = validateStudent(merged, [])
    if (errors.length) return res.status(422).json({ message: 'Student validation failed.', errors })
    const sectionRow = await findSection(merged.department, merged.semester, merged.section)
    if (!sectionRow) return res.status(422).json({ message: `Section ${merged.section} does not exist for ${merged.department} Semester ${merged.semester}.` })
    await query('UPDATE students SET usn=:usn, name=:name, department_code=:department, semester=:semester, section=:section, section_id=:sectionId, gender=:gender, date_of_birth=:dateOfBirth, blood_group=:bloodGroup, address=:address, email=:email, phone=:phone, parent_name=:parentName, father_name=:fatherName, mother_name=:motherName, parent_phone=:parentPhone, parent_email=:parentEmail, certifications=:certifications, skills=:skills WHERE id=:id', { ...merged, id, sectionId: sectionRow.sectionId, dateOfBirth: merged.dateOfBirth || merged.date_of_birth || null, bloodGroup: merged.bloodGroup || merged.blood_group || null, address: merged.address || null, fatherName: merged.fatherName || merged.father_name || merged.parentName || null, motherName: merged.motherName || merged.mother_name || null, parentEmail: merged.parentEmail || merged.parent_email || null, parentPhone: merged.parentPhone || merged.parent_phone || null, certifications: JSON.stringify(normalizeList(merged.certifications)), skills: JSON.stringify(normalizeList(merged.skills)) })
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
    const rows = rawRows.map((row, index) => normalizeStudent({ ...row, usn: row.USN || row.usn, name: row.Name || row.name, department: row.Department || row.department || req.body.department || req.user.department, semester: row.Semester || row.semester || req.body.semester, section: row.Section || row.section || req.body.section || 'A', email: row.Email || row.email, phone: row.Phone || row.phone, parentName: row['Parent Name'] || row.parentName, parentPhone: row['Parent Phone'] || row.parentPhone, fatherName: row['Father Name'] || row.fatherName, motherName: row['Mother Name'] || row.motherName, parentEmail: row['Parent Email'] || row.parentEmail, dateOfBirth: row['Date of Birth'] || row.dateOfBirth, bloodGroup: row['Blood Group'] || row.bloodGroup, address: row.Address || row.address, certifications: row.Certifications || row.certifications, skills: row.Skills || row.skills, attendance: row.Attendance || row.attendance, cgpa: row.CGPA || row.cgpa }, Date.now() + index))
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
    else for (const row of rows) { const sectionRow = await findSection(row.department, row.semester, row.section); await query('INSERT INTO students (usn, name, department_code, semester, section, section_id, gender, date_of_birth, blood_group, address, email, phone, parent_name, father_name, mother_name, parent_phone, parent_email, certifications, skills) VALUES (:usn, :name, :department, :semester, :section, :sectionId, :gender, :dateOfBirth, :bloodGroup, :address, :email, :phone, :parentName, :fatherName, :motherName, :parentPhone, :parentEmail, :certifications, :skills)', { ...row, sectionId: sectionRow.sectionId, dateOfBirth: row.dateOfBirth || null, bloodGroup: row.bloodGroup || null, address: row.address || null, fatherName: row.fatherName || null, motherName: row.motherName || null, parentEmail: row.parentEmail || null, certifications: JSON.stringify(row.certifications || []), skills: JSON.stringify(row.skills || []) }) }
    res.status(201).json({ imported: rows.length, data: rows.map((row) => useDemoData ? row : ({ ...row })) })
  } catch (error) { next(error) }
})

app.get('/api/students/export', authRequired, roleRequired('teacher', 'admin'), async (req, res, next) => {
  try {
    let rows
    if (useDemoData) rows = demoStore.students.filter((student) => scopeStudent(req, student))
    else {
      const scopeClause = req.user.role === 'teacher' ? ' AND department_code = :department' : ''
      rows = await query(`SELECT usn AS USN, name AS Name, department_code AS Department, semester AS Semester, section AS Section, gender AS Gender, date_of_birth AS \`Date of Birth\`, blood_group AS \`Blood Group\`, address AS Address, email AS Email, phone AS Phone, parent_name AS \`Parent Name\`, father_name AS \`Father Name\`, mother_name AS \`Mother Name\`, parent_phone AS \`Parent Phone\`, parent_email AS \`Parent Email\`, certifications AS Certifications, skills AS Skills FROM students WHERE is_active = 1${scopeClause}`, req.user.role === 'teacher' ? { department: req.user.department } : {})
    }
    const sheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, sheet, 'Students')
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
    res.setHeader('Content-Disposition', 'attachment; filename="camps-student-roster.xlsx"')
    res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').send(buffer)
  } catch (error) { next(error) }
})

app.get('/api/achievements', authRequired, async (req, res, next) => {
  try {
    const requestedSemester = req.query.semester || (req.user.role === 'student' || req.user.role === 'parent' ? req.user.semester : undefined)
    const requestedSection = req.query.section ? String(req.query.section).toUpperCase() : ''
    const requestedDepartment = req.user.role === 'teacher' ? req.user.department : (req.query.department || (req.user.department === 'ALL' ? '' : req.user.department))
    if (useDemoData) {
      const items = demoStore.achievements.filter((achievement) => {
        const student = demoStore.students.find((item) => item.id === Number(achievement.studentId))
        if (!student || !scopeStudent(req, student)) return false
        return (!requestedDepartment || requestedDepartment === 'all' || student.department === requestedDepartment) && (!requestedSemester || Number(student.semester) === Number(requestedSemester)) && (!requestedSection || String(student.section || '').toUpperCase() === requestedSection)
      })
      return res.json({ data: items })
    }
    const conditions = ['s.is_active = 1']
    const params = {}
    if (req.user.role === 'teacher') { conditions.push('s.department_code = :teacherDepartment'); params.teacherDepartment = req.user.department }
    else if (req.user.role === 'student' || req.user.role === 'parent') { conditions.push('s.usn = :userUsn'); params.userUsn = req.user.usn }
    else if (requestedDepartment) { conditions.push('s.department_code = :department'); params.department = requestedDepartment }
    if (requestedSemester) { conditions.push('s.semester = :semester'); params.semester = Number(requestedSemester) }
    if (requestedSection) { conditions.push('COALESCE(sec.section_name, s.section) = :section'); params.section = requestedSection }
    const rows = await query(`SELECT a.id, a.student_id AS studentId, a.achievement_type AS achievementType, a.achievement_date AS date, a.title, a.description, a.created_at AS createdAt, s.usn, s.name AS studentName, s.department_code AS department, s.semester, COALESCE(sec.section_name, s.section) AS section, t.name AS teacher_name FROM achievements a JOIN students s ON s.id=a.student_id LEFT JOIN sections sec ON sec.section_id=COALESCE(a.section_id, s.section_id) LEFT JOIN teachers t ON t.id=a.teacher_id WHERE ${conditions.join(' AND ')} ORDER BY a.achievement_date DESC, a.created_at DESC`, params)
    res.json({ data: rows.map(mapAchievementRow) })
  } catch (error) { next(error) }
})

app.post('/api/achievements', authRequired, roleRequired('teacher', 'admin'), async (req, res, next) => {
  try {
    const input = req.body || {}
    const errors = validateAchievement(input)
    if (errors.length) return res.status(422).json({ message: 'Achievement validation failed.', errors })
    const studentId = Number(input.studentId)
    const requestedDepartment = cleanString(input.department).toUpperCase()
    const requestedSemester = input.semester === undefined || input.semester === '' ? null : Number(input.semester)
    const requestedSection = cleanString(input.section).toUpperCase()
    if (requestedSemester !== null && !validSemesters.includes(requestedSemester)) return res.status(422).json({ message: 'Achievement semester must be between 1 and 8.' })
    if (req.user.role === 'teacher' && (!requestedDepartment || requestedSemester === null || !requestedSection)) return res.status(422).json({ message: 'Department, semester and section scope are required for teacher achievements.' })
    let student
    if (useDemoData) student = demoStore.students.find((item) => Number(item.id) === studentId)
    else {
      const rows = await query('SELECT s.id, s.usn, s.name, s.department_code AS department, s.semester, s.section, s.section_id AS sectionId, sec.section_name AS sectionName FROM students s LEFT JOIN sections sec ON sec.section_id=s.section_id WHERE s.id=:studentId AND s.is_active=1 LIMIT 1', { studentId })
      student = rows[0]
    }
    if (!student) return res.status(404).json({ message: 'Student not found.' })
    const scopedStudent = { ...student, department: student.department || student.department_code, section: student.sectionName || student.section }
    if (!scopeStudent(req, scopedStudent)) return res.status(403).json({ message: 'Student is outside your access scope.' })
    if (requestedDepartment && requestedDepartment !== scopedStudent.department) return res.status(403).json({ message: 'Achievement department does not match the student scope.' })
    if (requestedSemester !== null && requestedSemester !== Number(scopedStudent.semester)) return res.status(403).json({ message: 'Achievement semester does not match the student scope.' })
    if (requestedSection && requestedSection !== String(scopedStudent.section || '').toUpperCase()) return res.status(403).json({ message: 'Achievement section does not match the student scope.' })
    let sectionId = student.sectionId || null
    if (!useDemoData && !sectionId) { const sectionRow = await findSection(scopedStudent.department, scopedStudent.semester, scopedStudent.section); sectionId = sectionRow?.sectionId || null }
    if (!useDemoData && !sectionId) return res.status(422).json({ message: 'The selected student is not linked to a valid section.' })
    const achievement = { studentId, studentName: scopedStudent.name, usn: scopedStudent.usn, department: scopedStudent.department, semester: Number(scopedStudent.semester), section: String(scopedStudent.section || '').toUpperCase(), achievementType: cleanString(input.achievementType || input.type), date: cleanString(input.date || input.achievementDate), title: cleanString(input.title), description: cleanString(input.description), author: req.user.name }
    if (useDemoData) {
      const saved = { id: nextId(demoStore.achievements), ...achievement, createdAt: new Date().toISOString() }
      demoStore.achievements.unshift(saved)
      return res.status(201).json({ data: saved })
    }
    const result = await query('INSERT INTO achievements (student_id, teacher_id, section_id, department_code, semester, achievement_type, achievement_date, title, description) VALUES (:studentId, :teacherId, :sectionId, :department, :semester, :achievementType, :date, :title, :description)', { ...achievement, teacherId: req.user.role === 'teacher' ? req.user.sub : null, sectionId })
    res.status(201).json({ data: { id: result.insertId, ...achievement } })
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'This achievement is already recorded for the selected student and date.' })
    if (error.code === 'ER_NO_REFERENCED_ROW_2') return res.status(422).json({ message: 'The selected student scope is no longer available.' })
    next(error)
  }
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
    const requestedDepartment = cleanString(department || req.user.department).toUpperCase()
    if (req.user.role === 'teacher' && requestedDepartment !== req.user.department) return res.status(403).json({ message: 'Teachers may only message their department.' })
    const normalizedSection = cleanString(section).toUpperCase() || undefined
    const requestedSemester = Number(semester || req.user.semester || 0) || null
    if (studentId) {
      const linkedStudent = useDemoData ? demoStore.students.find((item) => item.id === Number(studentId)) : (await query('SELECT id, department_code AS department, semester, section, section_id AS sectionId FROM students WHERE id=:studentId AND is_active=1 LIMIT 1', { studentId: Number(studentId) }))[0]
      if (!linkedStudent) return res.status(404).json({ message: 'Student not found.' })
      const scopedLinkedStudent = { ...linkedStudent, department: linkedStudent.department || linkedStudent.department_code }
      if (!scopeStudent(req, scopedLinkedStudent)) return res.status(403).json({ message: 'Student is outside your access scope.' })
      if (scopedLinkedStudent.department !== requestedDepartment || (requestedSemester && Number(scopedLinkedStudent.semester) !== requestedSemester) || (normalizedSection && String(scopedLinkedStudent.section || '').toUpperCase() !== normalizedSection)) return res.status(403).json({ message: 'Message scope does not match the selected student.' })
    }
    const message = { id: useDemoData ? nextId(demoStore.messages) : undefined, sender: req.user.name, recipient: recipient || audience || 'Academic community', audience: audience || 'Student', department: requestedDepartment, semester: requestedSemester, section: normalizedSection, subject: cleanString(subject), body: cleanString(body), time: 'Just now', createdAt: new Date().toISOString(), read: false, initials: (req.user.name || 'CA').split(/\s+/).map((word) => word[0]).join('').slice(0, 2).toUpperCase(), studentId }
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
    const requestedDepartment = req.body.department ? cleanString(req.body.department).toUpperCase() : ''
    if (req.user.role === 'teacher' && requestedDepartment && requestedDepartment !== req.user.department) return res.status(403).json({ message: 'Teachers may only publish in their department.' })
    if (useDemoData) {
      const index = demoStore.announcements.findIndex((item) => item.id === id)
      if (index < 0) return res.status(404).json({ message: 'Announcement not found.' })
      if (req.user.role === 'teacher' && demoStore.announcements[index].department && demoStore.announcements[index].department !== req.user.department) return res.status(403).json({ message: 'Announcement is outside your access scope.' })
      demoStore.announcements[index] = { ...demoStore.announcements[index], ...req.body, ...(requestedDepartment ? { department: requestedDepartment } : {}), id }
      return res.json({ data: demoStore.announcements[index] })
    }
    const existing = await query('SELECT department_code AS department FROM announcements WHERE id=:id AND is_active=1 LIMIT 1', { id })
    if (!existing[0]) return res.status(404).json({ message: 'Announcement not found.' })
    if (req.user.role === 'teacher' && existing[0].department !== req.user.department) return res.status(403).json({ message: 'Announcement is outside your access scope.' })
    await query('UPDATE announcements SET title=:title, body=:body, visibility_type=:type, department_code=:department, semester=:semester, priority=:priority WHERE id=:id', { ...req.body, id, department: requestedDepartment || existing[0].department })
    res.json({ ok: true })
  } catch (error) { next(error) }
})

app.delete('/api/announcements/:id', authRequired, roleRequired('teacher', 'admin'), async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    if (useDemoData) {
      const item = demoStore.announcements.find((announcement) => announcement.id === id)
      if (!item) return res.status(404).json({ message: 'Announcement not found.' })
      if (req.user.role === 'teacher' && item.department && item.department !== req.user.department) return res.status(403).json({ message: 'Announcement is outside your access scope.' })
      demoStore.announcements = demoStore.announcements.filter((announcement) => announcement.id !== id)
      return res.json({ ok: true })
    }
    const existing = await query('SELECT department_code AS department FROM announcements WHERE id=:id AND is_active=1 LIMIT 1', { id })
    if (!existing[0]) return res.status(404).json({ message: 'Announcement not found.' })
    if (req.user.role === 'teacher' && existing[0].department !== req.user.department) return res.status(403).json({ message: 'Announcement is outside your access scope.' })
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
    const student = useDemoData ? demoStore.students.find((item) => item.id === Number(studentId)) : (await query('SELECT id, name, department_code AS department FROM students WHERE id=:studentId AND is_active=1 LIMIT 1', { studentId: Number(studentId) }))[0]
    if (!student) return res.status(404).json({ message: 'Student not found.' })
    if (!scopeStudent(req, { ...student, department: student.department || student.department_code })) return res.status(403).json({ message: 'Student is outside your access scope.' })
    const remark = { id: useDemoData ? nextId(demoStore.remarks) : undefined, studentId: Number(studentId), studentName: student.name, label: cleanString(label), note: cleanString(note), date: 'Just now', author: req.user.name }
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
