import test from 'node:test'
import assert from 'node:assert/strict'
import { loadReportCard } from './reportCardData.js'
import { renderReportCardPdf, reportCardFilename } from './reportCardPdf.js'

function request(user, scope = {}, requireTeacherScope = user.role === 'teacher') {
  return loadReportCard({
    studentId: 4,
    user,
    scope,
    useDemoData: true,
    requireTeacherScope,
    isStudentInUserScope: (student) => user.role === 'admin'
      || (user.role === 'teacher' && student.department === user.department)
      || ((user.role === 'student' || user.role === 'parent') && student.usn === user.usn),
  })
}

test('loads a scoped report card without mixing student records', async () => {
  const report = await request({ role: 'teacher', department: 'CSE' }, { department: 'CSE', semester: 7, section: 'B' })
  assert.equal(report.student.id, 4)
  assert.equal(report.student.usn, '4PM21CS033')
  assert.equal(report.student.section, 'B')
  assert.equal(report.student.name, 'Ishita Kulkarni')
  assert.ok(report.subjects.every((subject) => subject.subjectCode.startsWith('CS')))
})

test('blocks a teacher outside the requested section', async () => {
  await assert.rejects(
    () => request({ role: 'teacher', department: 'CSE' }, { department: 'CSE', semester: 7, section: 'A' }),
    (error) => error.status === 403 && /section scope/.test(error.message),
  )
})

test('students and parents can only load the linked record', async () => {
  const studentReport = await request({ role: 'student', usn: '4PM21CS033' }, {}, false)
  const parentReport = await request({ role: 'parent', usn: '4PM21CS033' }, {}, false)
  assert.equal(studentReport.student.id, 4)
  assert.equal(parentReport.student.id, 4)
  await assert.rejects(() => request({ role: 'student', usn: '4PM21CS001' }, {}, false), (error) => error.status === 403)
  await assert.rejects(() => request({ role: 'parent', usn: '4PM21CS001' }, {}, false), (error) => error.status === 403)
})

test('renders a valid PDF filename and document header', async () => {
  const report = await request({ role: 'teacher', department: 'CSE' }, { department: 'CSE', semester: 7, section: 'B' })
  const pdf = await renderReportCardPdf(report)
  assert.equal(reportCardFilename(report.student.usn), 'Report_Card_4PM21CS033.pdf')
  assert.equal(pdf.subarray(0, 8).toString(), '%PDF-1.3')
  assert.match(pdf.subarray(-12).toString(), /\n%%EOF\n$/)
  assert.ok(pdf.length > 2000)
})
