import { demoAchievements, demoAnnouncements, demoMessages, demoRemarks, demoSections, demoStudents, demoSubjects, demoTeachers } from '../src/data/demo.js'

const demoParents = demoStudents.map((student) => ({
  id: Number(student.id) === 4 ? 2 : 10000 + Number(student.id),
  studentId: Number(student.id),
  studentName: student.name,
  studentUsn: student.usn,
  name: student.parentName || `${student.name} Parent`,
  email: student.parentEmail || `${String(student.usn).toLowerCase()}@parents.camps.edu`,
  phone: student.parentPhone || '',
  relationship: 'Parent',
  department: student.department,
  semester: Number(student.semester),
  isActive: true,
  passwordHash: '',
}))

export const demoStore = {
  sections: demoSections.map((section) => ({ ...section })),
  subjects: demoSubjects.map((subject) => ({ ...subject })),
  subjectRecords: [],
  students: demoStudents.map((student) => ({ ...student, isActive: student.isActive !== false })),
  teachers: demoTeachers.map((teacher) => ({ ...teacher, passwordHash: '' })),
  parents: demoParents,
  messages: demoMessages.map((message) => ({ ...message })),
  announcements: demoAnnouncements.map((announcement) => ({ ...announcement })),
  remarks: demoRemarks.map((remark) => ({ ...remark })),
  achievements: demoAchievements.map((achievement) => ({ ...achievement })),
}

export function nextId(items) {
  return items.reduce((highest, item) => Math.max(highest, Number(item.id) || 0), 0) + 1
}
