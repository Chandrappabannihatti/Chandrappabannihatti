import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_STUDENT_PASSWORD, normalizeUsn, validateStudent } from './utils.js'

const validStudent = {
  usn: '4PM26TEST001',
  name: 'Validation Student',
  department: 'CSE',
  semester: 1,
  section: 'A',
  email: 'validation.student@example.com',
  password: 'Student@123',
  attendancePercentage: 80,
  averageInternalMarks: 70,
  averageAssignmentScore: 75,
  previousGpa: 7,
  currentGpa: 7.5,
  participationScore: 65,
}

test('student validation accepts an explicit class assignment', () => {
  assert.deepEqual(validateStudent(validStudent), [])
})

test('student validation rejects missing semester and section instead of defaulting them', () => {
  const errors = validateStudent({ ...validStudent, semester: undefined, section: undefined })
  assert.ok(errors.some((error) => error.includes('Semester must be between 1 and 8.')))
  assert.ok(errors.some((error) => error.includes('Section must be a valid section name.')))
})

test('student validation rejects duplicate USNs', () => {
  const errors = validateStudent(validStudent, [{ id: 9, usn: validStudent.usn }])
  assert.ok(errors.includes('USN already exists.'))
})

test('student validation can use active database department options', () => {
  const errors = validateStudent({ ...validStudent, department: 'BIO' }, [], { departments: ['CSE', 'BIO'] })
  assert.deepEqual(errors, [])
})

test('USNs are normalized before duplicate checks and the initial password is fixed', () => {
  assert.equal(normalizeUsn(' 4pm26test001 '), '4PM26TEST001')
  assert.equal(DEFAULT_STUDENT_PASSWORD, 'Student@123')
  const errors = validateStudent({ ...validStudent, usn: ' 4pm26test001 ' }, [{ id: 9, usn: '4PM26TEST001' }])
  assert.ok(errors.includes('USN already exists.'))
})
