export const ACADEMIC_ATTRIBUTES = [
  { key: 'attendancePercentage', label: 'Attendance Percentage', suffix: '%', min: 0, max: 100, step: 0.1 },
  { key: 'averageInternalMarks', label: 'Average Internal Marks', suffix: '%', min: 0, max: 100, step: 0.1 },
  { key: 'averageAssignmentScore', label: 'Average Assignment Score', suffix: '%', min: 0, max: 100, step: 0.1 },
  { key: 'previousGpa', label: 'Previous GPA', suffix: '/ 10', min: 0, max: 10, step: 0.1 },
  { key: 'currentGpa', label: 'Current GPA', suffix: '/ 10', min: 0, max: 10, step: 0.1 },
  { key: 'participationScore', label: 'Participation Score', suffix: '%', min: 0, max: 100, step: 0.1 },
]

export const PREDICTION_INPUTS = ACADEMIC_ATTRIBUTES.filter(({ key }) => key !== 'currentGpa')

function firstValue(input, keys, fallback = 0) {
  for (const key of keys) {
    if (input[key] !== undefined && input[key] !== null && input[key] !== '') return input[key]
  }
  return fallback
}

function numeric(value, fallback = 0) {
  const result = Number(value)
  return Number.isFinite(result) ? result : fallback
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

export function academicFields(input = {}) {
  return {
    attendancePercentage: clamp(numeric(firstValue(input, ['attendancePercentage', 'attendance'])), 0, 100),
    averageInternalMarks: clamp(numeric(firstValue(input, ['averageInternalMarks', 'average_internal_marks'])), 0, 100),
    averageAssignmentScore: clamp(numeric(firstValue(input, ['averageAssignmentScore', 'average_assignment_score'])), 0, 100),
    previousGpa: clamp(numeric(firstValue(input, ['previousGpa', 'previous_gpa'])), 0, 10),
    currentGpa: clamp(numeric(firstValue(input, ['currentGpa', 'current_gpa'])), 0, 10),
    participationScore: clamp(numeric(firstValue(input, ['participationScore', 'participation_score'])), 0, 100),
  }
}

export function predictionFields(input = {}) {
  const fields = academicFields(input)
  return Object.fromEntries(PREDICTION_INPUTS.map(({ key }) => [key, fields[key]]))
}

export function predictAcademic(input = {}) {
  const fields = predictionFields(input)
  const score = fields.attendancePercentage * 0.3
    + fields.averageInternalMarks * 0.25
    + fields.averageAssignmentScore * 0.15
    + (fields.previousGpa / 10) * 15
    + fields.participationScore * 0.15
  const result = score >= 60 ? 'Pass' : 'Fail'
  const risk = score >= 75 ? 'Low Risk' : score >= 55 ? 'Medium Risk' : 'High Risk'
  return { result, risk }
}

export function predictionFromStudent(student = {}) {
  return predictAcademic(student)
}

export function formatAcademicValue(key, value) {
  const numericValue = numeric(value)
  return key === 'previousGpa' || key === 'currentGpa' ? numericValue.toFixed(1) : `${numericValue.toFixed(1)}%`
}
