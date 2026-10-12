import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import JSZip from 'jszip'

const PAGE = { width: 595.28, height: 841.89, margin: 40 }
const CONTENT_WIDTH = PAGE.width - PAGE.margin * 2
const FOOTER_TOP = PAGE.height - 52
const DEFAULT_COLLEGE_NAME = 'PES Institute of Technology and Management'
const DEFAULT_COLLEGE_LOCATION = 'Shivamogga, Karnataka'
const COLORS = {
  navy: rgb(0.04, 0.18, 0.28),
  navyDark: rgb(0.03, 0.12, 0.21),
  navySoft: rgb(0.07, 0.30, 0.44),
  teal: rgb(0.09, 0.50, 0.50),
  tealDark: rgb(0.05, 0.39, 0.42),
  tealLight: rgb(0.92, 0.97, 0.95),
  blueLight: rgb(0.94, 0.97, 0.98),
  ink: rgb(0.12, 0.24, 0.32),
  muted: rgb(0.38, 0.48, 0.53),
  border: rgb(0.84, 0.89, 0.91),
  soft: rgb(0.97, 0.98, 0.98),
  gold: rgb(0.69, 0.51, 0.23),
  goldLight: rgb(0.98, 0.96, 0.91),
  coral: rgb(0.72, 0.36, 0.35),
  coralLight: rgb(1, 0.94, 0.93),
  white: rgb(1, 1, 1),
}

function value(input, fallback = 'Not recorded') {
  return input === null || input === undefined || String(input).trim() === '' ? fallback : String(input)
}

function number(input, suffix = '', decimals = 2) {
  const parsed = Number(input)
  return Number.isFinite(parsed) ? `${parsed.toFixed(decimals)}${suffix}` : 'Not recorded'
}

function compactNumber(input, suffix = '', decimals = 1) {
  const parsed = Number(input)
  return Number.isFinite(parsed) ? `${parsed.toFixed(decimals)}${suffix}` : 'Not recorded'
}

function safeFilePart(input) {
  return String(input || 'student').replace(/[^A-Za-z0-9_-]+/g, '_')
}

function dateLabel(input) {
  if (input === null || input === undefined || String(input).trim() === '') return 'Not Provided'
  const date = new Date(input)
  return Number.isNaN(date.getTime()) ? value(input, 'Not Provided') : new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(date)
}

function academicYearValue(report) {
  const input = report?.academicYear || report?.student?.academicYear
  return input === null || input === undefined || String(input).trim() === '' ? null : String(input)
}

function academicYearLabel(report) {
  const year = academicYearValue(report)
  return year ? `Academic Year: ${year}` : 'Academic Year: Not Provided'
}

function collegeName(report) {
  const name = value(report?.college?.name, DEFAULT_COLLEGE_NAME)
  const location = value(report?.college?.location, DEFAULT_COLLEGE_LOCATION)
  return location && !name.toLowerCase().includes(location.toLowerCase()) ? `${name}, ${location}` : name
}

function collegeLocation(report) {
  return value(report?.college?.location, DEFAULT_COLLEGE_LOCATION)
}

function roundedRect(page, x, top, width, height, options = {}) {
  // pdf-lib's standard build exposes rectangles rather than a rounded-rectangle
  // primitive. The border, spacing and fill preserve the same clean card treatment
  // in the browser fallback PDF without requiring a new PDF dependency.
  page.drawRectangle({ x, y: PAGE.height - top - height, width, height, borderWidth: 0.7, ...options })
}

function rectangle(page, x, top, width, height, options = {}) {
  page.drawRectangle({ x, y: PAGE.height - top - height, width, height, ...options })
}

function line(page, x1, top1, x2, top2, options = {}) {
  page.drawLine({ start: { x: x1, y: PAGE.height - top1 }, end: { x: x2, y: PAGE.height - top2 }, ...options })
}

function wrapLines(text, font, size, width) {
  const words = value(text).split(/\s+/)
  const lines = []
  let current = ''
  words.forEach((word) => {
    const candidate = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(candidate, size) <= width || !current) current = candidate
    else { lines.push(current); current = word }
  })
  if (current) lines.push(current)
  return lines
}

function textTop(page, text, x, top, font, size, color = COLORS.ink, width = null, maxLines = 1) {
  const lines = width ? wrapLines(text, font, size, width).slice(0, maxLines) : [value(text)]
  lines.forEach((entry, index) => page.drawText(entry, { x, y: PAGE.height - top - size - index * (size + 2), font, size, color }))
  return lines.length * (size + 2)
}

function rightTextTop(page, text, x, top, font, size, color, width) {
  const rendered = value(text)
  const textWidth = font.widthOfTextAtSize(rendered, size)
  page.drawText(rendered, { x: x + width - textWidth, y: PAGE.height - top - size, font, size, color })
}

function drawSectionTitle(page, title, subtitle, top, bold, regular) {
  textTop(page, title.toUpperCase(), PAGE.margin, top, bold, 11, COLORS.navy)
  line(page, PAGE.margin, top + 19, PAGE.margin + 34, top + 19, { thickness: 2, color: COLORS.teal })
  if (subtitle) textTop(page, subtitle, PAGE.margin + 46, top + 1, regular, 8.5, COLORS.muted, CONTENT_WIDTH - 46, 1)
  return top + 32
}

function drawLabelValue(page, label, fieldValue, x, top, width, bold, regular, fontSize = 10) {
  textTop(page, label.toUpperCase(), x, top, bold, 7.5, COLORS.muted, width, 1)
  textTop(page, fieldValue, x, top + 13, regular, fontSize, COLORS.ink, width, 1)
}

function badgeColors(type, fieldValue) {
  const normalized = String(fieldValue || '').toLowerCase()
  if (type === 'result' && normalized === 'pass') return { fill: COLORS.tealLight, text: COLORS.tealDark, border: rgb(0.61, 0.83, 0.79) }
  if (type === 'result' && normalized === 'fail') return { fill: COLORS.coralLight, text: COLORS.coral, border: rgb(0.9, 0.71, 0.69) }
  if (normalized.includes('low')) return { fill: COLORS.tealLight, text: COLORS.tealDark, border: rgb(0.61, 0.83, 0.79) }
  if (normalized.includes('medium')) return { fill: COLORS.goldLight, text: COLORS.gold, border: rgb(0.9, 0.82, 0.61) }
  if (normalized.includes('high')) return { fill: COLORS.coralLight, text: COLORS.coral, border: rgb(0.9, 0.71, 0.69) }
  return { fill: COLORS.blueLight, text: COLORS.muted, border: COLORS.border }
}

function drawBadge(page, label, fieldValue, x, top, width, bold, type = 'status') {
  const colors = badgeColors(type, fieldValue)
  roundedRect(page, x, top, width, 25, { color: colors.fill, borderColor: colors.border })
  textTop(page, label.toUpperCase(), x + 8, top + 5, bold, 7, colors.text, width - 16, 1)
  textTop(page, fieldValue, x + 8, top + 13, bold, 10, colors.text, width - 16, 1)
}

function drawFooter(page, report, regular, pageNumber) {
  line(page, PAGE.margin, PAGE.height - 42, PAGE.width - PAGE.margin, PAGE.height - 42, { thickness: 0.5, color: COLORS.border })
  textTop(page, collegeName(report), PAGE.margin, PAGE.height - 33, regular, 6.8, COLORS.muted, 275, 1)
  rightTextTop(page, `Generated ${dateLabel(report.generatedAt)}`, PAGE.width - PAGE.margin - 188, PAGE.height - 33, regular, 6.2, COLORS.muted, 145)
  rightTextTop(page, `Page ${pageNumber}`, PAGE.width - PAGE.margin - 35, PAGE.height - 33, regular, 6.2, COLORS.muted, 35)
}

function drawLogo(page, report, x, top, size, bold) {
  // Browser-side fallback reports do not have a bundled logo asset. Keep the
  // same labelled placeholder as the server PDF instead of displaying a
  // misleading missing-metadata message.
  roundedRect(page, x, top, size, size, { color: COLORS.teal, borderColor: rgb(0.46, 0.78, 0.74) })
  textTop(page, 'College', x + 6, top + 22, bold, 8, COLORS.white, size - 12, 1)
  textTop(page, 'Logo', x + 6, top + 34, bold, 8, COLORS.white, size - 12, 1)
}

function drawHeader(page, report, bold, regular, continuation = false) {
  if (continuation) {
    roundedRect(page, PAGE.margin, 27, CONTENT_WIDTH, 38, { color: COLORS.blueLight, borderColor: COLORS.border })
    textTop(page, 'CAMPS — STUDENT ACADEMIC REPORT CARD', PAGE.margin + 12, 37, bold, 8, COLORS.navy, 345, 1)
    rightTextTop(page, `${value(report.student?.name)} · ${value(report.student?.usn)}`, PAGE.width - PAGE.margin - 174, 39, regular, 8, COLORS.tealDark, 162)
    textTop(page, collegeName(report), PAGE.margin + 12, 52, regular, 6.5, COLORS.muted, 350, 1)
    return 86
  }
  rectangle(page, 0, 0, PAGE.width, 132, { color: COLORS.navyDark })
  drawLogo(page, report, PAGE.margin, 24, 72, bold)
  textTop(page, collegeName(report), PAGE.margin + 90, 27, bold, 17, COLORS.white, 300, 2)
  textTop(page, collegeLocation(report), PAGE.margin + 90, 78, regular, 9, rgb(0.78, 0.86, 0.86), 300, 1)
  textTop(page, 'CAMPS — Centralized Academic Monitoring System', PAGE.margin + 90, 98, bold, 9, rgb(0.55, 0.84, 0.78), 340, 1)
  rightTextTop(page, 'OFFICIAL ACADEMIC RECORD', PAGE.width - PAGE.margin - 145, 34, bold, 7.5, rgb(0.75, 0.83, 0.85), 145)
  rightTextTop(page, academicYearLabel(report), PAGE.width - PAGE.margin - 145, 53, regular, 8, rgb(0.75, 0.83, 0.85), 145)
  textTop(page, 'STUDENT ACADEMIC REPORT CARD', PAGE.margin, 153, bold, 17, COLORS.navy, CONTENT_WIDTH, 1)
  textTop(page, 'Official academic summary · Prepared for academic documentation and printing.', PAGE.margin, 177, regular, 9, COLORS.muted, CONTENT_WIDTH, 1)
  return 205
}

function drawMetric(page, x, top, width, label, fieldValue, bold, accent) {
  roundedRect(page, x, top, width, 57, { color: COLORS.white, borderColor: COLORS.border })
  roundedRect(page, x, top, 5, 57, { color: accent, borderColor: accent })
  textTop(page, label.toUpperCase(), x + 14, top + 11, bold, 7, COLORS.muted, width - 20, 1)
  textTop(page, fieldValue, x + 14, top + 27, bold, 15, COLORS.navy, width - 20, 1)
}

function drawSubjectTable(page, subjects, top, bold, regular, options = {}) {
  const rows = subjects || []
  const supportsOutcome = rows.some((subject) => (subject?.totalMarks !== null && subject?.totalMarks !== undefined && subject?.totalMarks !== '') || subject?.result)
  const columns = supportsOutcome
    ? [['CODE', 50], ['SUBJECT', 133], ['CREDITS', 50], ['ATTENDANCE', 76], ['INTERNAL', 70], ['ASSIGNMENT', 72], ['TOTAL / RESULT', 64]]
    : [['CODE', 58], ['SUBJECT', 157], ['CREDITS', 57], ['ATTENDANCE', 84], ['INTERNAL', 78], ['ASSIGNMENT MARKS', 81]]
  const rowHeight = options.rowHeight || 28
  const compact = rowHeight <= 20
  rectangle(page, PAGE.margin, top, CONTENT_WIDTH, 26, { color: COLORS.teal })
  let x = PAGE.margin
  columns.forEach(([label, width]) => { textTop(page, label, x + 6, top + 9, bold, 7, COLORS.white, width - 12, 1); x += width })
  let cursor = top + 26
  if (!rows.length) {
    rectangle(page, PAGE.margin, cursor, CONTENT_WIDTH, 35, { color: COLORS.soft, borderColor: COLORS.border, borderWidth: 0.7 })
    textTop(page, 'Subject-wise marks have not been recorded yet.', PAGE.margin + 10, cursor + 12, regular, 8.5, COLORS.muted, CONTENT_WIDTH - 20, 1)
    return cursor + 35
  }
  rows.forEach((subject, index) => {
    rectangle(page, PAGE.margin, cursor, CONTENT_WIDTH, rowHeight, { color: index % 2 ? COLORS.soft : COLORS.white, borderColor: COLORS.border, borderWidth: 0.5 })
    let cellX = PAGE.margin
    const values = [
      value(subject.subjectCode),
      value(subject.subjectName),
      compactNumber(subject.credits),
      compactNumber(subject.attendancePercentage, '%'),
      compactNumber(subject.averageInternalMarks, '%'),
      compactNumber(subject.assignmentScore ?? subject.averageAssignmentScore, '%'),
      value(subject.totalMarks ?? subject.total ?? subject.result),
    ]
    columns.forEach(([, width], valueIndex) => {
      const font = valueIndex === 1 ? regular : bold
      const size = compact ? 7.1 : (valueIndex === 1 ? 8.2 : 8)
      const textWidth = font.widthOfTextAtSize(values[valueIndex], size)
      const textX = valueIndex === 1 ? cellX + 6 : cellX + Math.max(6, (width - textWidth) / 2)
      textTop(page, values[valueIndex], textX, cursor + (compact ? (valueIndex === 1 ? 4 : 5) : (valueIndex === 1 ? 8 : 11)), font, size, COLORS.ink, width - 12, compact || valueIndex !== 1 ? 1 : 2)
      cellX += width
    })
    cursor += rowHeight
  })
  if (options.additionalCount) {
    textTop(page, `+ ${options.additionalCount} additional subject record(s) available in CAMPS.`, PAGE.margin, cursor + 1, regular, 7.5, COLORS.muted, CONTENT_WIDTH, 1)
    cursor += 12
  }
  return cursor
}

function recordBody(item, kind) {
  if (kind === 'achievement') return `${value(item.title)}${item.description ? ` — ${item.description}` : ''}`
  return value(item.note)
}

function drawRecords(page, title, records, top, bold, regular, kind, empty, options = {}) {
  const compact = options.compact === true
  const cardHeight = compact ? 37 : 45
  const cardGap = compact ? 3 : 5
  const emptyHeight = compact ? 30 : 35
  let cursor = drawSectionTitle(page, title, '', top, bold, regular)
  const items = records || []
  if (!items.length) {
    roundedRect(page, PAGE.margin, cursor, CONTENT_WIDTH, emptyHeight, { color: COLORS.soft, borderColor: COLORS.border })
    textTop(page, empty || 'No records have been recorded for this student.', PAGE.margin + 12, cursor + (compact ? 10 : 13), regular, compact ? 7.8 : 8.5, COLORS.muted, CONTENT_WIDTH - 24, 1)
    return cursor + (compact ? 39 : 47)
  }
  const visible = items.slice(0, options.limit || (compact ? 1 : 2))
  visible.forEach((item) => {
    const heading = kind === 'achievement' ? `${value(item.achievementType, 'Achievement')} · ${dateLabel(item.date)}` : `${value(item.label, 'Teacher remark')} · ${dateLabel(item.date)}`
    const body = recordBody(item, kind)
    roundedRect(page, PAGE.margin, cursor, CONTENT_WIDTH, cardHeight, { color: COLORS.white, borderColor: COLORS.border })
    page.drawCircle({ x: PAGE.margin + 14, y: PAGE.height - cursor - (compact ? 14 : 17), size: compact ? 3 : 3.5, color: kind === 'achievement' ? COLORS.teal : COLORS.gold })
    textTop(page, heading, PAGE.margin + 26, cursor + (compact ? 7 : 10), bold, compact ? 7.5 : 8, COLORS.navy, CONTENT_WIDTH - 38, 1)
    textTop(page, body, PAGE.margin + 26, cursor + (compact ? 21 : 25), regular, compact ? 7.5 : 8.5, COLORS.ink, CONTENT_WIDTH - 38, 1)
    cursor += cardHeight + cardGap
  })
  if (items.length > visible.length) {
    textTop(page, `+ ${items.length - visible.length} additional record(s) available in CAMPS.`, PAGE.margin, cursor + 1, regular, 7.5, COLORS.muted, CONTENT_WIDTH, 1)
    cursor += compact ? 9 : 12
  }
  return cursor
}

function drawPrediction(page, report, top, bold, regular) {
  const prediction = report.prediction || {}
  const hasStoredPrediction = prediction.isStored === true
  rectangle(page, PAGE.margin, top, CONTENT_WIDTH, 91, { color: COLORS.navyDark })
  textTop(page, 'RESULT AND ACADEMIC PREDICTION', PAGE.margin + 16, top + 13, bold, 8, rgb(0.66, 0.86, 0.81), 470, 1)
  textTop(page, 'Official record and model support signal are shown separately.', PAGE.margin + 16, top + 28, regular, 7.5, rgb(0.78, 0.86, 0.86), 470, 1)
  textTop(page, 'RECORDED RESULT', PAGE.margin + 16, top + 40, bold, 7, rgb(0.66, 0.86, 0.81), 112, 1)
  drawBadge(page, 'Official', report.student?.result, PAGE.margin + 16, top + 49, 112, bold, 'result')
  textTop(page, 'MODEL PREDICTION', PAGE.margin + 145, top + 40, bold, 7, rgb(0.66, 0.86, 0.81), 125, 1)
  drawBadge(page, 'Support signal', hasStoredPrediction ? prediction.result : null, PAGE.margin + 145, top + 49, 125, bold, 'result')
  textTop(page, 'RISK LEVEL', PAGE.margin + 300, top + 40, bold, 7, rgb(0.66, 0.86, 0.81), 125, 1)
  drawBadge(page, 'Stored risk', hasStoredPrediction ? prediction.risk : null, PAGE.margin + 300, top + 49, 125, bold, 'risk')
  textTop(page, hasStoredPrediction ? `Model version: ${value(prediction.modelVersion, 'Not recorded')}` : 'No stored model prediction', PAGE.margin + 300, top + 78, regular, 7, rgb(0.78, 0.86, 0.86), 200, 1)
  return top + 91
}

function drawAuthentication(page, report, top, bold, regular, options = {}) {
  const signature = report?.teacherSignature || report?.teacher?.signature || report?.signature?.teacher
  const signatureDate = report?.signatureDate || report?.signature?.date
  const height = options.compact ? 94 : 100
  roundedRect(page, PAGE.margin, top, CONTENT_WIDTH, height, { color: COLORS.blueLight, borderColor: COLORS.border })
  textTop(page, 'AUTHENTICATION AND SIGN-OFF', PAGE.margin + 15, top + 14, bold, 9, COLORS.navy, 300, 1)
  textTop(page, 'This report is generated from the CAMPS academic record. Missing fields are marked “Not recorded” and have not been inferred.', PAGE.margin + 15, top + 33, regular, 8, COLORS.muted, 280, 3)
  textTop(page, `Teacher: ${value(report.teacherName, 'Not Provided')}`, PAGE.margin + 15, top + 77, bold, 7.5, COLORS.navy, 280, 1)
  textTop(page, 'Teacher signature', PAGE.margin + 340, top + 31, bold, 8, COLORS.navy, 145, 1)
  line(page, PAGE.margin + 340, top + 61, PAGE.margin + 485, top + 61, { thickness: 0.8, color: COLORS.navy })
  textTop(page, `Signature: ${value(signature, 'Not Provided')}`, PAGE.margin + 340, top + 68, regular, 7.5, COLORS.muted, 145, 1)
  textTop(page, `Signature date: ${signatureDate ? dateLabel(signatureDate) : 'Not Provided'}`, PAGE.margin + 340, top + 84, regular, 7.5, COLORS.muted, 145, 1)
}

export async function createClientReportCardPdf(reportInput = {}) {
  const report = {
    ...reportInput,
    academicYear: reportInput.academicYear || reportInput.student?.academicYear || null,
    generatedAt: reportInput.generatedAt || new Date().toISOString(),
    college: { ...(reportInput.college || {}) },
    prediction: reportInput.prediction || { result: null, risk: null, modelVersion: null, isStored: false },
  }
  const pdf = await PDFDocument.create()
  pdf.setTitle(`Student Academic Report Card · ${value(report.student?.usn)}`)
  pdf.setAuthor('CAMPS')
  pdf.setSubject(collegeName(report))
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  let pageNumber = 1
  let page = pdf.addPage([PAGE.width, PAGE.height])
  let top = drawHeader(page, report, bold, regular)
  const newPage = () => {
    drawFooter(page, report, regular, pageNumber)
    page = pdf.addPage([PAGE.width, PAGE.height])
    pageNumber += 1
    top = drawHeader(page, report, bold, regular, true)
  }
  const ensure = (height) => { if (top + height > FOOTER_TOP) newPage() }
  const student = report.student || {}

  top = drawSectionTitle(page, 'Student information', 'Identity and scope attached to this report', top, bold, regular)
  rectangle(page, PAGE.margin, top, CONTENT_WIDTH, 113, { color: COLORS.white, borderColor: COLORS.border })
  drawLabelValue(page, 'Student name', student.name, PAGE.margin + 15, top + 15, 235, bold, regular)
  drawLabelValue(page, 'USN', student.usn, PAGE.margin + 270, top + 15, 110, bold, regular)
  drawLabelValue(page, 'Report generated', dateLabel(report.generatedAt), PAGE.margin + 398, top + 15, 102, bold, regular, 9)
  drawLabelValue(page, 'Email address', student.email, PAGE.margin + 15, top + 49, 235, bold, regular, 9)
  drawLabelValue(page, 'Department', student.department, PAGE.margin + 270, top + 49, 105, bold, regular)
  drawLabelValue(page, 'Semester', student.semester ? `Semester ${student.semester}` : null, PAGE.margin + 398, top + 49, 102, bold, regular)
  drawLabelValue(page, 'Section', student.section, PAGE.margin + 15, top + 83, 105, bold, regular)
  drawLabelValue(page, 'Academic year', academicYearValue(report) || 'Not Provided', PAGE.margin + 145, top + 83, 150, bold, regular)
  drawLabelValue(page, 'Record status', student.result || 'Not recorded', PAGE.margin + 330, top + 83, 170, bold, regular)
  top += 133

  top = drawSectionTitle(page, 'Academic snapshot', 'Values stored in the selected student academic record', top, bold, regular)
  const gap = 9
  const metricWidth = (CONTENT_WIDTH - gap * 2) / 3
  const metricRows = [
    [['Attendance percentage', number(student.attendancePercentage, '%')], ['Average internal marks', number(student.averageInternalMarks, '%')], ['Average assignment score', number(student.averageAssignmentScore, '%')]],
    [['Previous GPA', number(student.previousGpa, ' / 10')], ['Current GPA', number(student.currentGpa, ' / 10')], ['Participation score', number(student.participationScore, '%')]],
  ]
  metricRows.forEach((row) => {
    row.forEach((metric, index) => drawMetric(page, PAGE.margin + index * (metricWidth + gap), top, metricWidth, metric[0], metric[1], bold, index === 1 ? COLORS.navySoft : COLORS.teal))
    top += 66
  })
  top += 4

  const subjects = Array.isArray(report.subjects) ? report.subjects : []
  const compactSubjectLayout = subjects.length > 8
  if (compactSubjectLayout) {
    // Keep dense schedules within the two-page print limit while retaining
    // actual rows. Overflow is called out explicitly instead of fabricated.
    top = drawSectionTitle(page, 'Subject-wise marks', 'Actual subject records for this student and semester', top, bold, regular)
    top = drawSubjectTable(page, subjects.slice(0, 4), top, bold, regular, { rowHeight: 17 }) + 6
    newPage()
    top = drawSectionTitle(page, 'Subject-wise marks continued', 'Remaining actual subject records', top, bold, regular)
    const continuationRows = subjects.slice(4, 20)
    top = drawSubjectTable(page, continuationRows, top, bold, regular, {
      rowHeight: 17,
      additionalCount: Math.max(0, subjects.length - 4 - continuationRows.length),
    }) + 6
    top = drawPrediction(page, report, top, bold, regular) + 10
    top = drawRecords(page, 'Teacher remarks', report.remarks, top, bold, regular, 'remark', 'No records available.', { compact: true, limit: 1 })
    top = drawRecords(page, 'Achievements', report.achievements, top, bold, regular, 'achievement', 'No records available.', { compact: true, limit: 1 })
    drawAuthentication(page, report, top, bold, regular, { compact: true })
  } else {
    const subjectHeight = subjects.length ? 26 + subjects.length * 28 : 61
    ensure(34 + subjectHeight + 108)
    top = drawSectionTitle(page, 'Subject-wise marks', 'Actual subject records for this student and semester', top, bold, regular)
    top = drawSubjectTable(page, subjects, top, bold, regular, { rowHeight: 28 }) + 19

    ensure(108)
    top = drawPrediction(page, report, top, bold, regular) + 20

    ensure(80)
    top = drawRecords(page, 'Teacher remarks', report.remarks, top, bold, regular, 'remark', 'No records available.', { compact: true, limit: 1 })
    ensure(80)
    top = drawRecords(page, 'Achievements', report.achievements, top, bold, regular, 'achievement', 'No records available.', { compact: true, limit: 1 })
    ensure(118)
    drawAuthentication(page, report, top, bold, regular)
  }
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
