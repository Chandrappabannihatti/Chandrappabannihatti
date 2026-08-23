import { demoAnnouncements, demoMessages, demoRemarks, demoStudents } from '../src/data/demo.js'

export const demoStore = {
  students: demoStudents.map((student) => ({ ...student })),
  messages: demoMessages.map((message) => ({ ...message })),
  announcements: demoAnnouncements.map((announcement) => ({ ...announcement })),
  remarks: demoRemarks.map((remark) => ({ ...remark })),
}

export function nextId(items) {
  return items.reduce((highest, item) => Math.max(highest, Number(item.id) || 0), 0) + 1
}
