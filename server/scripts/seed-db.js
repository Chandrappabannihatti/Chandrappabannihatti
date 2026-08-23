import bcrypt from 'bcryptjs'
import dotenv from 'dotenv'
import { getPool } from '../db.js'
import { demoAchievements, demoAnnouncements, demoRemarks, demoSections, demoStudents } from '../../src/data/demo.js'

dotenv.config()
const pool = getPool()
if (!pool) {
  console.error('Set USE_DEMO_DATA=false and configure MySQL before seeding.')
  process.exit(1)
}

const hashes = {
  admin: await bcrypt.hash('Admin@123', 10),
  teacher: await bcrypt.hash('Teacher@123', 10),
  student: await bcrypt.hash('Student@123', 10),
  parent: await bcrypt.hash('Parent@123', 10),
}

for (const department of [
  ['CSE', 'Computer Science & Engineering'], ['AIML', 'Artificial Intelligence & ML'], ['CSDS', 'Computer Science & Data Science'], ['CE', 'Computer Engineering'], ['ECE', 'Electronics & Communication Engineering'], ['EEE', 'Electrical & Electronics Engineering'], ['ME', 'Mechanical Engineering'], ['CIVIL', 'Civil Engineering'],
]) await pool.query('INSERT INTO departments (code, name) VALUES (?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name)', department)
for (const section of demoSections) await pool.query('INSERT INTO sections (department_code, semester, section_name) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE section_name=VALUES(section_name)', [section.department, section.semester, section.sectionName])

const [adminResult] = await pool.query('INSERT INTO users (role, display_name, email, password_hash) VALUES ("admin", "Kavya Menon", "admin@camps.edu", ?) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)', [hashes.admin])
await pool.query('INSERT INTO admins (user_id, name, email, password_hash) VALUES (?, "Kavya Menon", "admin@camps.edu", ?) ON DUPLICATE KEY UPDATE password_hash=VALUES(password_hash)', [adminResult.insertId, hashes.admin])
const [teacherResult] = await pool.query('INSERT INTO users (role, display_name, email, password_hash) VALUES ("teacher", "Dr. Ananya Rao", "teacher@camps.edu", ?) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)', [hashes.teacher])
const [teacherTableResult] = await pool.query('INSERT INTO teachers (user_id, employee_code, name, email, password_hash, department_code, designation) VALUES (?, "FAC-CSE-001", "Dr. Ananya Rao", "teacher@camps.edu", ?, "CSE", "Assistant Professor") ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id), password_hash=VALUES(password_hash)', [teacherResult.insertId, hashes.teacher])
const teacherId = teacherTableResult.insertId

for (const item of demoStudents) {
  const [[sectionRow]] = await pool.query('SELECT section_id FROM sections WHERE department_code=? AND semester=? AND section_name=? LIMIT 1', [item.department, item.semester, item.section])
  const [studentResult] = await pool.query('INSERT INTO students (usn, name, department_code, semester, section, section_id, gender, date_of_birth, blood_group, address, email, phone, parent_name, father_name, mother_name, parent_phone, parent_email, certifications, skills, password_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id), section_id=VALUES(section_id), date_of_birth=VALUES(date_of_birth), blood_group=VALUES(blood_group), address=VALUES(address), father_name=VALUES(father_name), mother_name=VALUES(mother_name), parent_email=VALUES(parent_email), certifications=VALUES(certifications), skills=VALUES(skills)', [item.usn, item.name, item.department, item.semester, item.section, sectionRow?.section_id || null, item.gender, item.dateOfBirth || null, item.bloodGroup || null, item.address || null, item.email, item.phone, item.parentName, item.fatherName || item.parentName, item.motherName || null, item.parentPhone, item.parentEmail || null, JSON.stringify(item.certifications || []), JSON.stringify(item.skills || []), hashes.student])
  const studentId = studentResult.insertId
  await pool.query('INSERT INTO users (role, display_name, email, password_hash) VALUES ("student", ?, ?, ?) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)', [item.name, item.email, hashes.student])
  if (item.usn === '4PM21CS033') await pool.query('INSERT INTO parents (student_id, name, phone, password_hash, relationship) VALUES (?, ?, ?, ?, "Parent") ON DUPLICATE KEY UPDATE password_hash=VALUES(password_hash)', [studentId, item.parentName, item.parentPhone, hashes.parent])
  await pool.query('INSERT INTO attendance (student_id, subject_code, attendance_date, status, attendance_percentage, marked_by) VALUES (?, "ALL", CURDATE(), "Present", ?, ?)', [studentId, item.attendance, teacherId])
  await pool.query('INSERT INTO internal_marks (student_id, subject_code, semester, ia1, ia2, cgpa, recorded_by) VALUES (?, "ACADEMIC", ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE cgpa=VALUES(cgpa)', [studentId, item.semester, item.ia1, item.ia2, item.cgpa, teacherId])
}
for (const item of demoAnnouncements) await pool.query('INSERT INTO announcements (title, body, visibility_type, department_code, semester, priority, author_id) VALUES (?, ?, ?, ?, ?, ?, ?)', [item.title, item.body, item.type, item.department, item.semester, item.priority, teacherResult.insertId])
for (const item of demoRemarks) { const [[student]] = await pool.query('SELECT id FROM students WHERE name=? LIMIT 1', [item.studentName]); if (student) await pool.query('INSERT INTO remarks (student_id, teacher_id, label, note) VALUES (?, ?, ?, ?)', [student.id, teacherId, item.label, item.note]) }
for (const item of demoAchievements) { const [[student]] = await pool.query('SELECT id, section_id FROM students WHERE usn=? LIMIT 1', [item.usn]); if (student) await pool.query('INSERT INTO achievements (student_id, teacher_id, section_id, department_code, semester, achievement_type, achievement_date, title, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE description=VALUES(description), achievement_type=VALUES(achievement_type)', [student.id, teacherId, student.section_id, item.department, item.semester, item.achievementType, item.date, item.title, item.description]) }
await pool.end()
console.log('CAMPS demo data seeded.')
