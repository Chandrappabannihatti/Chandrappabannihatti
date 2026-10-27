import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_STUDENT_PASSWORD, STUDENT_IMPORT_COLUMNS, createStudentImportTemplate, normalizeImportRows, rejectedImportRecords } from './studentImport.js'

const academic = {
  'Attendance Percentage': 80,
  'Average Internal Marks': 70,
  'Average Assignment Score': 75,
  'Previous GPA': 7,
  'Current GPA': 7.5,
  'Participation Score': 65,
}

function row(overrides = {}) {
  return {
    USN: '4PM26IMPORT001',
    Name: 'Import Test Student',
    Department: 'CSE',
    Semester: 1,
    Section: 'A',
    Email: 'import.test@example.com',
    ...academic,
    ...overrides,
  }
}

test('student import keeps an explicit class assignment', () => {
  const [result] = normalizeImportRows([row()], { department: 'CSE', semester: 1, section: 'A' })
  assert.equal(result.ready, true)
  assert.equal(result.section, 'A')
})

test('student import does not silently assign a missing section', () => {
  const [result] = normalizeImportRows([row({ Section: '' })], { department: 'CSE', semester: 1 })
  assert.equal(result.section, '')
  assert.equal(result.ready, false)
  assert.ok(result.issues.includes('Section must be a valid section name.'))
})

test('student import accepts the canonical CV department and exposes the fixed credential contract', () => {
  const [result] = normalizeImportRows([row({ Department: 'CV' })], { department: 'CV', semester: 1, section: 'A' })
  assert.equal(result.ready, true)
  assert.equal(DEFAULT_STUDENT_PASSWORD, 'Student@123')
})

test('student import template contains every canonical Add Student field', () => {
  const template = createStudentImportTemplate({ department: 'BIO', semester: 8, section: 'Z' })
  assert.deepEqual(Object.keys(template), STUDENT_IMPORT_COLUMNS)
  assert.equal(template['Student Name'], 'Sample Student')
  assert.equal(template['Parent/Guardian Name'], 'Parent Name')
  assert.equal(template['Father/Guardian Name'], 'Parent Name')
  assert.equal(template['Initial Student Login Password'], DEFAULT_STUDENT_PASSWORD)
  assert.equal(template.Department, 'BIO')
  assert.equal(template.Semester, 8)
  assert.equal(template.Section, 'Z')
})

test('student import uses active configured departments instead of a fixed client list', () => {
  const [result] = normalizeImportRows([row({ Department: 'BIO' })], { department: 'BIO', semester: 1, section: 'A', departments: [{ code: 'BIO', name: 'Biotechnology' }] })
  assert.equal(result.ready, true)
  const [rejected] = normalizeImportRows([row({ Department: 'CSE' })], { department: 'BIO', semester: 1, section: 'A', departments: [{ code: 'BIO', name: 'Biotechnology' }] })
  assert.equal(rejected.status, 'out-of-scope')
  assert.ok(rejected.issues.some((issue) => issue.includes('expected BIO')))
})

test('student import rejects duplicate emails and produces a rejected-record row', () => {
  const rows = normalizeImportRows([
    row({ USN: '4PM26IMPORT002', Email: 'same@example.com' }),
    row({ USN: '4PM26IMPORT003', Email: 'same@example.com' }),
  ], { department: 'CSE', semester: 1, section: 'A', departments: ['CSE'] })
  assert.equal(rows[0].ready, true)
  assert.equal(rows[1].status, 'duplicate')
  assert.ok(rows[1].issues.includes('Duplicate email in this file.'))
  const rejected = rejectedImportRecords(rows)
  assert.equal(rejected.length, 1)
  assert.equal(rejected[0]['Row Number'], 3)
  assert.match(rejected[0].Issues, /Duplicate email/)
})
