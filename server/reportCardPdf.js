import PDFDocument from 'pdfkit'
import { existsSync } from 'node:fs'

const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89
const MARGIN = 40
const CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2)
const COLORS = {
  navy: '#123E5A',
  navyDark: '#0B2D46',
  teal: '#2C9186',
  tealLight: '#EAF7F3',
  blueLight: '#EFF6FA',
  ink: '#254B5B',
  muted: '#728A91',
  border: '#D5E5E5',
  soft: '#F7FBFA',
  coral: '#D97867',
  white: '#FFFFFF',
  black: '#172F3B',
}

function textValue(value, fallback = 'Not recorded') {
  if (value === null || value === undefined || String(value).trim() === '') return fallback
  return String(value)
}

function numberValue(value, suffix = '', decimals = 2) {
  if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) return 'Not recorded'
  return `${Number(value).toFixed(decimals)}${suffix}`
}

function compactNumber(value, suffix = '', decimals = 1, fallback = 'Not recorded') {
  if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) return fallback
  return `${Number(value).toFixed(decimals)}${suffix}`
}

function formatDate(value, includeTime = false) {
  if (value === null || value === undefined || String(value).trim() === '') return 'Not recorded'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return textValue(value)
  return new Intl.DateTimeFormat('en-IN', includeTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' }).format(date)
}

function drawText(doc, value, x, y, width, options = {}) {
  const settings = { width, lineGap: 1.5, ...options }
  doc.text(textValue(value), x, y, settings)
  return doc.heightOfString(textValue(value), settings)
}

function drawLogo(doc, report, x, y, size) {
  if (report.college?.logoPath && existsSync(report.college.logoPath)) {
    try {
      doc.image(report.college.logoPath, x, y, { fit: [size, size], align: 'center', valign: 'center' })
      return
    } catch { /* show the unavailable state below */ }
  }
  doc.roundedRect(x, y, size, size, 10).fillAndStroke(COLORS.teal, COLORS.teal)
  doc.font('Helvetica-Bold').fontSize(7).fillColor(COLORS.white).text('Logo not recorded', x + 7, y + 22, { width: size - 14, align: 'center' })
}

function drawSectionHeading(doc, title, y, subtitle = '') {
  doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.navy).text(title.toUpperCase(), MARGIN, y)
  if (subtitle) doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.muted).text(subtitle, MARGIN, y + 14, { width: CONTENT_WIDTH })
  return y + (subtitle ? 31 : 19)
}

function drawLabelValue(doc, label, value, x, y, width, options = {}) {
  doc.font('Helvetica-Bold').fontSize(6.5).fillColor(COLORS.muted).text(label.toUpperCase(), x, y, { width })
  doc.font('Helvetica').fontSize(options.fontSize || 8.5).fillColor(COLORS.ink).text(textValue(value), x, y + 10, { width, height: options.height || 24, ellipsis: true })
}

function drawFooter(doc, report, pageNumber) {
  const y = PAGE_HEIGHT - 31
  doc.moveTo(MARGIN, y - 8).lineTo(PAGE_WIDTH - MARGIN, y - 8).lineWidth(.6).strokeColor(COLORS.border).stroke()
  doc.font('Helvetica').fontSize(6.5).fillColor(COLORS.muted).text('CAMPS · Centralized Academic Monitoring System', MARGIN, y, { width: 280 })
  doc.text(`Generated ${formatDate(report.generatedAt, true)}`, PAGE_WIDTH - MARGIN - 170, y, { width: 145, align: 'right' })
  doc.text(`Page ${pageNumber}`, PAGE_WIDTH - MARGIN - 35, y, { width: 35, align: 'right' })
}

function drawContinuationHeader(doc, report) {
  doc.roundedRect(MARGIN, 28, CONTENT_WIDTH, 31, 6).fill(COLORS.blueLight)
  doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.navy).text('CAMPS · INDIVIDUAL STUDENT REPORT CARD', MARGIN + 12, 39, { width: 330 })
  doc.font('Helvetica').fontSize(8).fillColor(COLORS.teal).text(`${report.student.name} · ${report.student.usn}`, PAGE_WIDTH - MARGIN - 180, 39, { width: 168, align: 'right' })
}

function drawMetricCard(doc, x, y, width, label, value, accent = COLORS.teal) {
  doc.roundedRect(x, y, width, 47, 7).fillAndStroke(COLORS.soft, COLORS.border)
  doc.roundedRect(x, y, 4, 47, 2).fill(accent)
  doc.font('Helvetica-Bold').fontSize(6.5).fillColor(COLORS.muted).text(label.toUpperCase(), x + 11, y + 10, { width: width - 18 })
  doc.font('Helvetica-Bold').fontSize(13).fillColor(COLORS.navy).text(value, x + 11, y + 23, { width: width - 18, ellipsis: true })
}

function drawPredictionPanel(doc, report, y) {
  const height = 72
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, height, 8).fillAndStroke(COLORS.navyDark, COLORS.navyDark)
  doc.font('Helvetica-Bold').fontSize(7).fillColor('#A9DCD0').text('ACADEMIC PREDICTION', MARGIN + 15, y + 12)
  doc.font('Helvetica-Bold').fontSize(15).fillColor(COLORS.white).text(textValue(report.prediction?.result), MARGIN + 15, y + 27)
  doc.font('Helvetica').fontSize(7).fillColor('#BFD4D8').text(report.prediction?.modelVersion ? `Model version: ${report.prediction.modelVersion}` : 'Stored prediction record', MARGIN + 15, y + 49)
  doc.font('Helvetica-Bold').fontSize(7).fillColor('#A9DCD0').text('RISK LEVEL', MARGIN + 270, y + 12)
  doc.font('Helvetica-Bold').fontSize(13).fillColor(COLORS.white).text(textValue(report.prediction?.risk), MARGIN + 270, y + 28, { width: 220 })
  doc.font('Helvetica').fontSize(7).fillColor('#BFD4D8').text('Use as an academic support signal, not an automated decision.', MARGIN + 270, y + 49, { width: 220 })
  return y + height
}

function drawSubjectTable(doc, report, y) {
  const columns = [
    { key: 'subjectCode', label: 'CODE', width: 58 },
    { key: 'subjectName', label: 'SUBJECT', width: 164 },
    { key: 'credits', label: 'CREDITS', width: 54 },
    { key: 'attendancePercentage', label: 'ATTENDANCE', width: 82 },
    { key: 'averageInternalMarks', label: 'INTERNAL', width: 78 },
    { key: 'assignmentScore', label: 'ASSIGNMENTS', width: 79 },
  ]
  const headerHeight = 23
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, headerHeight, 5).fill(COLORS.teal)
  let x = MARGIN
  columns.forEach((column) => {
    doc.font('Helvetica-Bold').fontSize(6.3).fillColor(COLORS.white).text(column.label, x + 6, y + 8, { width: column.width - 12, align: column.key === 'subjectName' ? 'left' : 'center' })
    x += column.width
  })
  y += headerHeight
  const rows = report.subjects || []
  if (!rows.length) {
    doc.rect(MARGIN, y, CONTENT_WIDTH, 34).fillAndStroke(COLORS.soft, COLORS.border)
    doc.font('Helvetica-Oblique').fontSize(8).fillColor(COLORS.muted).text('No subject-wise marks have been recorded for this student.', MARGIN + 10, y + 12, { width: CONTENT_WIDTH - 20, align: 'center' })
    return y + 34
  }
  rows.forEach((subject, index) => {
    const rowHeight = 30
    doc.rect(MARGIN, y, CONTENT_WIDTH, rowHeight).fillAndStroke(index % 2 ? COLORS.soft : COLORS.white, COLORS.border)
    let cellX = MARGIN
    columns.forEach((column) => {
      const raw = subject[column.key]
      const value = column.key === 'credits' ? compactNumber(raw, '', 1) : column.key === 'attendancePercentage' || column.key === 'averageInternalMarks' || column.key === 'assignmentScore' ? compactNumber(raw, '%', 1) : textValue(raw, 'Not recorded')
      doc.font(column.key === 'subjectName' ? 'Helvetica' : 'Helvetica-Bold').fontSize(column.key === 'subjectName' ? 7.5 : 7.5).fillColor(COLORS.ink).text(value, cellX + 6, y + 10, { width: column.width - 12, align: column.key === 'subjectName' ? 'left' : 'center', ellipsis: true })
      cellX += column.width
    })
    y += rowHeight
  })
  return y
}

function drawRecordList(doc, title, items, y, options = {}) {
  y = drawSectionHeading(doc, title, y, options.subtitle || '')
  const list = items || []
  if (!list.length) {
    doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 31, 6).fillAndStroke(COLORS.soft, COLORS.border)
    doc.font('Helvetica-Oblique').fontSize(8).fillColor(COLORS.muted).text(options.empty || 'No records have been recorded for this student.', MARGIN + 10, y + 11, { width: CONTENT_WIDTH - 20 })
    return y + 43
  }
  list.slice(0, options.limit || 8).forEach((item) => {
    const description = options.kind === 'achievement' ? `${textValue(item.achievementType, 'Achievement')} · ${formatDate(item.date)}` : `${textValue(item.label, 'Teacher remark')} · ${formatDate(item.date)}`
    const body = options.kind === 'achievement' ? `${textValue(item.title)}\n${textValue(item.description)}` : textValue(item.note)
    const bodyHeight = Math.max(23, doc.heightOfString(body, { width: CONTENT_WIDTH - 25, font: 'Helvetica', fontSize: 8, lineGap: 1.5 }))
    const rowHeight = bodyHeight + 23
    doc.roundedRect(MARGIN, y, CONTENT_WIDTH, rowHeight, 6).fillAndStroke(COLORS.white, COLORS.border)
    doc.circle(MARGIN + 12, y + 14, 3).fill(options.kind === 'achievement' ? COLORS.teal : COLORS.coral)
    doc.font('Helvetica-Bold').fontSize(7).fillColor(COLORS.navy).text(description, MARGIN + 22, y + 8, { width: CONTENT_WIDTH - 32 })
    doc.font('Helvetica').fontSize(8).fillColor(COLORS.ink).text(body, MARGIN + 22, y + 20, { width: CONTENT_WIDTH - 32, lineGap: 1.5 })
    y += rowHeight + 6
  })
  return y
}

export function renderReportCardPdf(report) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0, compress: true, info: { Title: `Report Card · ${report.student.usn}`, Author: 'CAMPS' } })
    const chunks = []
    let pageNumber = 1
    let y = 0
    doc.on('data', (chunk) => chunks.push(chunk))
    doc.on('error', reject)
    doc.on('end', () => {
      const pdf = Buffer.concat(chunks)
      if (pdf.length === 0 || pdf.subarray(0, 5).toString() !== '%PDF-') return reject(new Error('Report-card PDF generation returned an invalid document.'))
      resolve(pdf)
    })

    const newPage = () => {
      drawFooter(doc, report, pageNumber)
      doc.addPage({ size: 'A4', margin: 0 })
      pageNumber += 1
      drawContinuationHeader(doc, report)
      y = 82
    }
    const ensureSpace = (height) => { if (y + height > PAGE_HEIGHT - 53) newPage() }

    // College header
    doc.rect(0, 0, PAGE_WIDTH, 112).fill(COLORS.navyDark)
    drawLogo(doc, report, MARGIN, 25, 60)
    doc.font('Helvetica-Bold').fontSize(16).fillColor(COLORS.white).text(report.college.name, MARGIN + 76, 27, { width: 315 })
    doc.font('Helvetica').fontSize(8.5).fillColor('#C7DCDD').text(report.college.location, MARGIN + 76, 51, { width: 300 })
    doc.font('Helvetica-Bold').fontSize(7).fillColor('#87D4C4').text('CENTRALIZED ACADEMIC MONITORING SYSTEM', MARGIN + 76, 72, { width: 300 })
    doc.font('Helvetica-Bold').fontSize(7).fillColor('#BFD4D8').text('OFFICIAL ACADEMIC RECORD', PAGE_WIDTH - MARGIN - 150, 32, { width: 150, align: 'right' })
    doc.font('Helvetica').fontSize(7).fillColor('#BFD4D8').text(`Academic year ${textValue(report.academicYear)}`, PAGE_WIDTH - MARGIN - 150, 48, { width: 150, align: 'right' })

    doc.font('Helvetica-Bold').fontSize(15).fillColor(COLORS.navy).text('INDIVIDUAL STUDENT REPORT CARD', MARGIN, 134, { width: CONTENT_WIDTH })
    doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted).text('Verified academic summary · Keep this document with the student record.', MARGIN, 155, { width: CONTENT_WIDTH })
    y = 184

    y = drawSectionHeading(doc, 'Student information', y, 'Identity and scope attached to this report')
    doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 100, 7).fillAndStroke(COLORS.white, COLORS.border)
    drawLabelValue(doc, 'Student name', report.student.name, MARGIN + 14, y + 14, 245)
    drawLabelValue(doc, 'USN', report.student.usn, MARGIN + 270, y + 14, 230)
    drawLabelValue(doc, 'Email address', report.student.email, MARGIN + 14, y + 49, 245, { fontSize: 8 })
    drawLabelValue(doc, 'Department', report.student.department, MARGIN + 270, y + 49, 105)
    drawLabelValue(doc, 'Semester', `Semester ${report.student.semester}`, MARGIN + 390, y + 49, 110)
    drawLabelValue(doc, 'Section', report.student.section, MARGIN + 14, y + 82, 100)
    drawLabelValue(doc, 'Academic year', report.academicYear, MARGIN + 145, y + 82, 120)
    drawLabelValue(doc, 'Report generated', formatDate(report.generatedAt), MARGIN + 300, y + 82, 200)
    y += 117

    y = drawSectionHeading(doc, 'Academic snapshot', y, 'Values stored in the student academic record')
    const metricGap = 8
    const metricWidth = (CONTENT_WIDTH - metricGap * 2) / 3
    const student = report.student
    const metricRows = [
      [['Attendance percentage', numberValue(student.attendancePercentage, '%')], ['Average internal marks', numberValue(student.averageInternalMarks, '%')], ['Average assignment score', numberValue(student.averageAssignmentScore, '%')]],
      [['Previous GPA', numberValue(student.previousGpa, ' / 10')], ['Current GPA', numberValue(student.currentGpa, ' / 10')], ['Participation score', numberValue(student.participationScore, '%')]],
    ]
    metricRows.forEach((row) => {
      row.forEach((metric, index) => drawMetricCard(doc, MARGIN + index * (metricWidth + metricGap), y, metricWidth, metric[0], metric[1], index === 1 ? COLORS.navy : COLORS.teal))
      y += 55
    })
    y += 2

    ensureSpace(115)
    y = drawSectionHeading(doc, 'Subject-wise marks', y, 'Only subject records available for this student are shown')
    y = drawSubjectTable(doc, report, y) + 16

    ensureSpace(90)
    y = drawPredictionPanel(doc, report, y) + 18

    ensureSpace(75)
    y = drawRecordList(doc, 'Teacher remarks', report.remarks, y, { empty: 'No visible teacher remarks have been recorded for this student.', limit: 5 })
    ensureSpace(75)
    y = drawRecordList(doc, 'Achievements', report.achievements, y, { kind: 'achievement', empty: 'No achievements have been recorded for this student.', limit: 5 })

    ensureSpace(95)
    doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 82, 7).fillAndStroke(COLORS.blueLight, COLORS.border)
    doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.navy).text('AUTHENTICATION', MARGIN + 14, y + 13)
    doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.muted).text('This report is generated from the CAMPS academic record. Missing fields are marked “Not recorded” and have not been inferred.', MARGIN + 14, y + 29, { width: 285, lineGap: 1.5 })
    doc.font('Helvetica').fontSize(7).fillColor(COLORS.muted).text('Teacher signature', MARGIN + 350, y + 23, { width: 125, align: 'center' })
    doc.moveTo(MARGIN + 350, y + 57).lineTo(MARGIN + 475, y + 57).lineWidth(.8).strokeColor(COLORS.navy).stroke()
    doc.font('Helvetica').fontSize(6.5).fillColor(COLORS.muted).text('Signature and date', MARGIN + 350, y + 63, { width: 125, align: 'center' })

    drawFooter(doc, report, pageNumber)
    doc.end()
  })
}

export function reportCardFilename(usn) {
  const safeUsn = String(usn || 'student').replace(/[^A-Za-z0-9_-]+/g, '_')
  return `Report_Card_${safeUsn}.pdf`
}
