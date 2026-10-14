import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_STUDENT_PASSWORD, normalizeImportRows } from './studentImport.js'

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
