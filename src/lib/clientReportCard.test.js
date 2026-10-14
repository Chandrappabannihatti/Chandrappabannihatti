import test from 'node:test'
import assert from 'node:assert/strict'
import { PDFDocument } from 'pdf-lib'
import { createClientReportCardPdf, createClientReportCardsZip } from './clientReportCard.js'

const report = {
  student: {
    id: 4,
    name: 'Ishita Kulkarni',
    usn: '4PM21CS033',
    department: 'CSE',
    semester: 7,
    section: 'B',
    email: 'ishita@example.com',
    attendancePercentage: 68,
    averageInternalMarks: 56,
    averageAssignmentScore: 60,
    previousGpa: 6.8,
    currentGpa: 6.5,
    participationScore: 46,
    result: 'Pass',
    risk: 'Medium Risk',
  },
  subjects: [{ subjectCode: 'CS701', subjectName: 'Machine Learning', credits: 4 }],
  remarks: [{ label: 'Needs Improvement', note: 'Attend consistently.', date: '2026-08-20' }],
  achievements: [],
}

test('creates a valid local fallback PDF and ZIP', async () => {
  const pdf = await createClientReportCardPdf(report)
  const zip = await createClientReportCardsZip([report])
  assert.equal(pdf.type, 'application/pdf')
  const document = await PDFDocument.load(await pdf.arrayBuffer())
  assert.equal(document.getTitle(), 'Student Academic Report Card · 4PM21CS033')
  const pdfBytes = new Uint8Array(await pdf.arrayBuffer())
  const zipBytes = new Uint8Array(await zip.arrayBuffer())
  assert.deepEqual(Array.from(pdfBytes.slice(0, 5)), [37, 80, 68, 70, 45])
  assert.deepEqual(Array.from(zipBytes.slice(0, 2)), [80, 75])
  assert.ok(zip.size > 0)
  assert.equal(zip.type, 'application/zip')
})

test('keeps dense local fallback reports within the two-page maximum', async () => {
  const denseReport = {
    ...report,
    subjects: Array.from({ length: 20 }, (_, index) => ({
      subjectCode: `CS${701 + index}`,
      subjectName: `Subject ${index + 1}`,
      credits: 3,
      attendancePercentage: 85,
      averageInternalMarks: 75,
      assignmentScore: 80,
    })),
    remarks: Array.from({ length: 6 }, () => ({ label: 'Teacher remark', note: 'Continue consistent academic work.', date: '2026-08-20' })),
    achievements: Array.from({ length: 6 }, () => ({ achievementType: 'Academic', title: 'Achievement', description: 'Recorded achievement.', date: '2026-08-20' })),
  }
  const pdf = await createClientReportCardPdf(denseReport)
  const document = await PDFDocument.load(await pdf.arrayBuffer())
  assert.ok(document.getPageCount() <= 2)
})
