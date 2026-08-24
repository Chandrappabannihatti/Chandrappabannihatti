import fs from 'node:fs/promises'
import path from 'node:path'
import mysql from 'mysql2/promise'
import dotenv from 'dotenv'

dotenv.config()

const connection = await mysql.createConnection({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  multipleStatements: true,
})

const schema = await fs.readFile(path.resolve('database/schema.sql'), 'utf8')
await connection.query(schema)

const identifier = (name) => `\`${name.replaceAll('`', '``')}\``
const tableExists = async (table) => {
  const [rows] = await connection.query('SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?', [table])
  return Number(rows[0]?.total) > 0
}
const getColumns = async (table) => {
  const [rows] = await connection.query('SELECT COLUMN_NAME AS name, COLUMN_TYPE AS columnType FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ?', [table])
  return rows
}
const getIndexes = async (table) => {
  const [rows] = await connection.query('SELECT DISTINCT INDEX_NAME AS name FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ?', [table])
  return rows.map((row) => row.name)
}
const addColumns = async (table, columns) => {
  const existing = new Set((await getColumns(table)).map((column) => column.name))
  for (const [name, definition] of Object.entries(columns)) {
    if (!existing.has(name)) {
      await connection.query(`ALTER TABLE ${identifier(table)} ADD COLUMN ${identifier(name)} ${definition}`)
      existing.add(name)
    }
  }
  return await getColumns(table)
}
const dropColumns = async (table, columns) => {
  const existing = new Set((await getColumns(table)).map((column) => column.name))
  for (const name of columns) if (existing.has(name)) await connection.query(`ALTER TABLE ${identifier(table)} DROP COLUMN ${identifier(name)}`)
}

const canonicalStudentColumns = {
  date_of_birth: 'DATE NULL',
  blood_group: 'VARCHAR(8) NULL',
  address: 'VARCHAR(255) NULL',
  father_name: 'VARCHAR(120) NULL',
  mother_name: 'VARCHAR(120) NULL',
  parent_email: 'VARCHAR(160) NULL',
  certifications: 'JSON NULL',
  skills: 'JSON NULL',
  attendance_percentage: 'DECIMAL(5,2) NOT NULL DEFAULT 0',
  average_internal_marks: 'DECIMAL(5,2) NOT NULL DEFAULT 0',
  average_assignment_score: 'DECIMAL(5,2) NOT NULL DEFAULT 0',
  previous_gpa: 'DECIMAL(4,2) NOT NULL DEFAULT 0',
  current_gpa: 'DECIMAL(4,2) NOT NULL DEFAULT 0',
  participation_score: 'DECIMAL(5,2) NOT NULL DEFAULT 0',
  result: "ENUM('Pass', 'Fail') NOT NULL DEFAULT 'Fail'",
  risk: "ENUM('Low Risk', 'Medium Risk', 'High Risk') NOT NULL DEFAULT 'High Risk'",
}

// CREATE TABLE IF NOT EXISTS does not change an already-initialised students table.
// Add the profile and canonical Average Academic Performance columns during upgrades.
const studentColumnsBefore = await getColumns('students')
const hadStudentResult = studentColumnsBefore.some((column) => column.name === 'result')
const hadStudentRisk = studentColumnsBefore.some((column) => column.name === 'risk')
let studentColumns = await addColumns('students', canonicalStudentColumns)
const studentColumnNames = new Set(studentColumns.map((column) => column.name))
const studentLegacyColumns = ['attendance', 'ia1', 'ia2', 'assignment_marks', 'previous_sgpa', 'cgpa', 'backlogs']
const studentLegacy = studentLegacyColumns.filter((name) => studentColumnNames.has(name))

// Older releases used a short Low/Medium/High enum. Move it out of the way before
// creating the canonical exact-label enum, then backfill it below.
let studentLegacyRisk = false
const studentRiskColumn = studentColumns.find((column) => column.name === 'risk')
if (studentRiskColumn && !studentRiskColumn.columnType.toLowerCase().includes("'low risk'")) {
  if ((await getIndexes('students')).includes('idx_student_risk')) await connection.query(`ALTER TABLE ${identifier('students')} DROP INDEX ${identifier('idx_student_risk')}`)
  await connection.query(`ALTER TABLE ${identifier('students')} CHANGE COLUMN ${identifier('risk')} ${identifier('legacy_risk')} VARCHAR(32) NULL`)
  await connection.query(`ALTER TABLE ${identifier('students')} ADD COLUMN ${identifier('risk')} ENUM('Low Risk', 'Medium Risk', 'High Risk') NOT NULL DEFAULT 'High Risk'`)
  studentLegacyRisk = true
} else if (!studentRiskColumn) {
  await connection.query(`ALTER TABLE ${identifier('students')} ADD COLUMN ${identifier('risk')} ENUM('Low Risk', 'Medium Risk', 'High Risk') NOT NULL DEFAULT 'High Risk'`)
}

studentColumns = await getColumns('students')
const studentHas = (name) => studentColumns.some((column) => column.name === name)
const bounded = (expression, min, max) => `LEAST(${max}, GREATEST(${min}, COALESCE(${expression}, 0)))`
const studentBackfills = []
if (studentHas('attendance')) studentBackfills.push(`attendance_percentage = CASE WHEN attendance_percentage = 0 THEN ${bounded('attendance', 0, 100)} ELSE attendance_percentage END`)
if (studentHas('ia1') || studentHas('ia2')) {
  const internalExpression = studentHas('ia1') && studentHas('ia2') ? '(COALESCE(ia1, 0) + COALESCE(ia2, 0)) / 2' : `COALESCE(${studentHas('ia1') ? 'ia1' : 'ia2'}, 0)`
  studentBackfills.push(`average_internal_marks = CASE WHEN average_internal_marks = 0 THEN ${bounded(internalExpression, 0, 100)} ELSE average_internal_marks END`)
}
if (studentHas('assignment_marks')) studentBackfills.push(`average_assignment_score = CASE WHEN average_assignment_score = 0 THEN ${bounded('assignment_marks', 0, 100)} ELSE average_assignment_score END`)
if (studentHas('previous_sgpa')) studentBackfills.push(`previous_gpa = CASE WHEN previous_gpa = 0 THEN ${bounded('previous_sgpa', 0, 10)} ELSE previous_gpa END`)
if (studentHas('cgpa')) studentBackfills.push(`current_gpa = CASE WHEN current_gpa = 0 THEN ${bounded('cgpa', 0, 10)} ELSE current_gpa END`)
if (studentBackfills.length) await connection.query(`UPDATE ${identifier('students')} SET ${studentBackfills.join(', ')}`)

const studentScore = '(attendance_percentage * 0.30 + average_internal_marks * 0.25 + average_assignment_score * 0.15 + (previous_gpa / 10) * 15 + participation_score * 0.15)'
// Newly-added result/risk values are derived from the five model inputs; Current GPA
// is deliberately absent from this expression.
if (!hadStudentResult) await connection.query(`UPDATE ${identifier('students')} SET result = CASE WHEN ${studentScore} >= 60 THEN 'Pass' ELSE 'Fail' END`)
if (studentLegacyRisk) {
  await connection.query(`UPDATE ${identifier('students')} SET risk = CASE WHEN LOWER(COALESCE(legacy_risk, '')) LIKE '%high%' THEN 'High Risk' WHEN LOWER(COALESCE(legacy_risk, '')) LIKE '%medium%' THEN 'Medium Risk' WHEN LOWER(COALESCE(legacy_risk, '')) LIKE '%low%' THEN 'Low Risk' ELSE CASE WHEN ${studentScore} >= 75 THEN 'Low Risk' WHEN ${studentScore} >= 55 THEN 'Medium Risk' ELSE 'High Risk' END END`)
} else if (!hadStudentRisk) {
  await connection.query(`UPDATE ${identifier('students')} SET risk = CASE WHEN ${studentScore} >= 75 THEN 'Low Risk' WHEN ${studentScore} >= 55 THEN 'Medium Risk' ELSE 'High Risk' END`)
}
await dropColumns('students', [...studentLegacy, ...(studentLegacyRisk ? ['legacy_risk'] : [])])

// The first schema used a prediction table with ia1/ia2/backlogs/pass_probability
// and short risk labels. Upgrade it in place so existing data speaks the same
// five-input, Pass/Fail + exact-risk contract as a fresh database.
if (await tableExists('predictions')) {
  const predictionColumnsDefinition = {
    attendance_percentage: 'DECIMAL(5,2) NOT NULL DEFAULT 0',
    average_internal_marks: 'DECIMAL(5,2) NOT NULL DEFAULT 0',
    average_assignment_score: 'DECIMAL(5,2) NOT NULL DEFAULT 0',
    previous_gpa: 'DECIMAL(4,2) NOT NULL DEFAULT 0',
    participation_score: 'DECIMAL(5,2) NOT NULL DEFAULT 0',
    result: "ENUM('Pass', 'Fail') NOT NULL DEFAULT 'Fail'",
  }
  const predictionColumnsBefore = await getColumns('predictions')
  const hadPredictionResult = predictionColumnsBefore.some((column) => column.name === 'result')
  const hadPredictionRisk = predictionColumnsBefore.some((column) => column.name === 'risk')
  let predictionColumns = await addColumns('predictions', predictionColumnsDefinition)
  const predictionHas = (name) => predictionColumns.some((column) => column.name === name)
  let predictionLegacyRisk = false
  const predictionRiskColumn = predictionColumns.find((column) => column.name === 'risk')
  if (predictionRiskColumn && !predictionRiskColumn.columnType.toLowerCase().includes("'low risk'")) {
    if ((await getIndexes('predictions')).includes('idx_prediction_risk')) await connection.query(`ALTER TABLE ${identifier('predictions')} DROP INDEX ${identifier('idx_prediction_risk')}`)
    await connection.query(`ALTER TABLE ${identifier('predictions')} CHANGE COLUMN ${identifier('risk')} ${identifier('legacy_risk')} VARCHAR(32) NULL`)
    await connection.query(`ALTER TABLE ${identifier('predictions')} ADD COLUMN ${identifier('risk')} ENUM('Low Risk', 'Medium Risk', 'High Risk') NOT NULL DEFAULT 'High Risk'`)
    predictionLegacyRisk = true
  } else if (!predictionRiskColumn) {
    await connection.query(`ALTER TABLE ${identifier('predictions')} ADD COLUMN ${identifier('risk')} ENUM('Low Risk', 'Medium Risk', 'High Risk') NOT NULL DEFAULT 'High Risk'`)
  }

  predictionColumns = await getColumns('predictions')
  const predictionBackfills = []
  if (predictionHas('attendance')) predictionBackfills.push(`attendance_percentage = CASE WHEN attendance_percentage = 0 THEN ${bounded('attendance', 0, 100)} ELSE attendance_percentage END`)
  if (predictionHas('ia1') || predictionHas('ia2')) {
    const internalExpression = predictionHas('ia1') && predictionHas('ia2') ? '(COALESCE(ia1, 0) + COALESCE(ia2, 0)) / 2' : `COALESCE(${predictionHas('ia1') ? 'ia1' : 'ia2'}, 0)`
    predictionBackfills.push(`average_internal_marks = CASE WHEN average_internal_marks = 0 THEN ${bounded(internalExpression, 0, 100)} ELSE average_internal_marks END`)
  }
  if (predictionHas('assignment_marks')) predictionBackfills.push(`average_assignment_score = CASE WHEN average_assignment_score = 0 THEN ${bounded('assignment_marks', 0, 100)} ELSE average_assignment_score END`)
  if (predictionHas('previous_sgpa')) predictionBackfills.push(`previous_gpa = CASE WHEN previous_gpa = 0 THEN ${bounded('previous_sgpa', 0, 10)} ELSE previous_gpa END`)
  if (predictionHas('cgpa')) predictionBackfills.push(`previous_gpa = CASE WHEN previous_gpa = 0 THEN ${bounded('cgpa', 0, 10)} ELSE previous_gpa END`)
  if (predictionBackfills.length) await connection.query(`UPDATE ${identifier('predictions')} SET ${predictionBackfills.join(', ')}`)

  const predictionScore = '(attendance_percentage * 0.30 + average_internal_marks * 0.25 + average_assignment_score * 0.15 + (previous_gpa / 10) * 15 + participation_score * 0.15)'
  if (predictionHas('pass_probability')) await connection.query(`UPDATE ${identifier('predictions')} SET result = CASE WHEN pass_probability >= 60 THEN 'Pass' ELSE 'Fail' END`)
  else if (!hadPredictionResult) await connection.query(`UPDATE ${identifier('predictions')} SET result = CASE WHEN ${predictionScore} >= 60 THEN 'Pass' ELSE 'Fail' END`)
  if (predictionLegacyRisk) {
    await connection.query(`UPDATE ${identifier('predictions')} SET risk = CASE WHEN LOWER(COALESCE(legacy_risk, '')) LIKE '%high%' THEN 'High Risk' WHEN LOWER(COALESCE(legacy_risk, '')) LIKE '%medium%' THEN 'Medium Risk' WHEN LOWER(COALESCE(legacy_risk, '')) LIKE '%low%' THEN 'Low Risk' ELSE CASE WHEN ${predictionScore} >= 75 THEN 'Low Risk' WHEN ${predictionScore} >= 55 THEN 'Medium Risk' ELSE 'High Risk' END END`)
  } else if (!hadPredictionRisk) {
    await connection.query(`UPDATE ${identifier('predictions')} SET risk = CASE WHEN ${predictionScore} >= 75 THEN 'Low Risk' WHEN ${predictionScore} >= 55 THEN 'Medium Risk' ELSE 'High Risk' END`)
  }
  await dropColumns('predictions', ['attendance', 'ia1', 'ia2', 'assignment_marks', 'previous_sgpa', 'cgpa', 'backlogs', 'pass_probability', ...(predictionLegacyRisk ? ['legacy_risk'] : [])])
  if (!(await getIndexes('predictions')).includes('idx_prediction_risk')) await connection.query(`ALTER TABLE ${identifier('predictions')} ADD KEY ${identifier('idx_prediction_risk')} (risk, created_at)`)
}

// Existing releases stored subject marks in internal_marks. Copy the usable
// subject-scoped values into subject_records, then remove the legacy table.
if (await tableExists('internal_marks')) {
  const internalColumns = new Set((await getColumns('internal_marks')).map((column) => column.name))
  if (internalColumns.has('subject_code') && (internalColumns.has('ia1') || internalColumns.has('ia2'))) {
    const internalExpression = internalColumns.has('ia1') && internalColumns.has('ia2') ? '(COALESCE(im.ia1, 0) + COALESCE(im.ia2, 0)) / 2' : `COALESCE(im.${internalColumns.has('ia1') ? 'ia1' : 'ia2'}, 0)`
    await connection.query(`INSERT INTO subject_records (subject_id, student_id, attendance_percentage, average_internal_marks, recorded_by, created_at)
      SELECT sub.subject_id, im.student_id,
        LEAST(100, GREATEST(0, COALESCE(att.attendance_percentage, 0))),
        LEAST(100, GREATEST(0, COALESCE(${internalExpression}, 0))),
        im.recorded_by, im.created_at
      FROM internal_marks im
      JOIN students st ON st.id = im.student_id
      JOIN subjects sub ON sub.department_code = st.department_code AND sub.semester = im.semester AND sub.subject_code = im.subject_code
      LEFT JOIN (
        SELECT student_id, subject_code, AVG(attendance_percentage) AS attendance_percentage
        FROM attendance
        GROUP BY student_id, subject_code
      ) att ON att.student_id = im.student_id AND att.subject_code = im.subject_code
      ON DUPLICATE KEY UPDATE attendance_percentage = VALUES(attendance_percentage), average_internal_marks = VALUES(average_internal_marks), recorded_by = VALUES(recorded_by)`)
    await connection.query(`DROP TABLE ${identifier('internal_marks')}`)
  }
}

await connection.end()
console.log('CAMPS schema created or upgraded with the Average Academic Performance contract.')
