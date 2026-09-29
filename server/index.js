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
import { getPool, query, transaction } from './db.js'
import { academicFields, cleanString, isEmail, isPhone, normalizeRisk, predictAcademic, predictionAttributeKeys, predictionFields, validDepartments, validSemesters, validateAchievement, validateStudent, validateSubject } from './utils.js'

const app = express()
const port = Number(process.env.PORT || 5000)
const serverDirectory = path.dirname(fileURLToPath(import.meta.url))
const jwtSecret = process.env.JWT_SECRET || 'camps-development-secret-change-me'
const useDemoData = String(process.env.USE_DEMO_DATA ?? 'true').toLowerCase() === 'true'
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } })

app.use(cors({ origin: process.env.CLIENT_ORIGIN?.split(',') || true, credentials: true }))
app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true }))

const publicUser = (user) => ({ id: user.id, name: user.name, role: user.role, department: user.department, semester: user.semester, usn: user.usn, studentId: user.studentId, studentName: user.studentName, email: user.email, designation: user.designation, relationship: user.relationship, initials: user.initials })

function publicTeacher(teacher) {
  return {
    id: teacher.id,
    employeeCode: teacher.employeeCode || teacher.employee_code,
    name: teacher.name,
    email: teacher.email,
    department: teacher.department || teacher.department_code,
    designation: teacher.designation || '',
    phone: teacher.phone || '',
    isActive: teacher.isActive ?? teacher.is_active ?? true,
    initials: teacher.initials || String(teacher.name || 'Teacher').split(/\s+/).map((word) => word[0]).join('').slice(0, 2).toUpperCase(),
  }
}

const demoAccounts = {
  admin: { id: 1, secret: 'admin@camps.edu', password: 'Admin@123', name: 'Kavya Menon', role: 'admin', department: 'ALL', email: 'admin@camps.edu', designation: 'Academic Administrator', initials: 'KM' },
  teacher: { id: 1, secret: 'teacher@camps.edu', password: 'Teacher@123', name: 'Dr. Ananya Rao', role: 'teacher', department: 'CSE', email: 'ananya.rao@pestrust.edu.in', designation: 'Assistant Professor', initials: 'AR' },
  student: { id: 4, secret: '4PM21CS033', password: 'Student@123', name: 'Ishita Kulkarni', role: 'student', department: 'CSE', semester: 7, usn: '4PM21CS033', email: 'ishita.k@pestrust.edu.in', initials: 'IK' },
  parent: { id: 2, secret: '4PM21CS033', password: 'Parent@123', name: 'Suresh Kulkarni', role: 'parent', department: 'CSE', semester: 7, usn: '4PM21CS033', studentId: 4, studentName: 'Ishita Kulkarni', email: 'suresh.kulkarni@example.com', relationship: 'Parent', initials: 'SK' },
}

function demoParentForStudent(student) {
  if (!student) return null
  return {
    id: Number(student.id) === 4 ? 2 : 10000 + Number(student.id),
    secret: student.usn,
    password: 'Parent@123',
    name: student.parentName || `${student.name} Parent`,
    role: 'parent',
    department: student.department,
    semester: Number(student.semester),
    usn: student.usn,
    studentId: Number(student.id),
    studentName: student.name,
    email: student.parentEmail || `${String(student.usn).toLowerCase()}@parents.camps.edu`,
    relationship: 'Parent',
    initials: String(student.parentName || `${student.name} Parent`).split(/\s+/).map((word) => word[0]).join('').slice(0, 2).toUpperCase(),
  }
}

function sign(user) {
  return jwt.sign({ sub: user.id, role: user.role, department: user.department, semester: user.semester, usn: user.usn, studentId: user.studentId, name: user.name, email: user.email }, jwtSecret, { expiresIn: '8h' })
}

function authRequired(req, res, next) {
  // Keep the standard Bearer header while accepting the explicit fallback
  // header used by the browser preview proxy when it strips Authorization.
  const authorization = req.headers.authorization || req.headers['x-access-token']
  const token = String(authorization || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) {
    console.warn('[camps-auth] Missing access token', { method: req.method, path: req.originalUrl, hasAuthorizationHeader: Boolean(req.headers.authorization), hasFallbackHeader: Boolean(req.headers['x-access-token']) })
    return res.status(401).json({ message: 'Authentication required.' })
  }
  try {
    req.user = jwt.verify(token, jwtSecret)
    next()
  } catch (error) {
    console.warn('[camps-auth] Invalid or expired access token', { method: req.method, path: req.originalUrl, reason: error.name })
    return res.status(401).json({ message: 'Session expired. Please sign in again.' })
  }
}

function roleRequired(...roles) {
  return (req, res, next) => roles.includes(req.user.role) ? next() : res.status(403).json({ message: 'You do not have permission for this action.' })
}

function selectedAdminDepartment(req) {
  return req.user.role === 'admin' && req.user.department && req.user.department !== 'ALL' ? req.user.department : ''
}

function scopeStudent(req, student) {
  const department = cleanString(student.department || student.department_code).toUpperCase()
  if (req.user.role === 'admin') return !selectedAdminDepartment(req) || department === selectedAdminDepartment(req)
  if (req.user.role === 'teacher') return department === req.user.department
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
  const academic = academicFields(input)
  const outcome = predictAcademic(academic)
  return {
    id: id || input.id || nextId(demoStore.students),
    usn: cleanString(input.usn).toUpperCase(),
    name: cleanString(input.name),
    department: cleanString(input.department).toUpperCase(),
    semester: Number(input.semester),
    section: cleanString(input.section || 'A').toUpperCase(),
    gender: cleanString(input.gender) || null,
    dateOfBirth: normalizeDate(input.dateOfBirth || input.date_of_birth),
    bloodGroup: cleanString(input.bloodGroup || input.blood_group),
    address: cleanString(input.address),
    email: cleanString(input.email).toLowerCase(),
    phone: cleanString(input.phone),
    parentName: cleanString(input.parentName || input.parent_name),
    fatherName: cleanString(input.fatherName || input.father_name || input.parentName || input.parent_name),
    motherName: cleanString(input.motherName || input.mother_name),
    parentPhone: cleanString(input.parentPhone || input.parent_phone),
    parentEmail: cleanString(input.parentEmail || input.parent_email),
    certifications: normalizeList(input.certifications),
    skills: normalizeList(input.skills),
    ...academic,
    result: cleanString(input.result) === 'Pass' || cleanString(input.result) === 'Fail' ? cleanString(input.result) : outcome.result,
    risk: normalizeRisk(input.risk) || outcome.risk,
    initials: cleanString(input.initials) || cleanString(input.name).split(/\s+/).map((word) => word[0]).join('').slice(0, 2).toUpperCase(),
  }
}

function mapStudentRow(row) {
  const academic = academicFields(row)
  const outcome = predictAcademic(academic)
  return {
    id: row.id,
    usn: cleanString(row.usn).toUpperCase(),
    name: cleanString(row.name),
    department: cleanString(row.department || row.department_code).toUpperCase(),
    semester: Number(row.semester),
    section: cleanString(row.section || row.sectionName || 'A').toUpperCase(),
    gender: row.gender || null,
    dateOfBirth: normalizeDate(row.dateOfBirth || row.date_of_birth),
    bloodGroup: row.bloodGroup || row.blood_group || null,
    address: row.address || null,
    email: cleanString(row.email).toLowerCase(),
    phone: row.phone || '',
    parentName: row.parentName || row.parent_name || '',
    fatherName: row.fatherName || row.father_name || row.parentName || row.parent_name || '',
    motherName: row.motherName || row.mother_name || '',
    parentPhone: row.parentPhone || row.parent_phone || '',
    parentEmail: row.parentEmail || row.parent_email || '',
    certifications: normalizeList(row.certifications),
    skills: normalizeList(row.skills),
    ...academic,
    result: row.result === 'Pass' || row.result === 'Fail' ? row.result : outcome.result,
    risk: normalizeRisk(row.risk) || outcome.risk,
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
  const sender = row.sender || row.sender_name || row.senderName || 'CAMPS'
  const recipient = row.recipient || row.recipient_name || row.recipient_scope || (row.receiver_role ? `${row.receiver_role} ${row.receiver_id}` : 'Recipient')
  const senderRole = row.senderRole || row.sender_role || ''
  const receiverRole = row.receiverRole || row.receiver_role || ''
  const read = Boolean(row.read ?? row.readStatus ?? row.read_status ?? row.read_at)
  return {
    ...row,
    sender,
    senderId: row.senderId ?? row.sender_id,
    senderRole,
    receiverId: row.receiverId ?? row.receiver_id,
    receiverRole,
    recipient,
    recipientId: row.recipientId ?? row.receiver_id,
    recipientRole: receiverRole,
    body: row.body || row.content || '',
    studentId: row.studentId ?? row.student_id,
    studentName: row.studentName || row.student_name,
    department: row.department || row.department_code,
    semester: row.semester == null ? row.semester : Number(row.semester),
    section: row.section || row.sectionName,
    sectionId: row.sectionId ?? row.section_id,
    time: row.time || row.created_at || row.createdAt,
    createdAt: row.createdAt || row.created_at,
    read,
    readStatus: read,
    initials: row.initials || String(sender).split(/\s+/).map((word) => word[0]).join('').slice(0, 2).toUpperCase(),
  }
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
      let account = demoAccounts[role]
      if (role === 'teacher') {
        const savedTeacher = demoStore.teachers.find((teacher) => teacher.email.toLowerCase() === identifier.toLowerCase() && teacher.isActive !== false)
        if (savedTeacher) {
          const validPassword = savedTeacher.passwordHash
            ? await bcrypt.compare(password, savedTeacher.passwordHash)
            : identifier.toLowerCase() === demoAccounts.teacher.secret.toLowerCase() && password === demoAccounts.teacher.password
          if (!validPassword) return res.status(401).json({ message: 'Invalid demo credentials.' })
          account = { ...savedTeacher, secret: savedTeacher.email, role: 'teacher' }
        }
      }
      if (role === 'parent') {
        const linkedStudent = demoStore.students.find((student) => String(student.usn).toUpperCase() === identifier.toUpperCase())
        account = demoParentForStudent(linkedStudent) || demoAccounts.parent
      }
      if (!account || identifier.toLowerCase() !== String(account.secret).toLowerCase() || (role !== 'teacher' && password !== account.password)) return res.status(401).json({ message: 'Invalid demo credentials.' })
      const requestedDepartment = cleanString(req.body.department).toUpperCase()
      if (requestedDepartment && !validDepartments.includes(requestedDepartment)) return res.status(422).json({ message: 'Choose a valid department.' })
      if (role !== 'admin' && requestedDepartment && requestedDepartment !== account.department) return res.status(403).json({ message: `This demo ${role} account is scoped to ${account.department}. Choose that department to continue.` })
      const user = { ...account, department: role === 'admin' ? requestedDepartment || account.department : account.department }
      return res.json({ token: sign(user), user: publicUser(user) })
    }

    let rows
    if (role === 'teacher') rows = await query('SELECT id, name, email, password_hash, department_code AS department, designation FROM teachers WHERE email = :identifier AND is_active = 1 LIMIT 1', { identifier: identifier.toLowerCase() })
    else if (role === 'student') rows = await query('SELECT id, name, usn, email, password_hash, department_code AS department, semester FROM students WHERE usn = :identifier AND is_active = 1 LIMIT 1', { identifier: identifier.toUpperCase() })
    else if (role === 'parent') rows = await query('SELECT p.id, p.name, p.email, p.password_hash, p.student_id AS studentId, s.usn, s.name AS studentName, s.department_code AS department, s.semester FROM parents p JOIN students s ON s.id = p.student_id WHERE s.usn = :identifier AND p.is_active = 1 AND s.is_active = 1 ORDER BY p.id LIMIT 1', { identifier: identifier.toUpperCase() })
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

app.get('/api/teachers', authRequired, roleRequired('admin'), async (req, res, next) => {
  try {
    const selectedDepartment = selectedAdminDepartment(req)
    const requestedDepartment = selectedDepartment || cleanString(req.query.department).toUpperCase()
    if (requestedDepartment && !validDepartments.includes(requestedDepartment)) return res.status(422).json({ message: 'Choose a valid department.' })
    if (useDemoData) {
      const data = demoStore.teachers.filter((teacher) => !requestedDepartment || teacher.department === requestedDepartment).map(publicTeacher)
      return res.json({ data })
    }
    const conditions = ['is_active = 1']
    const params = {}
    if (requestedDepartment) { conditions.push('department_code = :department'); params.department = requestedDepartment }
    const rows = await query(`SELECT id, employee_code AS employeeCode, name, email, department_code AS department, designation, phone, is_active AS isActive FROM teachers WHERE ${conditions.join(' AND ')} ORDER BY name`, params)
    res.json({ data: rows.map(publicTeacher) })
  } catch (error) { next(error) }
})

app.post('/api/teachers', authRequired, roleRequired('admin'), async (req, res, next) => {
  try {
    const input = {
      employeeCode: cleanString(req.body.employeeCode || req.body.employee_code).toUpperCase(),
      name: cleanString(req.body.name),
      email: cleanString(req.body.email).toLowerCase(),
      department: cleanString(req.body.department).toUpperCase(),
      designation: cleanString(req.body.designation),
      phone: cleanString(req.body.phone),
      password: cleanString(req.body.password),
    }
    const selectedDepartment = selectedAdminDepartment(req)
    const errors = []
    if (!/^[A-Z0-9][A-Z0-9-]{2,29}$/.test(input.employeeCode)) errors.push('Employee code must be 3–30 letters, numbers or hyphens.')
    if (!input.name) errors.push('Teacher name is required.')
    if (!isEmail(input.email)) errors.push('A valid teacher email is required.')
    if (!validDepartments.includes(input.department)) errors.push('Choose a valid department.')
    if (selectedDepartment && input.department !== selectedDepartment) errors.push(`This admin session is scoped to ${selectedDepartment}.`)
    if (input.designation.length > 100) errors.push('Designation must be 100 characters or fewer.')
    if (input.phone && !isPhone(input.phone)) errors.push('Phone number is invalid.')
    if (input.password.length < 8) errors.push('Password must be at least 8 characters.')
    if (errors.length) return res.status(422).json({ message: 'Teacher validation failed.', errors })
    const passwordHash = await bcrypt.hash(input.password, 10)
    if (useDemoData) {
      if (demoStore.teachers.some((teacher) => teacher.email.toLowerCase() === input.email || teacher.employeeCode.toUpperCase() === input.employeeCode)) return res.status(409).json({ message: 'A teacher with this email or employee code already exists.' })
      const teacher = { id: nextId(demoStore.teachers), employeeCode: input.employeeCode, name: input.name, email: input.email, department: input.department, designation: input.designation, phone: input.phone, isActive: true, initials: input.name.split(/\s+/).map((word) => word[0]).join('').slice(0, 2).toUpperCase(), passwordHash }
      demoStore.teachers.push(teacher)
      return res.status(201).json({ data: publicTeacher(teacher) })
    }
    const teacher = await transaction(async (connection) => {
      const [userResult] = await connection.query('INSERT INTO users (role, display_name, email, password_hash) VALUES (?, ?, ?, ?)', ['teacher', input.name, input.email, passwordHash])
      const [teacherResult] = await connection.query('INSERT INTO teachers (user_id, employee_code, name, email, password_hash, department_code, designation, phone) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [userResult.insertId, input.employeeCode, input.name, input.email, passwordHash, input.department, input.designation || null, input.phone || null])
      return { id: teacherResult.insertId, ...input, isActive: true }
    })
    res.status(201).json({ data: publicTeacher(teacher) })
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'A teacher with this email or employee code already exists.' })
    next(error)
  }
})

app.get('/api/sections', authRequired, roleRequired('teacher', 'admin'), async (req, res, next) => {
  try {
    const requestedDepartment = req.user.role === 'teacher' ? req.user.department : selectedAdminDepartment(req) || cleanString(req.query.department || req.user.department).toUpperCase()
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
    const adminDepartment = selectedAdminDepartment(req)
    const requestedDepartment = cleanString(req.body.department).toUpperCase()
    if (adminDepartment && requestedDepartment && requestedDepartment !== adminDepartment) return res.status(403).json({ message: 'This admin session is scoped to the selected department.' })
    const department = req.user.role === 'teacher' ? req.user.department : adminDepartment || requestedDepartment
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
        return { studentId: student.id, attendancePercentage: Number(record?.attendancePercentage || 0), averageInternalMarks: Number(record?.averageInternalMarks || 0) }
      })
      return res.json({ data })
    }
    const conditions = ['st.is_active=1', 'st.department_code=:department', 'st.semester=:semester']
    const params = { department: subject.department, semester: Number(subject.semester), subjectId: Number(subject.subjectId || subject.id) }
    if (section) { conditions.push('COALESCE(sec.section_name, st.section)=:section'); params.section = section }
    const rows = await query(`SELECT st.id AS studentId, COALESCE(sr.attendance_percentage, 0) AS attendancePercentage, COALESCE(sr.average_internal_marks, 0) AS averageInternalMarks FROM students st LEFT JOIN sections sec ON sec.section_id=st.section_id LEFT JOIN subject_records sr ON sr.student_id=st.id AND sr.subject_id=:subjectId WHERE ${conditions.join(' AND ')} ORDER BY st.usn`, params)
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
    const requestedDepartment = req.user.role === 'teacher' ? req.user.department : adminDepartment || cleanString(req.body.department).toUpperCase()
    if (adminDepartment && req.body.department && cleanString(req.body.department).toUpperCase() !== adminDepartment) return res.status(403).json({ message: 'This admin session is scoped to the selected department.' })
    const subject = await findSubject(Number(req.params.subjectId), requestedDepartment, semester)
    if (!subject) return res.status(404).json({ message: 'Subject not found in the selected scope.' })
    const attendancePercentage = Number(req.body.attendancePercentage)
    if (!Number.isFinite(attendancePercentage) || attendancePercentage < 0 || attendancePercentage > 100) return res.status(422).json({ message: 'Attendance Percentage must be between 0 and 100.' })
    const student = await subjectStudent(req, subject, req.body)
    if (!student) return res.status(403).json({ message: 'Student is outside the selected subject scope.' })
    const subjectId = Number(subject.subjectId || subject.id)
    if (useDemoData) {
      const current = demoStore.subjectRecords.find((item) => Number(item.subjectId) === subjectId && Number(item.studentId) === Number(student.id))
      if (current) current.attendancePercentage = attendancePercentage
      else demoStore.subjectRecords.push({ subjectId, studentId: Number(student.id), attendancePercentage, averageInternalMarks: 0 })
      return res.json({ data: { studentId: Number(student.id), attendancePercentage } })
    }
    await query('INSERT INTO subject_records (subject_id, student_id, attendance_percentage, average_internal_marks, recorded_by) VALUES (:subjectId, :studentId, :attendancePercentage, 0, :teacherId) ON DUPLICATE KEY UPDATE attendance_percentage=VALUES(attendance_percentage), recorded_by=VALUES(recorded_by)', { subjectId, studentId: Number(student.id), attendancePercentage, teacherId: req.user.role === 'teacher' ? req.user.sub : null })
    res.json({ data: { studentId: Number(student.id), attendancePercentage } })
  } catch (error) { next(error) }
})

app.put('/api/subjects/:subjectId/marks', authRequired, roleRequired('teacher', 'admin'), async (req, res, next) => {
  try {
    const semester = Number(req.body.semester)
    const adminDepartment = selectedAdminDepartment(req)
    const requestedDepartment = req.user.role === 'teacher' ? req.user.department : adminDepartment || cleanString(req.body.department).toUpperCase()
    if (adminDepartment && req.body.department && cleanString(req.body.department).toUpperCase() !== adminDepartment) return res.status(403).json({ message: 'This admin session is scoped to the selected department.' })
    const subject = await findSubject(Number(req.params.subjectId), requestedDepartment, semester)
    if (!subject) return res.status(404).json({ message: 'Subject not found in the selected scope.' })
    const averageInternalMarks = Number(req.body.averageInternalMarks)
    if (!Number.isFinite(averageInternalMarks) || averageInternalMarks < 0 || averageInternalMarks > 100) return res.status(422).json({ message: 'Average Internal Marks must be between 0 and 100.' })
    const student = await subjectStudent(req, subject, req.body)
    if (!student) return res.status(403).json({ message: 'Student is outside the selected subject scope.' })
    const subjectId = Number(subject.subjectId || subject.id)
    if (useDemoData) {
      const current = demoStore.subjectRecords.find((item) => Number(item.subjectId) === subjectId && Number(item.studentId) === Number(student.id))
      if (current) current.averageInternalMarks = averageInternalMarks
      else demoStore.subjectRecords.push({ subjectId, studentId: Number(student.id), attendancePercentage: 0, averageInternalMarks })
      return res.json({ data: { studentId: Number(student.id), averageInternalMarks } })
    }
    await query('INSERT INTO subject_records (subject_id, student_id, attendance_percentage, average_internal_marks, recorded_by) VALUES (:subjectId, :studentId, 0, :averageInternalMarks, :teacherId) ON DUPLICATE KEY UPDATE average_internal_marks=VALUES(average_internal_marks), recorded_by=VALUES(recorded_by)', { subjectId, studentId: Number(student.id), averageInternalMarks, teacherId: req.user.role === 'teacher' ? req.user.sub : null })
    res.json({ data: { studentId: Number(student.id), averageInternalMarks } })
  } catch (error) { next(error) }
})

app.get('/api/students', authRequired, async (req, res, next) => {
  try {
    const { search = '', semester, section, department, risk, result, page = 1, limit = 25, sortBy = 'usn', sortOrder = 'asc' } = req.query
    const adminDepartment = selectedAdminDepartment(req)
    const requestedDepartment = req.user.role === 'teacher' ? req.user.department : adminDepartment || (department && department !== 'all' ? cleanString(department).toUpperCase() : '')
    if (requestedDepartment && !validDepartments.includes(requestedDepartment)) return res.status(422).json({ message: 'Choose a valid department.' })
    if (semester && !validSemesters.includes(Number(semester))) return res.status(422).json({ message: 'Semester must be between 1 and 8.' })
    if (useDemoData) {
      let items = demoStore.students.filter((student) => scopeStudent(req, student)
        && (!requestedDepartment || student.department === requestedDepartment)
        && (!semester || Number(student.semester) === Number(semester))
        && (!section || String(student.section).toUpperCase() === String(section).toUpperCase())
        && (!risk || normalizeRisk(student.risk) === normalizeRisk(risk))
        && (!result || student.result === result)
        && `${student.name} ${student.usn}`.toLowerCase().includes(String(search).toLowerCase()))
      const allowedSort = ['usn', 'name', 'semester', 'attendancePercentage', 'averageInternalMarks', 'averageAssignmentScore', 'previousGpa', 'currentGpa', 'participationScore', 'result', 'risk']
      const safeSort = allowedSort.includes(sortBy) ? sortBy : 'usn'
      items.sort((a, b) => String(a[safeSort] ?? '').localeCompare(String(b[safeSort] ?? ''), undefined, { numeric: true }) * (sortOrder === 'desc' ? -1 : 1))
      const total = items.length
      const start = (Number(page) - 1) * Number(limit)
      return res.json({ data: items.slice(start, start + Number(limit)).map(mapStudentRow), pagination: { page: Number(page), limit: Number(limit), total, pages: Math.max(1, Math.ceil(total / Number(limit))) } })
    }
    const allowedSort = ['usn', 'name', 'semester', 'attendancePercentage', 'averageInternalMarks', 'averageAssignmentScore', 'previousGpa', 'currentGpa', 'participationScore', 'result', 'risk']
    const safeSort = allowedSort.includes(sortBy) ? sortBy : 'usn'
    const dbSort = { usn: 's.usn', name: 's.name', semester: 's.semester', attendancePercentage: 's.attendance_percentage', averageInternalMarks: 's.average_internal_marks', averageAssignmentScore: 's.average_assignment_score', previousGpa: 's.previous_gpa', currentGpa: 's.current_gpa', participationScore: 's.participation_score', result: 's.result', risk: 's.risk' }
    const order = sortOrder === 'desc' ? 'DESC' : 'ASC'
    const conditions = ['s.is_active = 1']
    const params = {}
    if (req.user.role === 'teacher') { conditions.push('s.department_code = :teacherDepartment'); params.teacherDepartment = req.user.department }
    else if (req.user.role === 'student' || req.user.role === 'parent') { conditions.push('s.usn = :userUsn'); params.userUsn = req.user.usn }
    else if (requestedDepartment) { conditions.push('s.department_code = :department'); params.department = requestedDepartment }
    if (semester) { conditions.push('s.semester = :semester'); params.semester = Number(semester) }
    if (section) { conditions.push('COALESCE(sec.section_name, s.section) = :section'); params.section = String(section).toUpperCase() }
    if (risk) { conditions.push('s.risk = :risk'); params.risk = normalizeRisk(risk) }
    if (result) { conditions.push('s.result = :result'); params.result = result === 'Pass' ? 'Pass' : 'Fail' }
    if (search) { conditions.push('(s.name LIKE :search OR s.usn LIKE :search)'); params.search = `%${search}%` }
    const where = conditions.join(' AND ')
    const rows = await query(`SELECT s.*, sec.section_name AS sectionName FROM students s LEFT JOIN sections sec ON sec.section_id=s.section_id WHERE ${where} ORDER BY ${dbSort[safeSort]} ${order} LIMIT :limit OFFSET :offset`, { ...params, limit: Number(limit), offset: (Number(page) - 1) * Number(limit) })
    const countRows = await query(`SELECT COUNT(*) AS total FROM students s LEFT JOIN sections sec ON sec.section_id=s.section_id WHERE ${where}`, params)
    const total = Number(countRows[0]?.total || rows.length)
    res.json({ data: rows.map(mapStudentRow), pagination: { page: Number(page), limit: Number(limit), total, pages: Math.max(1, Math.ceil(total / Number(limit))) } })
  } catch (error) { next(error) }
})

app.post('/api/students', authRequired, roleRequired('teacher', 'admin'), async (req, res, next) => {
  try {
    const input = { ...req.body, department: cleanString(req.body.department).toUpperCase(), semester: Number(req.body.semester), section: cleanString(req.body.section || 'A').toUpperCase() }
    const adminDepartment = selectedAdminDepartment(req)
    if (req.user.role === 'teacher' && input.department !== req.user.department) return res.status(403).json({ message: 'Teachers may only add students in their department.' })
    if (adminDepartment && input.department !== adminDepartment) return res.status(403).json({ message: 'This admin session is scoped to the selected department.' })
    const existing = useDemoData ? demoStore.students : []
    const errors = validateStudent(input, existing)
    if (errors.length) return res.status(422).json({ message: 'Student validation failed.', errors })
    const student = normalizeStudent(input)
    if (useDemoData) {
      if (!demoSection(student.department, student.semester, student.section)) return res.status(422).json({ message: `Section ${student.section} does not exist for ${student.department} Semester ${student.semester}.` })
      demoStore.students.unshift(student)
      return res.status(201).json({ data: student })
    }
    const sectionRow = await findSection(student.department, student.semester, student.section)
    if (!sectionRow) return res.status(422).json({ message: `Section ${student.section} does not exist for ${student.department} Semester ${student.semester}.` })
    const insertResult = await query('INSERT INTO students (usn, name, department_code, semester, section, section_id, gender, date_of_birth, blood_group, address, email, phone, parent_name, father_name, mother_name, parent_phone, parent_email, certifications, skills, attendance_percentage, average_internal_marks, average_assignment_score, previous_gpa, current_gpa, participation_score, result, risk) VALUES (:usn, :name, :department, :semester, :section, :sectionId, :gender, :dateOfBirth, :bloodGroup, :address, :email, :phone, :parentName, :fatherName, :motherName, :parentPhone, :parentEmail, :certifications, :skills, :attendancePercentage, :averageInternalMarks, :averageAssignmentScore, :previousGpa, :currentGpa, :participationScore, :result, :risk)', { ...student, sectionId: sectionRow.sectionId, dateOfBirth: student.dateOfBirth || null, bloodGroup: student.bloodGroup || null, address: student.address || null, fatherName: student.fatherName || null, motherName: student.motherName || null, parentEmail: student.parentEmail || null, parentPhone: student.parentPhone || null, certifications: JSON.stringify(student.certifications || []), skills: JSON.stringify(student.skills || []) })
    res.status(201).json({ data: { ...student, id: insertResult.insertId, sectionId: sectionRow.sectionId } })
  } catch (error) {
    console.error('[students] Create request failed', { method: req.method, path: req.originalUrl, userId: req.user?.sub, role: req.user?.role, department: req.body?.department, semester: req.body?.semester, section: req.body?.section, code: error.code, message: error.message })
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'A student with this USN already exists.', errors: ['USN already exists.'] })
    next(error)
  }
})

app.put('/api/students/:id', authRequired, roleRequired('teacher', 'admin'), async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    if (req.user.role === 'teacher' && req.body.department && cleanString(req.body.department).toUpperCase() !== req.user.department) return res.status(403).json({ message: 'Teachers may only keep students in their department.' })
    if (useDemoData) {
      const index = demoStore.students.findIndex((student) => student.id === id)
      if (index < 0) return res.status(404).json({ message: 'Student not found.' })
      if (!scopeStudent(req, demoStore.students[index])) return res.status(403).json({ message: 'Student is outside your access scope.' })
      const merged = { ...demoStore.students[index], ...req.body, id, department: cleanString(req.body.department || demoStore.students[index].department).toUpperCase(), semester: Number(req.body.semester || demoStore.students[index].semester), section: cleanString(req.body.section || demoStore.students[index].section || 'A').toUpperCase() }
      const errors = validateStudent(merged, demoStore.students)
      if (errors.length) return res.status(422).json({ message: 'Student validation failed.', errors })
      const normalized = normalizeStudent(merged, id)
      const adminDepartment = selectedAdminDepartment(req)
      if (adminDepartment && normalized.department !== adminDepartment) return res.status(403).json({ message: 'This admin session is scoped to the selected department.' })
      if (!demoSection(normalized.department, normalized.semester, normalized.section)) return res.status(422).json({ message: `Section ${normalized.section} does not exist for ${normalized.department} Semester ${normalized.semester}.` })
      demoStore.students[index] = normalized
      return res.json({ data: normalized })
    }
    const rows = await query('SELECT * FROM students WHERE id = :id AND is_active = 1 LIMIT 1', { id })
    if (!rows[0] || !scopeStudent(req, { ...rows[0], department: rows[0].department_code })) return res.status(404).json({ message: 'Student not found.' })
    const merged = { ...rows[0], ...req.body, id, department: cleanString(req.body.department || rows[0].department_code).toUpperCase(), semester: Number(req.body.semester || rows[0].semester), section: cleanString(req.body.section || rows[0].section || 'A').toUpperCase() }
    const errors = validateStudent(merged, [])
    if (errors.length) return res.status(422).json({ message: 'Student validation failed.', errors })
    const student = normalizeStudent(merged, id)
    const adminDepartment = selectedAdminDepartment(req)
    if (adminDepartment && student.department !== adminDepartment) return res.status(403).json({ message: 'This admin session is scoped to the selected department.' })
    const sectionRow = await findSection(student.department, student.semester, student.section)
    if (!sectionRow) return res.status(422).json({ message: `Section ${student.section} does not exist for ${student.department} Semester ${student.semester}.` })
    await query('UPDATE students SET usn=:usn, name=:name, department_code=:department, semester=:semester, section=:section, section_id=:sectionId, gender=:gender, date_of_birth=:dateOfBirth, blood_group=:bloodGroup, address=:address, email=:email, phone=:phone, parent_name=:parentName, father_name=:fatherName, mother_name=:motherName, parent_phone=:parentPhone, parent_email=:parentEmail, certifications=:certifications, skills=:skills, attendance_percentage=:attendancePercentage, average_internal_marks=:averageInternalMarks, average_assignment_score=:averageAssignmentScore, previous_gpa=:previousGpa, current_gpa=:currentGpa, participation_score=:participationScore, result=:result, risk=:risk WHERE id=:id', { ...student, id, sectionId: sectionRow.sectionId, dateOfBirth: student.dateOfBirth || null, bloodGroup: student.bloodGroup || null, address: student.address || null, fatherName: student.fatherName || null, motherName: student.motherName || null, parentEmail: student.parentEmail || null, parentPhone: student.parentPhone || null, certifications: JSON.stringify(normalizeList(student.certifications)), skills: JSON.stringify(normalizeList(student.skills)) })
    res.json({ data: { ...student, id, sectionId: sectionRow.sectionId } })
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
    const rows = await query('SELECT id, usn, department_code AS department FROM students WHERE id = :id AND is_active = 1 LIMIT 1', { id })
    if (!rows[0]) return res.status(404).json({ message: 'Student not found.' })
    if (!scopeStudent(req, rows[0])) return res.status(403).json({ message: 'Student is outside your access scope.' })
    await query('UPDATE students SET is_active = 0 WHERE id = :id', { id })
    res.json({ ok: true })
  } catch (error) { next(error) }
})

app.post('/api/students/upload', authRequired, roleRequired('teacher', 'admin'), upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Please attach an .xlsx or .csv file.' })
    const adminDepartment = selectedAdminDepartment(req)
    const uploadDepartment = cleanString(req.body.department || adminDepartment || (req.user.department === 'ALL' ? '' : req.user.department)).toUpperCase()
    const requestedSemester = req.body.semester ? Number(req.body.semester) : 0
    const requestedSection = cleanString(req.body.section).toUpperCase()
    if (req.user.role === 'teacher' && uploadDepartment !== req.user.department) return res.status(403).json({ message: 'Teachers may only import students into their department.' })
    if (adminDepartment && uploadDepartment && uploadDepartment !== adminDepartment) return res.status(403).json({ message: 'This admin session is scoped to the selected department.' })
    if (uploadDepartment && !validDepartments.includes(uploadDepartment)) return res.status(422).json({ message: 'Choose a valid department for this upload.' })
    if (requestedSemester && !validSemesters.includes(requestedSemester)) return res.status(422).json({ message: 'Semester must be between 1 and 8.' })
    if (req.user.role === 'teacher' && (!requestedSemester || !requestedSection)) return res.status(422).json({ message: 'Open a semester section before importing students. Department, semester and section are required.' })

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rawRows = sheet ? XLSX.utils.sheet_to_json(sheet, { defval: '' }) : []
    const cell = (row, labels, fallback = '') => { for (const label of labels) if (row[label] !== '' && row[label] !== undefined && row[label] !== null) return row[label]; return fallback }
    const rows = rawRows.map((row, index) => normalizeStudent({
      usn: cell(row, ['USN', 'usn']),
      name: cell(row, ['Name', 'name']),
      department: cell(row, ['Department', 'department'], uploadDepartment),
      semester: cell(row, ['Semester', 'semester'], requestedSemester),
      section: cell(row, ['Section', 'section'], requestedSection || 'A'),
      email: cell(row, ['Email', 'email']),
      phone: cell(row, ['Phone', 'phone']),
      parentName: cell(row, ['Parent Name', 'parentName']),
      parentPhone: cell(row, ['Parent Phone', 'parentPhone']),
      fatherName: cell(row, ['Father Name', 'fatherName']),
      motherName: cell(row, ['Mother Name', 'motherName']),
      parentEmail: cell(row, ['Parent Email', 'parentEmail']),
      dateOfBirth: cell(row, ['Date of Birth', 'dateOfBirth']),
      bloodGroup: cell(row, ['Blood Group', 'bloodGroup']),
      address: cell(row, ['Address', 'address']),
      certifications: cell(row, ['Certifications', 'certifications']),
      skills: cell(row, ['Skills', 'skills']),
      attendancePercentage: cell(row, ['Attendance Percentage', 'AttendancePercentage', 'attendancePercentage']),
      averageInternalMarks: cell(row, ['Average Internal Marks', 'AverageInternalMarks', 'averageInternalMarks']),
      averageAssignmentScore: cell(row, ['Average Assignment Score', 'AverageAssignmentScore', 'averageAssignmentScore']),
      previousGpa: cell(row, ['Previous GPA', 'PreviousGPA', 'previousGpa']),
      currentGpa: cell(row, ['Current GPA', 'CurrentGPA', 'currentGpa']),
      participationScore: cell(row, ['Participation Score', 'ParticipationScore', 'participationScore']),
    }, Date.now() + index))
    const existing = useDemoData ? demoStore.students : (await query('SELECT id, usn FROM students WHERE is_active=1')).map((row) => ({ id: row.id, usn: row.usn }))
    const existingUsns = new Set(existing.map((student) => cleanString(student.usn).toUpperCase()).filter(Boolean))
    const seen = new Set()
    const sectionCache = new Map()
    const requiredAcademic = ['attendancePercentage', 'averageInternalMarks', 'averageAssignmentScore', 'previousGpa', 'currentGpa', 'participationScore']
    const academicLabels = { attendancePercentage: 'Attendance Percentage', averageInternalMarks: 'Average Internal Marks', averageAssignmentScore: 'Average Assignment Score', previousGpa: 'Previous GPA', currentGpa: 'Current GPA', participationScore: 'Participation Score' }
    const getSection = async (row) => {
      const key = `${row.department}-${row.semester}-${row.section}`
      if (!sectionCache.has(key)) sectionCache.set(key, useDemoData ? Boolean(demoSection(row.department, row.semester, row.section)) : Boolean(await findSection(row.department, row.semester, row.section)))
      return sectionCache.get(key)
    }
    const evaluated = []
    for (const [index, row] of rows.entries()) {
      const scopeIssues = []
      const validationIssues = validateStudent(row, [])
      const duplicateIssues = []
      const source = rawRows[index]
      if (req.user.role === 'teacher' && row.department !== req.user.department) scopeIssues.push(`Department must be ${req.user.department} for this teacher.`)
      if (uploadDepartment && row.department !== uploadDepartment) scopeIssues.push(`Department must be ${uploadDepartment} for this upload.`)
      if (requestedSemester && Number(row.semester) !== requestedSemester) scopeIssues.push(`Semester must be ${requestedSemester} for this upload.`)
      if (requestedSection && row.section !== requestedSection) scopeIssues.push(`Section must be ${requestedSection} for this upload.`)
      for (const key of requiredAcademic) {
        const label = academicLabels[key]
        const raw = cell(source, [label, key.replace(/[A-Z]/g, (character) => character.toUpperCase()), key])
        if (raw === '' || raw === undefined || raw === null || !Number.isFinite(Number(raw))) validationIssues.push(`${label} must be numeric and is required.`)
      }
      if (!scopeIssues.length && (!validDepartments.includes(row.department) || !validSemesters.includes(Number(row.semester)) || !(await getSection(row)))) validationIssues.push(`Section ${row.section} does not exist for ${row.department} Semester ${row.semester}.`)
      if (row.usn && seen.has(row.usn)) duplicateIssues.push('Duplicate USN in upload.')
      if (row.usn && existingUsns.has(row.usn)) duplicateIssues.push('USN already exists.')
      if (row.usn) seen.add(row.usn)
      const issues = [...new Set([...scopeIssues, ...duplicateIssues, ...validationIssues])]
      const status = scopeIssues.length ? 'out-of-scope' : duplicateIssues.length ? 'duplicate' : validationIssues.length ? 'invalid' : 'ready'
      evaluated.push({ row, rowNumber: index + 2, status, scopeMatch: scopeIssues.length === 0, ready: status === 'ready', issues, scopeIssues, duplicateIssues, validationIssues })
    }
    const makeSummary = (imported = 0) => ({
      total: evaluated.length,
      matching: evaluated.filter((entry) => entry.scopeMatch).length,
      ready: evaluated.filter((entry) => entry.ready).length,
      skipped: evaluated.filter((entry) => !entry.ready).length,
      outOfScope: evaluated.filter((entry) => entry.status === 'out-of-scope').length,
      duplicates: evaluated.filter((entry) => entry.status === 'duplicate').length,
      invalid: evaluated.filter((entry) => entry.status === 'invalid').length,
      imported,
    })
    const toPreview = () => evaluated.map(({ row, ...meta }) => ({ ...row, ...meta }))
    const errors = () => evaluated.flatMap((entry) => entry.issues.map((message) => `Row ${entry.rowNumber}: ${message}`))
    let summary = makeSummary()
    console.info('[students-import] Scope preview', { userId: req.user?.sub, role: req.user?.role, department: uploadDepartment, semester: requestedSemester, section: requestedSection, ...summary })
    if (String(req.body.commit) !== 'true') return res.json({ preview: toPreview(), errors: errors(), valid: summary.ready === summary.total, rowCount: rows.length, summary })

    const readyEntries = evaluated.filter((entry) => entry.ready)
    if (!readyEntries.length) return res.status(422).json({ message: 'No valid students match the selected department, semester and section.', errors: errors(), preview: toPreview(), summary })
    const importedRows = []
    if (useDemoData) {
      demoStore.students.unshift(...readyEntries.map((entry) => entry.row))
      importedRows.push(...readyEntries.map((entry) => entry.row))
    } else {
      for (const entry of readyEntries) {
        const row = entry.row
        try {
          const sectionRow = await findSection(row.department, row.semester, row.section)
          const insertResult = await query('INSERT INTO students (usn, name, department_code, semester, section, section_id, gender, date_of_birth, blood_group, address, email, phone, parent_name, father_name, mother_name, parent_phone, parent_email, certifications, skills, attendance_percentage, average_internal_marks, average_assignment_score, previous_gpa, current_gpa, participation_score, result, risk) VALUES (:usn, :name, :department, :semester, :section, :sectionId, :gender, :dateOfBirth, :bloodGroup, :address, :email, :phone, :parentName, :fatherName, :motherName, :parentPhone, :parentEmail, :certifications, :skills, :attendancePercentage, :averageInternalMarks, :averageAssignmentScore, :previousGpa, :currentGpa, :participationScore, :result, :risk)', { ...row, sectionId: sectionRow.sectionId, dateOfBirth: row.dateOfBirth || null, bloodGroup: row.bloodGroup || null, address: row.address || null, fatherName: row.fatherName || null, motherName: row.motherName || null, parentEmail: row.parentEmail || null, parentPhone: row.parentPhone || null, certifications: JSON.stringify(row.certifications || []), skills: JSON.stringify(row.skills || []) })
          importedRows.push({ ...row, id: insertResult.insertId })
        } catch (error) {
          if (error.code !== 'ER_DUP_ENTRY') throw error
          entry.status = 'duplicate'
          entry.ready = false
          entry.duplicateIssues.push('USN already exists.')
          entry.issues = [...new Set([...entry.issues, 'USN already exists.'])]
          console.warn('[students-import] Duplicate skipped during insert', { userId: req.user?.sub, usn: row.usn, department: row.department, semester: row.semester, section: row.section })
        }
      }
    }
    summary = makeSummary(importedRows.length)
    if (!importedRows.length) return res.status(422).json({ message: 'No students were imported. All rows were skipped or invalid.', errors: errors(), preview: toPreview(), summary })
    console.info('[students-import] Import complete', { userId: req.user?.sub, role: req.user?.role, department: uploadDepartment, semester: requestedSemester, section: requestedSection, ...summary })
    res.status(201).json({ imported: importedRows.length, data: importedRows.map((row) => useDemoData ? row : mapStudentRow(row)), preview: toPreview(), summary, errors: errors() })
  } catch (error) {
    console.error('[students-import] Upload failed', { userId: req.user?.sub, role: req.user?.role, department: req.body?.department, semester: req.body?.semester, section: req.body?.section, code: error.code, message: error.message })
    next(error)
  }
})

app.get('/api/students/export', authRequired, roleRequired('teacher', 'admin'), async (req, res, next) => {
  try {
    const adminDepartment = selectedAdminDepartment(req)
    let rows
    if (useDemoData) rows = demoStore.students.filter((student) => scopeStudent(req, student) && (!adminDepartment || student.department === adminDepartment)).map(mapStudentRow)
    else {
      const scopeClause = req.user.role === 'teacher' ? ' AND s.department_code = :department' : adminDepartment ? ' AND s.department_code = :department' : ''
      const params = req.user.role === 'teacher' || adminDepartment ? { department: req.user.role === 'teacher' ? req.user.department : adminDepartment } : {}
      const dbRows = await query(`SELECT s.usn AS USN, s.name AS Name, s.department_code AS Department, s.semester AS Semester, COALESCE(sec.section_name, s.section) AS Section, s.gender AS Gender, s.date_of_birth AS \`Date of Birth\`, s.blood_group AS \`Blood Group\`, s.address AS Address, s.email AS Email, s.phone AS Phone, s.parent_name AS \`Parent Name\`, s.father_name AS \`Father Name\`, s.mother_name AS \`Mother Name\`, s.parent_phone AS \`Parent Phone\`, s.parent_email AS \`Parent Email\`, s.certifications AS Certifications, s.skills AS Skills, s.attendance_percentage AS \`Attendance Percentage\`, s.average_internal_marks AS \`Average Internal Marks\`, s.average_assignment_score AS \`Average Assignment Score\`, s.previous_gpa AS \`Previous GPA\`, s.current_gpa AS \`Current GPA\`, s.participation_score AS \`Participation Score\`, s.result AS Result, s.risk AS Risk FROM students s LEFT JOIN sections sec ON sec.section_id=s.section_id WHERE s.is_active = 1${scopeClause} ORDER BY s.department_code, s.semester, s.usn`, params)
      rows = dbRows
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
    const requestedDepartment = req.user.role === 'teacher' ? req.user.department : selectedAdminDepartment(req) || (cleanString(req.query.department).toUpperCase() || (req.user.department === 'ALL' ? '' : req.user.department))
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

const messageRoles = new Set(['admin', 'teacher', 'student', 'parent'])

async function findMessageTarget(role, id) {
  const normalizedRole = cleanString(role).toLowerCase()
  const targetId = Number(id)
  if (!messageRoles.has(normalizedRole) || !Number.isInteger(targetId) || targetId <= 0) return null
  if (useDemoData) {
    if (normalizedRole === 'parent') {
      const student = demoStore.students.find((item) => Number(demoParentForStudent(item)?.id) === targetId)
      return student ? { id: targetId, role: normalizedRole, name: demoParentForStudent(student).name, email: demoParentForStudent(student).email, studentId: Number(student.id), studentName: student.name, usn: student.usn, department: student.department, semester: Number(student.semester), section: student.section } : null
    }
    if (normalizedRole === 'student') {
      const student = demoStore.students.find((item) => Number(item.id) === targetId)
      return student ? { id: Number(student.id), role: normalizedRole, name: student.name, email: student.email, studentId: Number(student.id), studentName: student.name, usn: student.usn, department: student.department, semester: Number(student.semester), section: student.section } : null
    }
    if (normalizedRole === 'teacher') {
      const teacher = demoStore.teachers.find((item) => Number(item.id) === targetId)
      return teacher ? { id: Number(teacher.id), role: normalizedRole, name: teacher.name, email: teacher.email, department: teacher.department } : null
    }
    const admin = demoAccounts.admin
    return targetId === Number(admin.id) ? { id: targetId, role: normalizedRole, name: admin.name, email: admin.email, department: admin.department } : null
  }
  if (normalizedRole === 'parent') {
    const rows = await query('SELECT p.id, p.name, p.email, p.student_id AS studentId, s.name AS studentName, s.usn, s.department_code AS department, s.semester, COALESCE(sec.section_name, s.section) AS section FROM parents p JOIN students s ON s.id=p.student_id LEFT JOIN sections sec ON sec.section_id=s.section_id WHERE p.id=:id AND p.is_active=1 AND s.is_active=1 LIMIT 1', { id: targetId })
    return rows[0] ? { ...rows[0], id: Number(rows[0].id), role: normalizedRole, studentId: Number(rows[0].studentId), semester: Number(rows[0].semester) } : null
  }
  if (normalizedRole === 'student') {
    const rows = await query('SELECT id, name, email, usn, department_code AS department, semester, COALESCE(sec.section_name, section) AS section FROM students s LEFT JOIN sections sec ON sec.section_id=s.section_id WHERE s.id=:id AND s.is_active=1 LIMIT 1', { id: targetId })
    return rows[0] ? { ...rows[0], id: Number(rows[0].id), role: normalizedRole, studentId: Number(rows[0].id), studentName: rows[0].name, semester: Number(rows[0].semester) } : null
  }
  if (normalizedRole === 'teacher') {
    const rows = await query('SELECT id, name, email, department_code AS department FROM teachers WHERE id=:id AND is_active=1 LIMIT 1', { id: targetId })
    return rows[0] ? { ...rows[0], id: Number(rows[0].id), role: normalizedRole } : null
  }
  const rows = await query('SELECT id, name, email FROM admins WHERE id=:id AND is_active=1 LIMIT 1', { id: targetId })
  return rows[0] ? { ...rows[0], id: Number(rows[0].id), role: normalizedRole, department: 'ALL' } : null
}

async function findMessageStudent(studentId, usn = '') {
  if (studentId) {
    const id = Number(studentId)
    if (useDemoData) return demoStore.students.find((student) => Number(student.id) === id) || null
    const rows = await query('SELECT s.id, s.usn, s.name, s.department_code AS department, s.semester, COALESCE(sec.section_name, s.section) AS section, s.section_id AS sectionId FROM students s LEFT JOIN sections sec ON sec.section_id=s.section_id WHERE s.id=:id AND s.is_active=1 LIMIT 1', { id })
    return rows[0] || null
  }
  if (!usn) return null
  if (useDemoData) return demoStore.students.find((student) => String(student.usn).toUpperCase() === String(usn).toUpperCase()) || null
  const rows = await query('SELECT s.id, s.usn, s.name, s.department_code AS department, s.semester, COALESCE(sec.section_name, s.section) AS section, s.section_id AS sectionId FROM students s LEFT JOIN sections sec ON sec.section_id=s.section_id WHERE s.usn=:usn AND s.is_active=1 LIMIT 1', { usn: String(usn).toUpperCase() })
  return rows[0] || null
}

async function findParentForStudent(studentId) {
  if (useDemoData) {
    const student = demoStore.students.find((item) => Number(item.id) === Number(studentId))
    const parent = demoParentForStudent(student)
    return parent ? { id: parent.id, role: 'parent', name: parent.name, email: parent.email, studentId: Number(student.id), studentName: student.name, usn: student.usn, department: student.department, semester: Number(student.semester), section: student.section } : null
  }
  const rows = await query('SELECT p.id, p.name, p.email, p.student_id AS studentId, s.name AS studentName, s.usn, s.department_code AS department, s.semester, COALESCE(sec.section_name, s.section) AS section FROM parents p JOIN students s ON s.id=p.student_id LEFT JOIN sections sec ON sec.section_id=s.section_id WHERE p.student_id=:studentId AND p.is_active=1 AND s.is_active=1 ORDER BY p.id LIMIT 1', { studentId: Number(studentId) })
  return rows[0] ? { ...rows[0], id: Number(rows[0].id), role: 'parent', studentId: Number(rows[0].studentId), semester: Number(rows[0].semester) } : null
}

function messageScopeMatches(message, department, semester, section) {
  return (!department || !message.department || message.department === department)
    && (!semester || !message.semester || Number(message.semester) === Number(semester))
    && (!section || !message.section || String(message.section).toUpperCase() === section)
}

app.get('/api/messages', authRequired, async (req, res, next) => {
  try {
    const requestedDepartment = req.user.role === 'teacher' ? req.user.department : selectedAdminDepartment(req) || (cleanString(req.query.department).toUpperCase() || (req.user.department === 'ALL' ? '' : req.user.department))
    const requestedSemester = req.query.semester || (req.user.role === 'student' || req.user.role === 'parent' ? req.user.semester : '')
    const requestedSection = req.query.section ? String(req.query.section).toUpperCase() : ''
    if (useDemoData) {
      const messages = demoStore.messages.filter((message) => {
        const directReceiver = Number(message.receiverId || message.receiver_id) === Number(req.user.sub) && String(message.receiverRole || message.receiver_role || '').toLowerCase() === req.user.role
        const directSender = Number(message.senderId || message.sender_id) === Number(req.user.sub) && String(message.senderRole || message.sender_role || '').toLowerCase() === req.user.role
        const legacyMatch = !message.receiverId && (req.user.role === 'teacher' || req.user.role === 'admin' || String(message.recipient || '').toLowerCase().includes(String(req.user.name || req.user.usn).toLowerCase()) || (req.user.role === 'student' && String(message.recipient || '').toLowerCase().includes(String(req.user.name || '').toLowerCase())))
        const visible = req.user.role === 'teacher' || req.user.role === 'admin' ? directReceiver || directSender || legacyMatch : directReceiver || legacyMatch
        return visible && messageScopeMatches(message, requestedDepartment, requestedSemester, requestedSection)
      }).map(mapMessageRow)
      return res.json({ data: messages, unreadCount: messages.filter((message) => !message.read && ((Number(message.receiverId || message.receiver_id) === Number(req.user.sub) && String(message.receiverRole || message.receiver_role || '').toLowerCase() === String(req.user.role).toLowerCase()) || (!message.receiverId && message.sender !== req.user.name))).length })
    }
    const params = { currentId: Number(req.user.sub), currentRole: req.user.role }
    const direct = req.user.role === 'teacher' || req.user.role === 'admin'
      ? '((m.receiver_id=:currentId AND m.receiver_role=:currentRole) OR (m.sender_id=:currentId AND m.sender_role=:currentRole) OR (m.receiver_id IS NULL AND m.sender_id=:currentId))'
      : '(m.receiver_id=:currentId AND m.receiver_role=:currentRole)'
    const conditions = [direct]
    if (requestedDepartment) { conditions.push('(m.department_code=:department OR m.department_code IS NULL)'); params.department = requestedDepartment }
    if (requestedSemester) { conditions.push('(m.semester=:semester OR m.semester IS NULL)'); params.semester = Number(requestedSemester) }
    if (requestedSection) { conditions.push('(sec.section_name=:section OR m.section_id IS NULL)'); params.section = requestedSection }
    const rows = await query(`SELECT m.*, COALESCE(
      CASE WHEN m.sender_role='teacher' THEN st.name WHEN m.sender_role='parent' THEN sp.name WHEN m.sender_role='student' THEN ss.name WHEN m.sender_role='admin' THEN sa.name END,
      legacy_sender.display_name, 'CAMPS'
    ) AS sender_name,
    COALESCE(
      CASE WHEN m.receiver_role='teacher' THEN rt.name WHEN m.receiver_role='parent' THEN rp.name WHEN m.receiver_role='student' THEN rs.name WHEN m.receiver_role='admin' THEN ra.name END,
      m.recipient_scope, 'Recipient'
    ) AS recipient_name,
    sec.section_name AS sectionName
    FROM messages m
    LEFT JOIN users legacy_sender ON legacy_sender.id=m.sender_id AND m.sender_role IS NULL
    LEFT JOIN teachers st ON m.sender_role='teacher' AND st.id=m.sender_id
    LEFT JOIN parents sp ON m.sender_role='parent' AND sp.id=m.sender_id
    LEFT JOIN students ss ON m.sender_role='student' AND ss.id=m.sender_id
    LEFT JOIN admins sa ON m.sender_role='admin' AND sa.id=m.sender_id
    LEFT JOIN teachers rt ON m.receiver_role='teacher' AND rt.id=m.receiver_id
    LEFT JOIN parents rp ON m.receiver_role='parent' AND rp.id=m.receiver_id
    LEFT JOIN students rs ON m.receiver_role='student' AND rs.id=m.receiver_id
    LEFT JOIN admins ra ON m.receiver_role='admin' AND ra.id=m.receiver_id
    LEFT JOIN sections sec ON sec.section_id=m.section_id
    WHERE ${conditions.join(' AND ')} ORDER BY m.created_at DESC`, params)
    const data = rows.map(mapMessageRow)
    res.json({ data, unreadCount: data.filter((message) => !message.read && Number(message.receiverId) === Number(req.user.sub) && String(message.receiverRole).toLowerCase() === String(req.user.role).toLowerCase()).length })
  } catch (error) { next(error) }
})

app.post('/api/messages/send', authRequired, async (req, res, next) => {
  try {
    if (!['teacher', 'admin', 'parent', 'student'].includes(req.user.role)) return res.status(403).json({ message: 'This account cannot send messages.' })
    const subject = cleanString(req.body.subject)
    const body = cleanString(req.body.body || req.body.content)
    const receiverRole = cleanString(req.body.recipientRole || req.body.receiverRole).toLowerCase()
    let receiverId = Number(req.body.recipientId || req.body.receiverId || req.body.parentId || req.body.teacherId || 0)
    let linkedStudent = await findMessageStudent(req.body.studentId, req.user.role === 'parent' || req.user.role === 'student' ? req.user.usn : '')
    if (!subject || !body) return res.status(422).json({ message: 'Subject and message content are required.' })
    if (subject.length > 180) return res.status(422).json({ message: 'Subject must be 180 characters or fewer.' })
    if (body.length > 10000) return res.status(422).json({ message: 'Message content must be 10,000 characters or fewer.' })
    if (!messageRoles.has(receiverRole)) return res.status(422).json({ message: 'Select a specific student, parent or teacher recipient.' })
    if (receiverRole === req.user.role && receiverRole !== 'admin') return res.status(422).json({ message: 'Choose a different recipient.' })

    let target = receiverId ? await findMessageTarget(receiverRole, receiverId) : null
    if (receiverRole === 'parent' && !target && linkedStudent) target = await findParentForStudent(linkedStudent.id)
    if (!target) return res.status(404).json({ message: 'The selected recipient could not be found.' })
    receiverId = Number(target.id)
    if (target.studentId) {
      if (linkedStudent && Number(linkedStudent.id) !== Number(target.studentId)) return res.status(403).json({ message: 'The selected recipient does not match the selected student.' })
      linkedStudent = await findMessageStudent(target.studentId)
      if (!linkedStudent) return res.status(404).json({ message: 'The recipient is not linked to an active student.' })
    }
    if (req.user.role === 'parent' || req.user.role === 'student') {
      const ownStudent = await findMessageStudent(null, req.user.usn)
      if (!ownStudent || !linkedStudent || Number(ownStudent.id) !== Number(linkedStudent.id)) return res.status(403).json({ message: 'You may only message the teacher for your linked student.' })
      if (!['teacher', 'admin'].includes(receiverRole)) return res.status(403).json({ message: 'Parents and students may reply only to a teacher or administrator.' })
    } else if (linkedStudent && !scopeStudent(req, { ...linkedStudent, department: linkedStudent.department })) {
      return res.status(403).json({ message: 'The selected recipient is outside your access scope.' })
    }
    const requestedDepartment = cleanString(req.body.department || linkedStudent?.department || req.user.department).toUpperCase()
    const requestedSemester = Number(req.body.semester || linkedStudent?.semester || req.user.semester || 0) || null
    const normalizedSection = cleanString(req.body.section || linkedStudent?.section).toUpperCase() || undefined
    if (linkedStudent) {
      if (requestedDepartment && requestedDepartment !== String(linkedStudent.department).toUpperCase()) return res.status(403).json({ message: 'Message department does not match the selected student.' })
      if (requestedSemester && Number(linkedStudent.semester) !== requestedSemester) return res.status(403).json({ message: 'Message semester does not match the selected student.' })
      if (normalizedSection && String(linkedStudent.section || '').toUpperCase() !== normalizedSection) return res.status(403).json({ message: 'Message section does not match the selected student.' })
    }
    let sectionId = linkedStudent?.sectionId || null
    if (linkedStudent && !useDemoData && !sectionId) sectionId = (await findSection(linkedStudent.department, linkedStudent.semester, linkedStudent.section))?.sectionId || null
    const audience = receiverRole === 'parent' ? 'Parent' : receiverRole === 'student' ? 'Student' : receiverRole === 'admin' ? 'Students' : 'Students'
    const message = {
      id: useDemoData ? nextId(demoStore.messages) : undefined,
      senderId: Number(req.user.sub),
      senderRole: req.user.role,
      sender: req.user.name,
      receiverId,
      receiverRole,
      recipientId: receiverId,
      recipientRole: receiverRole,
      recipient: target.name,
      audience,
      subject,
      body,
      content: body,
      department: linkedStudent?.department || requestedDepartment,
      semester: linkedStudent?.semester ? Number(linkedStudent.semester) : requestedSemester,
      section: linkedStudent?.section || normalizedSection,
      sectionId,
      studentId: linkedStudent ? Number(linkedStudent.id) : null,
      studentName: linkedStudent?.name || target.studentName,
      time: 'Just now',
      createdAt: new Date().toISOString(),
      read: false,
      readStatus: false,
      initials: (req.user.name || 'CA').split(/\s+/).map((word) => word[0]).join('').slice(0, 2).toUpperCase(),
    }
    if (useDemoData) {
      demoStore.messages.unshift(message)
    } else {
      const result = await query('INSERT INTO messages (sender_id, sender_role, receiver_id, receiver_role, student_id, department_code, semester, section_id, audience, subject, body, read_status, read_at) VALUES (:senderId, :senderRole, :receiverId, :receiverRole, :studentId, :department, :semester, :sectionId, :audience, :subject, :body, FALSE, NULL)', { ...message, department: message.department || null, semester: message.semester || null })
      message.id = result.insertId
    }
    console.info('[messages] Message delivered', { messageId: message.id, senderId: message.senderId, senderRole: message.senderRole, receiverId: message.receiverId, receiverRole: message.receiverRole, studentId: message.studentId, department: message.department, semester: message.semester, section: message.section })
    res.status(201).json({ data: message })
  } catch (error) {
    console.error('[messages] Message creation failed', { userId: req.user?.sub, role: req.user?.role, recipientId: req.body?.recipientId || req.body?.receiverId, recipientRole: req.body?.recipientRole || req.body?.receiverRole, studentId: req.body?.studentId, code: error.code, message: error.message })
    next(error)
  }
})

app.put('/api/messages/:id/read', authRequired, async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    if (useDemoData) {
      const message = demoStore.messages.find((item) => Number(item.id) === id)
      if (!message) return res.status(404).json({ message: 'Message not found.' })
      const ownsMessage = (Number(message.receiverId) === Number(req.user.sub) && String(message.receiverRole).toLowerCase() === req.user.role) || (!message.receiverId && (req.user.role === 'teacher' || String(message.recipient || '').toLowerCase().includes(String(req.user.name || req.user.usn).toLowerCase())))
      if (!ownsMessage) return res.status(403).json({ message: 'This message is not in your inbox.' })
      message.read = true
      message.readStatus = true
      message.readAt = new Date().toISOString()
      return res.json({ ok: true, data: mapMessageRow(message) })
    }
    const result = await query('UPDATE messages SET read_status=TRUE, read_at=CURRENT_TIMESTAMP WHERE id=:id AND receiver_id=:receiverId AND receiver_role=:receiverRole', { id, receiverId: Number(req.user.sub), receiverRole: req.user.role })
    if (!result.affectedRows) return res.status(404).json({ message: 'Message not found in your inbox.' })
    console.info('[messages] Message marked read', { messageId: id, receiverId: req.user.sub, receiverRole: req.user.role })
    res.json({ ok: true })
  } catch (error) { next(error) }
})

app.get('/api/announcements', authRequired, async (req, res, next) => {
  try {
    const requestedDepartment = req.user.role === 'teacher' ? req.user.department : selectedAdminDepartment(req) || (cleanString(req.query.department).toUpperCase() || (req.user.department === 'ALL' ? '' : req.user.department))
    const requestedSemester = req.query.semester || req.user.semester
    const requestedSection = req.query.section ? String(req.query.section).toUpperCase() : ''
    if (useDemoData) {
      const items = demoStore.announcements.filter((item) => (!requestedDepartment || item.department === requestedDepartment) && (!requestedSemester || Number(item.semester) === Number(requestedSemester)) && (!requestedSection || String(item.section || '').toUpperCase() === requestedSection))
      return res.json({ data: items })
    }
    const conditions = ['is_active = 1']
    const params = {}
    if (requestedDepartment) { conditions.push('department_code = :department'); params.department = requestedDepartment }
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
    const adminDepartment = selectedAdminDepartment(req)
    const requestedDepartment = cleanString(department).toUpperCase()
    if (req.user.role === 'teacher' && requestedDepartment && requestedDepartment !== req.user.department) return res.status(403).json({ message: 'Teachers may only publish in their department.' })
    if (adminDepartment && requestedDepartment && requestedDepartment !== adminDepartment) return res.status(403).json({ message: 'This admin session is scoped to the selected department.' })
    const normalizedSection = cleanString(section).toUpperCase() || undefined
    const scopedDepartment = adminDepartment || requestedDepartment || req.user.department
    const item = { id: useDemoData ? nextId(demoStore.announcements) : undefined, title: cleanString(title), body: cleanString(body), type, department: type === 'College' && !adminDepartment ? null : scopedDepartment, semester: type === 'Semester' ? Number(semester) : null, section: normalizedSection, priority, author: req.user.name, date: 'Just now' }
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
    const adminDepartment = selectedAdminDepartment(req)
    if (req.user.role === 'teacher' && requestedDepartment && requestedDepartment !== req.user.department) return res.status(403).json({ message: 'Teachers may only publish in their department.' })
    if (adminDepartment && requestedDepartment && requestedDepartment !== adminDepartment) return res.status(403).json({ message: 'This admin session is scoped to the selected department.' })
    if (useDemoData) {
      const index = demoStore.announcements.findIndex((item) => item.id === id)
      if (index < 0) return res.status(404).json({ message: 'Announcement not found.' })
      if ((req.user.role === 'teacher' || adminDepartment) && demoStore.announcements[index].department && demoStore.announcements[index].department !== (req.user.role === 'teacher' ? req.user.department : adminDepartment)) return res.status(403).json({ message: 'Announcement is outside your access scope.' })
      demoStore.announcements[index] = { ...demoStore.announcements[index], ...req.body, ...(requestedDepartment ? { department: requestedDepartment } : {}), id }
      return res.json({ data: demoStore.announcements[index] })
    }
    const existing = await query('SELECT department_code AS department FROM announcements WHERE id=:id AND is_active=1 LIMIT 1', { id })
    if (!existing[0]) return res.status(404).json({ message: 'Announcement not found.' })
    if ((req.user.role === 'teacher' || adminDepartment) && existing[0].department !== (req.user.role === 'teacher' ? req.user.department : adminDepartment)) return res.status(403).json({ message: 'Announcement is outside your access scope.' })
    await query('UPDATE announcements SET title=:title, body=:body, visibility_type=:type, department_code=:department, semester=:semester, priority=:priority WHERE id=:id', { ...req.body, id, department: requestedDepartment || existing[0].department })
    res.json({ ok: true })
  } catch (error) { next(error) }
})

app.delete('/api/announcements/:id', authRequired, roleRequired('teacher', 'admin'), async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    const adminDepartment = selectedAdminDepartment(req)
    if (useDemoData) {
      const item = demoStore.announcements.find((announcement) => announcement.id === id)
      if (!item) return res.status(404).json({ message: 'Announcement not found.' })
      if ((req.user.role === 'teacher' || adminDepartment) && item.department && item.department !== (req.user.role === 'teacher' ? req.user.department : adminDepartment)) return res.status(403).json({ message: 'Announcement is outside your access scope.' })
      demoStore.announcements = demoStore.announcements.filter((announcement) => announcement.id !== id)
      return res.json({ ok: true })
    }
    const existing = await query('SELECT department_code AS department FROM announcements WHERE id=:id AND is_active=1 LIMIT 1', { id })
    if (!existing[0]) return res.status(404).json({ message: 'Announcement not found.' })
    if ((req.user.role === 'teacher' || adminDepartment) && existing[0].department !== (req.user.role === 'teacher' ? req.user.department : adminDepartment)) return res.status(403).json({ message: 'Announcement is outside your access scope.' })
    await query('UPDATE announcements SET is_active=0 WHERE id=:id', { id }); res.json({ ok: true })
  } catch (error) { next(error) }
})

app.get('/api/remarks', authRequired, async (req, res, next) => {
  try {
    const requestedSemester = req.query.semester || req.user.semester
    const requestedSection = req.query.section ? String(req.query.section).toUpperCase() : ''
    const requestedDepartment = req.user.role === 'teacher' ? req.user.department : selectedAdminDepartment(req) || (cleanString(req.query.department).toUpperCase() || (req.user.department === 'ALL' ? '' : req.user.department))
    if (useDemoData) {
      const items = (req.user.role === 'teacher' || req.user.role === 'admin' ? demoStore.remarks : demoStore.remarks.filter((remark) => remark.studentId === 4)).filter((remark) => {
        const student = demoStore.students.find((item) => item.id === remark.studentId)
        return student && scopeStudent(req, student) && (!requestedDepartment || student.department === requestedDepartment) && (!requestedSemester || Number(student.semester) === Number(requestedSemester)) && (!requestedSection || String(student.section || '').toUpperCase() === requestedSection)
      })
      return res.json({ data: items })
    }
    const conditions = ['1=1']
    const params = {}
    if (requestedDepartment) { conditions.push('s.department_code=:department'); params.department = requestedDepartment }
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
    const missing = predictionAttributeKeys.filter((key) => req.body[key] === undefined || req.body[key] === null || req.body[key] === '')
    if (missing.length) return res.status(422).json({ message: `These five model inputs are required: ${missing.join(', ')}.` })
    const features = predictionFields(req.body)
    const invalid = predictionAttributeKeys.filter((key) => !Number.isFinite(Number(req.body[key])) || (key === 'previousGpa' ? features[key] < 0 || features[key] > 10 : features[key] < 0 || features[key] > 100))
    if (invalid.length) return res.status(422).json({ message: `Invalid model input: ${invalid.join(', ')}.` })
    if (process.env.ML_SERVICE_URL) {
      try {
        const response = await axios.post(`${process.env.ML_SERVICE_URL.replace(/\/$/, '')}/predict`, features, { timeout: 2500 })
        const serviceResult = response.data?.result
        const serviceRisk = normalizeRisk(response.data?.risk)
        if ((serviceResult === 'Pass' || serviceResult === 'Fail') && serviceRisk) return res.json({ result: serviceResult, risk: serviceRisk, model: response.data.model || 'xgboost', inputs: features })
      } catch (serviceError) { console.warn('ML service unavailable; using fallback:', serviceError.message) }
    }
    const fallback = predictAcademic(features)
    res.json({ result: fallback.result, risk: fallback.risk, model: 'deterministic-fallback', inputs: features })
  } catch (error) { next(error) }
})

if (process.env.NODE_ENV === 'production') {
  const clientDirectory = path.resolve(serverDirectory, '../dist')
  app.use(express.static(clientDirectory))
  app.get('*', (_req, res) => res.sendFile(path.join(clientDirectory, 'index.html')))
}

app.use((error, req, res, _next) => {
  const status = error.status || 500
  console.error('[camps-api] Request failed', {
    method: req.method,
    path: req.originalUrl,
    status,
    userId: req.user?.sub,
    role: req.user?.role,
    code: error.code,
    sqlState: error.sqlState,
    message: error.message,
  })
  if (error.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ message: 'File is too large. Maximum size is 8 MB.' })
  res.status(status).json({ message: error.message || 'Unexpected server error.' })
})

app.listen(port, '0.0.0.0', () => {
  console.log(`CAMPS API listening on http://0.0.0.0:${port} · ${useDemoData ? 'demo data mode' : 'MySQL mode'}`)
  if (!useDemoData && !getPool()) console.warn('MySQL mode is enabled but no pool is configured.')
})

export default app
