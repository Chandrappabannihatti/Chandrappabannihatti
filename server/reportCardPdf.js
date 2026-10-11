import PDFDocument from 'pdfkit'
import { existsSync } from 'node:fs'

const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89
const MARGIN = 40
const CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2)
const FOOTER_TOP = PAGE_HEIGHT - 52
const DEFAULT_COLLEGE_NAME = 'PES Institute of Technology and Management'
const DEFAULT_COLLEGE_LOCATION = 'Shivamogga, Karnataka'

const COLORS = {
  navy: '#0B2D46',
  navyDark: '#071F35',
  navySoft: '#123E5A',
  teal: '#167F80',
  tealDark: '#0E626C',
  tealLight: '#EAF7F3',
  blueLight: '#EFF6FA',
  ink: '#203E52',
  muted: '#617783',
  border: '#D6E3E8',
  soft: '#F7FAFB',
  gold: '#B1843B',
  goldLight: '#FBF5E8',
  coral: '#B95D59',
  coralLight: '#FFF0EF',
  white: '#FFFFFF',
}

function textValue(value, fallback = 'Not recorded') {
  if (value === null || value === undefined || String(value).trim() === '') return fallback
  return String(value)
}

function numberValue(value, suffix = '', decimals = 2) {
  if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) return 'Not recorded'
  return `${Number(value).toFixed(decimals)}${suffix}`
}

function compactNumber(value, suffix = '', decimals = 1) {
  if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) return 'Not recorded'
  return `${Number(value).toFixed(decimals)}${suffix}`
}

function formatDate(value, includeTime = false) {
  if (value === null || value === undefined || String(value).trim() === '') return 'Not Provided'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return textValue(value, 'Not Provided')
  return new Intl.DateTimeFormat('en-IN', includeTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' }).format(date)
}

function academicYearValue(report) {
  const value = report?.academicYear || report?.student?.academicYear
  return value === null || value === undefined || String(value).trim() === '' ? null : String(value)
}

function academicYearLabel(report) {
  const year = academicYearValue(report)
  return year ? `Academic Year: ${year}` : 'Academic Year: Not Provided'
}

function collegeName(report) {
  const name = textValue(report?.college?.name, DEFAULT_COLLEGE_NAME)
  const location = textValue(report?.college?.location, DEFAULT_COLLEGE_LOCATION)
  if (!location || name.toLowerCase().includes(location.toLowerCase())) return name
  return `${name}, ${location}`
}

function collegeLocation(report) {
  return textValue(report?.college?.location, DEFAULT_COLLEGE_LOCATION)
}

function drawWrapped(doc, value, x, y, width, options = {}) {
  const settings = { width, lineGap: 2, ...options }
  const content = textValue(value)
  doc.text(content, x, y, settings)
  return doc.heightOfString(content, settings)
}

function drawLogo(doc, report, x, y, size) {
  if (report?.college?.logoPath && existsSync(report.college.logoPath)) {
    try {
      doc.roundedRect(x, y, size, size, 10).fill(COLORS.white)
      doc.image(report.college.logoPath, x + 5, y + 5, { fit: [size - 10, size - 10], align: 'center', valign: 'center' })
      return
    } catch { /* use the labelled placeholder when the configured asset is unavailable */ }
  }
  doc.roundedRect(x, y, size, size, 10).fillAndStroke(COLORS.teal, '#75C6BD')
  doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.white).text('College', x + 6, y + 22, { width: size - 12, align: 'center' })
  doc.text('Logo', x + 6, y + 34, { width: size - 12, align: 'center' })
}

function drawSectionHeading(doc, title, y, subtitle = '') {
  doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.navy).text(title.toUpperCase(), MARGIN, y)
  doc.moveTo(MARGIN, y + 17).lineTo(MARGIN + 34, y + 17).lineWidth(2).strokeColor(COLORS.teal).stroke()
  if (subtitle) doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.muted).text(subtitle, MARGIN + 46, y + 1, { width: CONTENT_WIDTH - 46 })
  return y + 30
}

function drawLabelValue(doc, label, value, x, y, width, options = {}) {
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(COLORS.muted).text(label.toUpperCase(), x, y, { width })
  doc.font('Helvetica').fontSize(options.fontSize || 10).fillColor(COLORS.ink).text(textValue(value), x, y + 12, { width, height: options.height || 22, ellipsis: true })
}

function badgeStyle(type, value) {
  const normalized = String(value || '').toLowerCase()
  if (type === 'result' && normalized === 'pass') return { fill: COLORS.tealLight, text: COLORS.tealDark, border: '#9BD3C9' }
  if (type === 'result' && normalized === 'fail') return { fill: COLORS.coralLight, text: COLORS.coral, border: '#E5B5B1' }
  if (normalized.includes('low')) return { fill: COLORS.tealLight, text: COLORS.tealDark, border: '#9BD3C9' }
  if (normalized.includes('medium')) return { fill: COLORS.goldLight, text: COLORS.gold, border: '#E6D19C' }
  if (normalized.includes('high')) return { fill: COLORS.coralLight, text: COLORS.coral, border: '#E5B5B1' }
  return { fill: COLORS.blueLight, text: COLORS.muted, border: COLORS.border }
}

function drawBadge(doc, label, value, x, y, width = 110, type = 'status') {
  const style = badgeStyle(type, value)
  doc.roundedRect(x, y, width, 25, 6).fillAndStroke(style.fill, style.border)
  doc.font('Helvetica-Bold').fontSize(7).fillColor(style.text).text(label.toUpperCase(), x + 8, y + 5, { width: width - 16 })
  doc.font('Helvetica-Bold').fontSize(10).fillColor(style.text).text(textValue(value), x + 8, y + 13, { width: width - 16, ellipsis: true })
}

function drawFooter(doc, report, pageNumber) {
  const y = PAGE_HEIGHT - 31
  doc.moveTo(MARGIN, y - 9).lineTo(PAGE_WIDTH - MARGIN, y - 9).lineWidth(.6).strokeColor(COLORS.border).stroke()
  doc.font('Helvetica').fontSize(6.8).fillColor(COLORS.muted).text(collegeName(report), MARGIN, y, { width: 275, ellipsis: true })
  doc.text(`Generated ${formatDate(report.generatedAt, true)}`, PAGE_WIDTH - MARGIN - 188, y, { width: 145, align: 'right' })
  doc.text(`Page ${pageNumber}`, PAGE_WIDTH - MARGIN - 35, y, { width: 35, align: 'right' })
}

function drawContinuationHeader(doc, report) {
  doc.roundedRect(MARGIN, 27, CONTENT_WIDTH, 38, 6).fillAndStroke(COLORS.blueLight, COLORS.border)
  doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.navy).text('CAMPS — INDIVIDUAL STUDENT ACADEMIC REPORT CARD', MARGIN + 12, 37, { width: 345 })
  doc.font('Helvetica').fontSize(8).fillColor(COLORS.tealDark).text(`${textValue(report?.student?.name)} · ${textValue(report?.student?.usn)}`, PAGE_WIDTH - MARGIN - 174, 39, { width: 162, align: 'right', ellipsis: true })
  doc.font('Helvetica').fontSize(6.5).fillColor(COLORS.muted).text(collegeName(report), MARGIN + 12, 52, { width: 350, ellipsis: true })
}

function drawMetricCard(doc, x, y, width, label, value, accent = COLORS.teal) {
  const height = 57
  doc.roundedRect(x, y, width, height, 8).fillAndStroke(COLORS.white, COLORS.border)
  doc.roundedRect(x, y, 5, height, 3).fill(accent)
  doc.font('Helvetica-Bold').fontSize(7).fillColor(COLORS.muted).text(label.toUpperCase(), x + 14, y + 11, { width: width - 20 })
  doc.font('Helvetica-Bold').fontSize(15).fillColor(COLORS.navy).text(value, x + 14, y + 27, { width: width - 20, ellipsis: true })
}

function drawPredictionPanel(doc, report, y) {
  const height = 91
  const prediction = report?.prediction || {}
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, height, 9).fillAndStroke(COLORS.navyDark, COLORS.navyDark)
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#A9DCD0').text('ACADEMIC PREDICTION', MARGIN + 16, y + 13)
  doc.font('Helvetica').fontSize(8).fillColor('#C6DADB').text('Stored support signal from the selected academic record.', MARGIN + 16, y + 28, { width: 230 })
  drawBadge(doc, 'Result', prediction.result, MARGIN + 16, y + 48, 112, 'result')
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#A9DCD0').text('RISK LEVEL', MARGIN + 270, y + 13)
  doc.font('Helvetica').fontSize(8).fillColor('#C6DADB').text(prediction.modelVersion ? `Model version: ${prediction.modelVersion}` : 'Model version not provided', MARGIN + 270, y + 28, { width: 220, ellipsis: true })
  drawBadge(doc, 'Risk', prediction.risk, MARGIN + 270, y + 48, 125, 'risk')
  return y + height
}

function subjectTableHeight(report, options = {}) {
  const rows = options.rows || report?.subjects || []
  const rowHeight = options.rowHeight || 28
  const additionalHeight = options.additionalCount ? 12 : 0
  return rows.length ? 26 + rows.length * rowHeight + additionalHeight : 61
}

function drawSubjectTable(doc, report, y, options = {}) {
  const columns = [
    { key: 'subjectCode', label: 'CODE', width: 58 },
    { key: 'subjectName', label: 'SUBJECT', width: 157 },
    { key: 'credits', label: 'CREDITS', width: 57 },
    { key: 'attendancePercentage', label: 'ATTENDANCE', width: 84 },
    { key: 'averageInternalMarks', label: 'INTERNAL', width: 78 },
    { key: 'assignmentScore', label: 'ASSIGNMENTS', width: 81 },
  ]
  const rowHeight = options.rowHeight || 28
  const compact = rowHeight <= 20
  const headerHeight = 26
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, headerHeight, 6).fill(COLORS.teal)
  let x = MARGIN
  columns.forEach((column) => {
    doc.font('Helvetica-Bold').fontSize(7).fillColor(COLORS.white).text(column.label, x + 6, y + 9, { width: column.width - 12, align: column.key === 'subjectName' ? 'left' : 'center' })
    x += column.width
  })
  y += headerHeight
  const rows = options.rows || report?.subjects || []
  if (!rows.length) {
    const height = 35
    doc.rect(MARGIN, y, CONTENT_WIDTH, height).fillAndStroke(COLORS.soft, COLORS.border)
    doc.font('Helvetica-Oblique').fontSize(8.5).fillColor(COLORS.muted).text('Subject-wise marks have not been recorded yet.', MARGIN + 10, y + 12, { width: CONTENT_WIDTH - 20, align: 'center' })
    return y + height
  }
  rows.forEach((subject, index) => {
    doc.rect(MARGIN, y, CONTENT_WIDTH, rowHeight).fillAndStroke(index % 2 ? COLORS.soft : COLORS.white, COLORS.border)
    let cellX = MARGIN
    columns.forEach((column) => {
      const raw = column.key === 'assignmentScore' ? subject.assignmentScore ?? subject.averageAssignmentScore : subject[column.key]
      const value = column.key === 'credits'
        ? compactNumber(raw, '', 1)
        : ['attendancePercentage', 'averageInternalMarks', 'assignmentScore'].includes(column.key)
          ? compactNumber(raw, '%', 1)
          : textValue(raw)
      const isName = column.key === 'subjectName'
      const fontSize = isName ? (compact ? 7.1 : 8.2) : (compact ? 7.1 : 8)
      const textTop = compact ? (isName ? 4 : 5) : (isName ? 8 : 11)
      doc.font(isName ? 'Helvetica' : 'Helvetica-Bold').fontSize(fontSize).fillColor(COLORS.ink).text(value, cellX + 6, y + textTop, { width: column.width - 12, height: rowHeight - (compact ? 4 : 10), lineGap: 0, align: isName ? 'left' : 'center', ellipsis: true })
      cellX += column.width
    })
    y += rowHeight
  })
  if (options.additionalCount) {
    doc.font('Helvetica-Oblique').fontSize(7.5).fillColor(COLORS.muted).text(`+ ${options.additionalCount} additional subject record(s) available in CAMPS.`, MARGIN, y + 1, { width: CONTENT_WIDTH, ellipsis: true })
    y += 12
  }
  return y
}

function recordBody(item, kind) {
  if (kind === 'achievement') return `${textValue(item.title)}${item.description ? ` — ${item.description}` : ''}`
  return textValue(item.note)
}

function drawRecordList(doc, title, items, y, options = {}) {
  const compact = options.compact === true
  const cardHeight = compact ? 37 : 45
  const cardGap = compact ? 3 : 5
  const emptyHeight = compact ? 30 : 35
  y = drawSectionHeading(doc, title, y, options.subtitle || '')
  const list = Array.isArray(items) ? items : []
  if (!list.length) {
    doc.roundedRect(MARGIN, y, CONTENT_WIDTH, emptyHeight, 7).fillAndStroke(COLORS.soft, COLORS.border)
    doc.font('Helvetica-Oblique').fontSize(compact ? 7.8 : 8.5).fillColor(COLORS.muted).text(options.empty || 'No records have been recorded for this student.', MARGIN + 12, y + (compact ? 10 : 13), { width: CONTENT_WIDTH - 24, height: emptyHeight - 12, ellipsis: true })
    return y + (compact ? 39 : 47)
  }
  const visible = list.slice(0, options.limit || (compact ? 1 : 2))
  visible.forEach((item) => {
    const heading = options.kind === 'achievement'
      ? `${textValue(item.achievementType, 'Achievement')} · ${formatDate(item.date)}`
      : `${textValue(item.label, 'Teacher remark')} · ${formatDate(item.date)}`
    const body = recordBody(item, options.kind)
    doc.roundedRect(MARGIN, y, CONTENT_WIDTH, cardHeight, 7).fillAndStroke(COLORS.white, COLORS.border)
    doc.circle(MARGIN + 14, y + (compact ? 14 : 17), compact ? 3 : 3.5).fill(options.kind === 'achievement' ? COLORS.teal : COLORS.gold)
    doc.font('Helvetica-Bold').fontSize(compact ? 7.5 : 8).fillColor(COLORS.navy).text(heading, MARGIN + 26, y + (compact ? 7 : 10), { width: CONTENT_WIDTH - 38, ellipsis: true })
    doc.font('Helvetica').fontSize(compact ? 7.5 : 8.5).fillColor(COLORS.ink).text(body, MARGIN + 26, y + (compact ? 21 : 25), { width: CONTENT_WIDTH - 38, height: compact ? 10 : 18, lineGap: 1, ellipsis: true })
    y += cardHeight + cardGap
  })
  if (list.length > visible.length) {
    doc.font('Helvetica-Oblique').fontSize(7.5).fillColor(COLORS.muted).text(`+ ${list.length - visible.length} additional record(s) available in CAMPS.`, MARGIN, y + 1, { width: CONTENT_WIDTH, ellipsis: true })
    y += compact ? 9 : 12
  }
  return y
}

function drawAuthenticationPanel(doc, report, y, options = {}) {
  const height = options.compact ? 94 : 100
  const signature = report?.teacherSignature || report?.teacher?.signature || report?.signature?.teacher
  const signatureDate = report?.signatureDate || report?.signature?.date
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, height, 8).fillAndStroke(COLORS.blueLight, COLORS.border)
  doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.navy).text('AUTHENTICATION AND SIGN-OFF', MARGIN + 15, y + 14)
  doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted).text('This report is generated from the CAMPS academic record. Missing fields are marked “Not recorded” and have not been inferred.', MARGIN + 15, y + 33, { width: 280, lineGap: 2 })
  doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.navy).text('Teacher signature', MARGIN + 340, y + 31, { width: 145, align: 'center' })
  doc.moveTo(MARGIN + 340, y + 61).lineTo(MARGIN + 485, y + 61).lineWidth(.8).strokeColor(COLORS.navy).stroke()
  doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.muted).text(`Signature: ${textValue(signature, 'Not Provided')}`, MARGIN + 340, y + 68, { width: 145, align: 'center', ellipsis: true })
  doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.muted).text(`Signature date: ${signatureDate ? formatDate(signatureDate) : 'Not Provided'}`, MARGIN + 340, y + 84, { width: 145, align: 'center', ellipsis: true })
  return y + height
}

export function renderReportCardPdf(report) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0, compress: true, info: { Title: `Individual Student Academic Report Card · ${textValue(report?.student?.usn)}`, Author: 'CAMPS', Subject: collegeName(report), Keywords: 'CAMPS, academic report card' } })
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
      y = 86
    }
    const ensureSpace = (height) => { if (y + height > FOOTER_TOP) newPage() }

    // Branded college header. The fallback logo is deliberately labelled
    // “College Logo” rather than presenting missing metadata as the logo.
    doc.rect(0, 0, PAGE_WIDTH, 132).fill(COLORS.navyDark)
    drawLogo(doc, report, MARGIN, 24, 72)
    doc.font('Helvetica-Bold').fontSize(17).fillColor(COLORS.white).text(collegeName(report), MARGIN + 90, 27, { width: 300, height: 42, lineGap: 2 })
    doc.font('Helvetica').fontSize(9).fillColor('#C7DCDD').text(collegeLocation(report), MARGIN + 90, 78, { width: 300 })
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#8DD6C8').text('CAMPS — Centralized Academic Monitoring System', MARGIN + 90, 98, { width: 340 })
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#BFD4D8').text('OFFICIAL ACADEMIC RECORD', PAGE_WIDTH - MARGIN - 145, 34, { width: 145, align: 'right' })
    doc.font('Helvetica').fontSize(8).fillColor('#BFD4D8').text(academicYearLabel(report), PAGE_WIDTH - MARGIN - 145, 53, { width: 145, align: 'right' })

    doc.font('Helvetica-Bold').fontSize(17).fillColor(COLORS.navy).text('INDIVIDUAL STUDENT ACADEMIC REPORT CARD', MARGIN, 153, { width: CONTENT_WIDTH })
    doc.font('Helvetica').fontSize(9).fillColor(COLORS.muted).text('Official academic summary · Prepared for academic documentation and printing.', MARGIN, 177, { width: CONTENT_WIDTH })
    y = 205

    y = drawSectionHeading(doc, 'Student information', y, 'Identity and scope attached to this report')
    doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 113, 8).fillAndStroke(COLORS.white, COLORS.border)
    const student = report?.student || {}
    drawLabelValue(doc, 'Student name', student.name, MARGIN + 15, y + 15, 235)
    drawLabelValue(doc, 'USN', student.usn, MARGIN + 270, y + 15, 110)
    drawLabelValue(doc, 'Report generated', formatDate(report.generatedAt), MARGIN + 398, y + 15, 102, { fontSize: 9 })
    drawLabelValue(doc, 'Email address', student.email, MARGIN + 15, y + 49, 235, { fontSize: 9 })
    drawLabelValue(doc, 'Department', student.department, MARGIN + 270, y + 49, 105)
    drawLabelValue(doc, 'Semester', student.semester ? `Semester ${student.semester}` : null, MARGIN + 398, y + 49, 102)
    drawLabelValue(doc, 'Section', student.section, MARGIN + 15, y + 83, 105)
    drawLabelValue(doc, 'Academic year', academicYearValue(report) || 'Not Provided', MARGIN + 145, y + 83, 150)
    drawLabelValue(doc, 'Record status', student.result || 'Not recorded', MARGIN + 330, y + 83, 170)
    y += 133

    y = drawSectionHeading(doc, 'Academic snapshot', y, 'Values stored in the selected student academic record')
    const metricGap = 9
    const metricWidth = (CONTENT_WIDTH - metricGap * 2) / 3
    const metricRows = [
      [['Attendance percentage', numberValue(student.attendancePercentage, '%')], ['Average internal marks', numberValue(student.averageInternalMarks, '%')], ['Average assignment score', numberValue(student.averageAssignmentScore, '%')]],
      [['Previous GPA', numberValue(student.previousGpa, ' / 10')], ['Current GPA', numberValue(student.currentGpa, ' / 10')], ['Participation score', numberValue(student.participationScore, '%')]],
    ]
    metricRows.forEach((row) => {
      row.forEach((metric, index) => drawMetricCard(doc, MARGIN + index * (metricWidth + metricGap), y, metricWidth, metric[0], metric[1], index === 1 ? COLORS.navySoft : COLORS.teal))
      y += 66
    })
    y += 4

    const subjects = Array.isArray(report?.subjects) ? report.subjects : []
    const compactSubjectLayout = subjects.length > 8
    if (compactSubjectLayout) {
      // Dense academic schedules still stay within the two-page print limit:
      // keep the first four actual rows on page one and continue the table on
      // page two with a compact row treatment. Never fabricate overflow rows.
      y = drawSectionHeading(doc, 'Subject-wise marks', y, 'Actual subject records for this student and semester')
      y = drawSubjectTable(doc, report, y, { rows: subjects.slice(0, 4), rowHeight: 17 }) + 6
      newPage()
      y = drawSectionHeading(doc, 'Subject-wise marks continued', y, 'Remaining actual subject records')
      const continuationRows = subjects.slice(4, 20)
      y = drawSubjectTable(doc, report, y, {
        rows: continuationRows,
        rowHeight: 17,
        additionalCount: Math.max(0, subjects.length - 4 - continuationRows.length),
      }) + 6
      y = drawPredictionPanel(doc, report, y) + 10
      y = drawRecordList(doc, 'Teacher remarks', report?.remarks, y, { compact: true, limit: 1, empty: 'No visible teacher remarks have been recorded for this student.' })
      y = drawRecordList(doc, 'Achievements', report?.achievements, y, { kind: 'achievement', compact: true, limit: 1, empty: 'No achievements have been recorded for this student.' })
      drawAuthenticationPanel(doc, report, y, { compact: true })
    } else {
      const subjectHeight = subjectTableHeight(report, { rowHeight: 28 })
      ensureSpace(34 + subjectHeight + 108)
      y = drawSectionHeading(doc, 'Subject-wise marks', y, 'Actual subject records for this student and semester')
      y = drawSubjectTable(doc, report, y, { rowHeight: 28 }) + 19

      ensureSpace(108)
      y = drawPredictionPanel(doc, report, y) + 20

      ensureSpace(80)
      y = drawRecordList(doc, 'Teacher remarks', report?.remarks, y, { compact: true, limit: 1, empty: 'No visible teacher remarks have been recorded for this student.' })
      ensureSpace(80)
      y = drawRecordList(doc, 'Achievements', report?.achievements, y, { kind: 'achievement', compact: true, limit: 1, empty: 'No achievements have been recorded for this student.' })
      ensureSpace(118)
      drawAuthenticationPanel(doc, report, y)
    }

    drawFooter(doc, report, pageNumber)
    doc.end()
  })
}

export function reportCardFilename(usn) {
  const safeUsn = String(usn || 'student').replace(/[^A-Za-z0-9_-]+/g, '_')
  return `Report_Card_${safeUsn}.pdf`
}
