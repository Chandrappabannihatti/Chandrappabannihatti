import test from 'node:test'
import assert from 'node:assert/strict'
import { decorateDepartmentRows } from '../data/departments.js'
import { departments, demoStudentForDepartment, demoStudents, demoTeacherForDepartment, demoTeachers } from '../data/demo.js'

const configuredCodes = departments.map(({ code }) => code)

test('department login catalog keeps active database rows and supports future codes', () => {
  const catalog = decorateDepartmentRows([
    { code: 'AIML', name: 'Artificial Intelligence & ML', isActive: true },
    { code: 'BIO', name: 'Biotechnology', isActive: true },
    { code: 'CSE', name: 'Computer Science & Engineering', isActive: false },
  ])
  assert.deepEqual(catalog.map((item) => item.code), ['AIML', 'BIO'])
  assert.equal(catalog.find((item) => item.code === 'BIO').name, 'Biotechnology')
})

test('each configured demo department has a separately scoped teacher and student account', () => {
  assert.deepEqual(new Set(demoTeachers.map((teacher) => teacher.department)), new Set(configuredCodes))
  assert.equal(new Set(demoTeachers.map((teacher) => teacher.email)).size, configuredCodes.length)
  for (const code of configuredCodes) {
    assert.equal(demoTeacherForDepartment(code).department, code)
    assert.equal(demoStudentForDepartment(code).department, code)
  }
})

test('demo student USNs are unique across department scopes', () => {
  const usns = demoStudents.map((student) => student.usn.toUpperCase())
  assert.equal(new Set(usns).size, usns.length)
})
