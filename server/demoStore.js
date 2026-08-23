import { demoAchievements, demoAnnouncements, demoMessages, demoRemarks, demoSections, demoStudents, demoSubjects } from '../src/data/demo.js'

export const demoStore = {
  sections: demoSections.map((section) => ({ ...section })),
  subjects: demoSubjects.map((subject) => ({ ...subject })),
  subjectRecords: [],
  students: demoStudents.map((student) => ({ ...student })),
  messages: demoMessages.map((message) => ({ ...message })),
  announcements: demoAnnouncements.map((announcement) => ({ ...announcement })),
  remarks: demoRemarks.map((remark) => ({ ...remark })),
  achievements: demoAchievements.map((achievement) => ({ ...achievement })),
}

export function nextId(items) {
  return items.reduce((highest, item) => Math.max(highest, Number(item.id) || 0), 0) + 1
}
