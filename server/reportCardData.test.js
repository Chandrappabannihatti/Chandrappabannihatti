import test from 'node:test'
import assert from 'node:assert/strict'
import { loadReportCard } from './reportCardData.js'
import { renderReportCardPdf, reportCardFilename } from './reportCardPdf.js'

function request(user, scope = {}, requireTeacherScope = user.role === 'teacher', studentId = 4) {
  return loadReportCard({
    studentId,
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

test('keeps separate student identities when loading multiple records', async () => {
  const ishita = await request({ role: 'teacher', department: 'CSE' }, { department: 'CSE', semester: 7, section: 'B' }, true, 4)
  const rohan = await request({ role: 'teacher', department: 'CSE' }, { department: 'CSE', semester: 7, section: 'B' }, true, 5)
  assert.equal(ishita.student.usn, '4PM21CS033')
  assert.equal(ishita.student.name, 'Ishita Kulkarni')
  assert.equal(rohan.student.usn, '4PM21CS041')
  assert.equal(rohan.student.name, 'Rohan Desai')
  assert.notEqual(ishita.student.usn, rohan.student.usn)
})

test('renders incomplete records without inferring unavailable fields', async () => {
  const report = await request({ role: 'teacher', department: 'CSE' }, { department: 'CSE', semester: 7, section: 'B' })
  const incomplete = {
    ...report,
    academicYear: null,
    college: { name: null, location: null, logoPath: null },
    student: { id: report.student.id, usn: report.student.usn, name: report.student.name, department: report.student.department, semester: report.student.semester, section: report.student.section, attendancePercentage: null, averageInternalMarks: null, averageAssignmentScore: null, previousGpa: null, currentGpa: null, participationScore: null, result: null, risk: null },
    subjects: [{ subjectCode: 'CS701', subjectName: 'Machine Learning', credits: null, attendancePercentage: null, averageInternalMarks: null, assignmentScore: null }],
    remarks: [{ label: 'Teacher remark', note: 'No date supplied.', date: null }],
    achievements: [{ achievementType: 'Academic', title: 'Record pending', description: null, date: null }],
    prediction: { result: null, risk: null, modelVersion: null },
  }
  const pdf = await renderReportCardPdf(incomplete)
  assert.equal(pdf.subarray(0, 8).toString(), '%PDF-1.3')
  assert.ok(pdf.length > 2000)
})

test('rejects invalid or missing backend records', async () => {
  await assert.rejects(() => request({ role: 'teacher', department: 'CSE' }, { department: 'CSE', semester: 7, section: 'B' }, true, 0), (error) => error.status === 422)
  await assert.rejects(() => request({ role: 'teacher', department: 'CSE' }, { department: 'CSE', semester: 7, section: 'B' }, true, 99999), (error) => error.status === 404)
})

test('renders a valid PDF filename and document header', async () => {
  const report = await request({ role: 'teacher', department: 'CSE' }, { department: 'CSE', semester: 7, section: 'B' })
  const pdf = await renderReportCardPdf(report)
  assert.equal(reportCardFilename(report.student.usn), 'Report_Card_4PM21CS033.pdf')
  assert.equal(report.college.name, 'PES Institute of Technology and Management')
  assert.equal(report.college.location, 'Shivamogga, Karnataka')
  assert.match(pdf.toString('latin1'), /PES Institute of Technology and Management/)
  assert.equal(pdf.subarray(0, 8).toString(), '%PDF-1.3')
  assert.match(pdf.subarray(-12).toString(), /\n%%EOF\n$/)
  assert.ok(pdf.length > 2000)
})
