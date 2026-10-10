import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import JSZip from 'jszip'

const PAGE = { width: 595.28, height: 841.89, margin: 40 }
const COLORS = {
  navy: rgb(0.07, 0.24, 0.35),
  navyDark: rgb(0.04, 0.15, 0.23),
  teal: rgb(0.17, 0.57, 0.53),
  tealLight: rgb(0.92, 0.97, 0.95),
  blueLight: rgb(0.94, 0.97, 0.98),
  ink: rgb(0.15, 0.29, 0.36),
  muted: rgb(0.45, 0.55, 0.57),
  border: rgb(0.83, 0.90, 0.90),
  soft: rgb(0.97, 0.98, 0.98),
  white: rgb(1, 1, 1),
  coral: rgb(0.85, 0.47, 0.40),
}

function value(value, fallback = 'Not recorded') {
  return value === null || value === undefined || String(value).trim() === '' ? fallback : String(value)
}

function number(valueToFormat, suffix = '', decimals = 2) {
  const parsed = Number(valueToFormat)
  return Number.isFinite(parsed) ? `${parsed.toFixed(decimals)}${suffix}` : 'Not recorded'
}

function compactNumber(valueToFormat, suffix = '', decimals = 1) {
  const parsed = Number(valueToFormat)
  return Number.isFinite(parsed) ? `${parsed.toFixed(decimals)}${suffix}` : 'Not recorded'
}

function safeFilePart(valueToFormat) {
  return String(valueToFormat || 'student').replace(/[^A-Za-z0-9_-]+/g, '_')
}

function dateLabel(dateValue) {
  if (dateValue === null || dateValue === undefined || String(dateValue).trim() === '') return 'Not recorded'
  const date = new Date(dateValue)
  return Number.isNaN(date.getTime()) ? value(dateValue) : new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(date)
}

function wrapLines(text, font, size, width) {
  const words = value(text).split(/\s+/)
  const lines = []
  let line = ''
  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word
    if (font.widthOfTextAtSize(candidate, size) <= width || !line) line = candidate
    else { lines.push(line); line = word }
  })
  if (line) lines.push(line)
  return lines
}

function drawText(page, text, x, y, font, size, color = COLORS.ink, width = null, maxLines = 1) {
  const lines = width ? wrapLines(text, font, size, width).slice(0, maxLines) : [value(text)]
  lines.forEach((line, index) => page.drawText(line, { x, y: y - index * (size + 2), font, size, color }))
  return lines.length * (size + 2)
}

function drawRightText(page, text, x, y, font, size, color, width) {
  const rendered = value(text)
  const textWidth = font.widthOfTextAtSize(rendered, size)
  page.drawText(rendered, { x: x + width - textWidth, y, font, size, color })
}

function drawSectionTitle(page, title, subtitle, y, bold, regular) {
  page.drawText(title.toUpperCase(), { x: PAGE.margin, y, font: bold, size: 9, color: COLORS.navy })
  if (subtitle) page.drawText(subtitle, { x: PAGE.margin, y: y - 14, font: regular, size: 7, color: COLORS.muted })
  return y - (subtitle ? 30 : 18)
}

function drawLabelValue(page, label, fieldValue, x, y, width, bold, regular) {
  page.drawText(label.toUpperCase(), { x, y, font: bold, size: 6, color: COLORS.muted })
  drawText(page, fieldValue, x, y - 12, regular, 8, COLORS.ink, width, 1)
}

function drawMetric(page, x, y, width, label, fieldValue, bold) {
  page.drawRectangle({ x, y: y - 43, width, height: 43, color: COLORS.soft, borderColor: COLORS.border, borderWidth: 0.7 })
  page.drawRectangle({ x, y: y - 43, width: 4, height: 43, color: COLORS.teal })
  page.drawText(label.toUpperCase(), { x: x + 11, y: y - 14, font: bold, size: 6, color: COLORS.muted })
  drawText(page, fieldValue, x + 11, y - 30, bold, 11, COLORS.navy, width - 17, 1)
}

function drawFooter(page, report, regular, pageNumber) {
  page.drawLine({ start: { x: PAGE.margin, y: 34 }, end: { x: PAGE.width - PAGE.margin, y: 34 }, thickness: 0.5, color: COLORS.border })
  page.drawText('CAMPS · Centralized Academic Monitoring System', { x: PAGE.margin, y: 22, font: regular, size: 6, color: COLORS.muted })
  drawRightText(page, `Generated ${dateLabel(report.generatedAt)}`, PAGE.width - PAGE.margin - 170, 22, regular, 6, COLORS.muted, 135)
  drawRightText(page, `Page ${pageNumber}`, PAGE.width - PAGE.margin - 35, 22, regular, 6, COLORS.muted, 35)
}

function drawHeader(page, report, bold, regular, continuation = false) {
  if (continuation) {
    page.drawRectangle({ x: PAGE.margin, y: PAGE.height - 67, width: PAGE.width - PAGE.margin * 2, height: 30, color: COLORS.blueLight })
    page.drawText('CAMPS · INDIVIDUAL STUDENT REPORT CARD', { x: PAGE.margin + 12, y: PAGE.height - 55, font: bold, size: 7, color: COLORS.navy })
    drawRightText(page, `${report.student.name} · ${report.student.usn}`, PAGE.width - PAGE.margin - 190, PAGE.height - 55, regular, 7, COLORS.teal, 178)
    return PAGE.height - 98
  }
  page.drawRectangle({ x: 0, y: PAGE.height - 112, width: PAGE.width, height: 112, color: COLORS.navyDark })
  page.drawRectangle({ x: PAGE.margin, y: PAGE.height - 85, width: 60, height: 60, color: COLORS.teal })
  page.drawRectangle({ x: PAGE.margin + 5, y: PAGE.height - 80, width: 50, height: 50, borderColor: rgb(0.72, 0.89, 0.84), borderWidth: 1 })
  page.drawText('Logo not recorded', { x: PAGE.margin + 7, y: PAGE.height - 62, font: bold, size: 7, color: COLORS.white, maxWidth: 46 })
  page.drawText(value(report.college?.name), { x: PAGE.margin + 76, y: PAGE.height - 42, font: bold, size: 14, color: COLORS.white })
  page.drawText(value(report.college?.location), { x: PAGE.margin + 76, y: PAGE.height - 62, font: regular, size: 8, color: rgb(0.78, 0.86, 0.86) })
  page.drawText('CENTRALIZED ACADEMIC MONITORING SYSTEM', { x: PAGE.margin + 76, y: PAGE.height - 82, font: bold, size: 6.5, color: rgb(0.53, 0.83, 0.77) })
  drawRightText(page, 'OFFICIAL ACADEMIC RECORD', PAGE.width - PAGE.margin - 160, PAGE.height - 43, bold, 6.5, rgb(0.75, 0.83, 0.85), 145)
  drawRightText(page, `Academic year ${value(report.academicYear)}`, PAGE.width - PAGE.margin - 160, PAGE.height - 59, regular, 6.5, rgb(0.75, 0.83, 0.85), 145)
  page.drawText('INDIVIDUAL STUDENT REPORT CARD', { x: PAGE.margin, y: PAGE.height - 140, font: bold, size: 14, color: COLORS.navy })
  page.drawText('Verified academic summary · Keep this document with the student record.', { x: PAGE.margin, y: PAGE.height - 160, font: regular, size: 7, color: COLORS.muted })
  return PAGE.height - 190
}

function drawSubjectTable(page, subjects, y, bold, regular) {
  const columns = [
    ['CODE', 55], ['SUBJECT', 165], ['CREDITS', 55], ['ATTENDANCE', 82], ['INTERNAL', 78], ['ASSIGNMENTS', 80],
  ]
  const startX = PAGE.margin
  page.drawRectangle({ x: startX, y: y - 22, width: PAGE.width - PAGE.margin * 2, height: 22, color: COLORS.teal })
  let x = startX
  columns.forEach(([label, width]) => { page.drawText(label, { x: x + 5, y: y - 14, font: bold, size: 5.6, color: COLORS.white }); x += width })
  let cursor = y - 22
  const rows = subjects || []
  if (!rows.length) {
    page.drawRectangle({ x: startX, y: cursor - 30, width: PAGE.width - PAGE.margin * 2, height: 30, color: COLORS.soft, borderColor: COLORS.border, borderWidth: 0.6 })
    page.drawText('No subject-wise marks have been recorded for this student.', { x: startX + 10, y: cursor - 18, font: regular, size: 7, color: COLORS.muted })
    return cursor - 43
  }
  rows.forEach((subject, index) => {
    const rowHeight = 27
    page.drawRectangle({ x: startX, y: cursor - rowHeight, width: PAGE.width - PAGE.margin * 2, height: rowHeight, color: index % 2 ? COLORS.soft : COLORS.white, borderColor: COLORS.border, borderWidth: 0.5 })
    let cellX = startX
    const values = [
      value(subject.subjectCode), value(subject.subjectName), compactNumber(subject.credits), compactNumber(subject.attendancePercentage, '%'), compactNumber(subject.averageInternalMarks, '%'), compactNumber(subject.assignmentScore, '%'),
    ]
    columns.forEach(([_, width], valueIndex) => {
      const font = valueIndex === 1 ? regular : bold
      const text = values[valueIndex]
      const textWidth = font.widthOfTextAtSize(text, 6.5)
      const textX = valueIndex === 1 ? cellX + 5 : cellX + Math.max(5, (width - textWidth) / 2)
      page.drawText(text, { x: textX, y: cursor - 17, font, size: 6.5, color: COLORS.ink, maxWidth: width - 10 })
      cellX += width
    })
    cursor -= rowHeight
  })
  return cursor - 14
}

function drawRecords(page, title, records, y, bold, regular, kind) {
  const startY = drawSectionTitle(page, title, '', y, bold, regular)
  const items = records || []
  if (!items.length) {
    page.drawRectangle({ x: PAGE.margin, y: startY - 27, width: PAGE.width - PAGE.margin * 2, height: 27, color: COLORS.soft, borderColor: COLORS.border, borderWidth: 0.6 })
    page.drawText('No records have been recorded for this student.', { x: PAGE.margin + 10, y: startY - 17, font: regular, size: 7, color: COLORS.muted })
    return startY - 40
  }
  let cursor = startY
  items.slice(0, 5).forEach((item) => {
    const heading = kind === 'achievement' ? `${value(item.achievementType, 'Achievement')} · ${dateLabel(item.date)}` : `${value(item.label, 'Teacher remark')} · ${dateLabel(item.date)}`
    const body = kind === 'achievement' ? `${value(item.title)} — ${value(item.description)}` : value(item.note)
    page.drawRectangle({ x: PAGE.margin, y: cursor - 35, width: PAGE.width - PAGE.margin * 2, height: 35, color: COLORS.white, borderColor: COLORS.border, borderWidth: 0.6 })
    page.drawCircle({ x: PAGE.margin + 12, y: cursor - 13, size: 3, color: kind === 'achievement' ? COLORS.teal : COLORS.coral })
    page.drawText(heading, { x: PAGE.margin + 22, y: cursor - 13, font: bold, size: 6.5, color: COLORS.navy })
    drawText(page, body, PAGE.margin + 22, cursor - 25, regular, 6.8, COLORS.ink, PAGE.width - PAGE.margin * 2 - 32, 1)
    cursor -= 42
  })
  return cursor
}

export async function createClientReportCardPdf(reportInput = {}) {
  const report = {
    ...reportInput,
    academicYear: reportInput.academicYear,
    generatedAt: reportInput.generatedAt || new Date().toISOString(),
    college: reportInput.college || {},
    prediction: reportInput.prediction || { result: reportInput.student?.result, risk: reportInput.student?.risk },
  }
  const pdf = await PDFDocument.create()
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  let pageNumber = 1
  let page = pdf.addPage([PAGE.width, PAGE.height])
  let y = drawHeader(page, report, bold, regular)
  const newPage = () => {
    drawFooter(page, report, regular, pageNumber)
    page = pdf.addPage([PAGE.width, PAGE.height])
    pageNumber += 1
    y = drawHeader(page, report, bold, regular, true)
  }
  const ensure = (height) => { if (y - height < 55) newPage() }
  const student = report.student || {}

  y = drawSectionTitle(page, 'Student information', 'Identity and scope attached to this report', y, bold, regular)
  page.drawRectangle({ x: PAGE.margin, y: y - 95, width: PAGE.width - PAGE.margin * 2, height: 95, color: COLORS.white, borderColor: COLORS.border, borderWidth: 0.7 })
  drawLabelValue(page, 'Student name', student.name, PAGE.margin + 14, y - 16, 245, bold, regular)
  drawLabelValue(page, 'USN', student.usn, PAGE.margin + 270, y - 16, 230, bold, regular)
  drawLabelValue(page, 'Email address', student.email, PAGE.margin + 14, y - 48, 245, bold, regular)
  drawLabelValue(page, 'Department', student.department, PAGE.margin + 270, y - 48, 105, bold, regular)
  drawLabelValue(page, 'Semester', `Semester ${value(student.semester)}`, PAGE.margin + 390, y - 48, 110, bold, regular)
  drawLabelValue(page, 'Section', student.section, PAGE.margin + 14, y - 79, 100, bold, regular)
  drawLabelValue(page, 'Academic year', report.academicYear, PAGE.margin + 145, y - 79, 120, bold, regular)
  drawLabelValue(page, 'Report generated', dateLabel(report.generatedAt), PAGE.margin + 300, y - 79, 200, bold, regular)
  y -= 112

  y = drawSectionTitle(page, 'Academic snapshot', 'Values stored in the student academic record', y, bold, regular)
  const gap = 8
  const metricWidth = (PAGE.width - PAGE.margin * 2 - gap * 2) / 3
  const metricRows = [
    [['Attendance percentage', number(student.attendancePercentage, '%')], ['Average internal marks', number(student.averageInternalMarks, '%')], ['Average assignment score', number(student.averageAssignmentScore, '%')]],
    [['Previous GPA', number(student.previousGpa, ' / 10')], ['Current GPA', number(student.currentGpa, ' / 10')], ['Participation score', number(student.participationScore, '%')]],
  ]
  metricRows.forEach((row) => {
    row.forEach((metric, index) => drawMetric(page, PAGE.margin + index * (metricWidth + gap), y, metricWidth, metric[0], metric[1], bold))
    y -= 52
  })
  y -= 4

  ensure(115)
  y = drawSectionTitle(page, 'Subject-wise marks', 'Only subject records available for this student are shown', y, bold, regular)
  y = drawSubjectTable(page, report.subjects, y, bold, regular)

  ensure(72)
  page.drawRectangle({ x: PAGE.margin, y: y - 67, width: PAGE.width - PAGE.margin * 2, height: 67, color: COLORS.navyDark })
  page.drawText('ACADEMIC PREDICTION', { x: PAGE.margin + 14, y: y - 16, font: bold, size: 6.5, color: rgb(0.66, 0.86, 0.81) })
  page.drawText(value(report.prediction?.result), { x: PAGE.margin + 14, y: y - 34, font: bold, size: 13, color: COLORS.white })
  page.drawText('RISK LEVEL', { x: PAGE.margin + 270, y: y - 16, font: bold, size: 6.5, color: rgb(0.66, 0.86, 0.81) })
  page.drawText(value(report.prediction?.risk), { x: PAGE.margin + 270, y: y - 34, font: bold, size: 11, color: COLORS.white })
  y -= 84

  ensure(80)
  y = drawRecords(page, 'Teacher remarks', report.remarks, y, bold, regular, 'remark')
  ensure(80)
  y = drawRecords(page, 'Achievements', report.achievements, y, bold, regular, 'achievement')
  ensure(82)
  page.drawRectangle({ x: PAGE.margin, y: y - 75, width: PAGE.width - PAGE.margin * 2, height: 75, color: COLORS.blueLight, borderColor: COLORS.border, borderWidth: 0.7 })
  page.drawText('AUTHENTICATION', { x: PAGE.margin + 14, y: y - 17, font: bold, size: 7, color: COLORS.navy })
  drawText(page, 'This report is generated from the CAMPS academic record. Missing fields are marked “Not recorded” and have not been inferred.', PAGE.margin + 14, y - 32, regular, 7, COLORS.muted, 280, 3)
  page.drawText('Teacher signature', { x: PAGE.margin + 350, y: y - 27, font: regular, size: 7, color: COLORS.muted })
  page.drawLine({ start: { x: PAGE.margin + 340, y: y - 55 }, end: { x: PAGE.margin + 475, y: y - 55 }, thickness: 0.7, color: COLORS.navy })
  page.drawText('Signature and date', { x: PAGE.margin + 350, y: y - 66, font: regular, size: 6, color: COLORS.muted })
  drawFooter(page, report, regular, pageNumber)
  const bytes = await pdf.save()
  return new Blob([bytes], { type: 'application/pdf' })
}

export async function createClientReportCardsZip(reports = []) {
  const zip = new JSZip()
  for (const report of reports) {
    const pdf = await createClientReportCardPdf(report)
    zip.file(`Report_Card_${safeFilePart(report.student?.usn)}.pdf`, await pdf.arrayBuffer())
  }
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
}

export { safeFilePart }
