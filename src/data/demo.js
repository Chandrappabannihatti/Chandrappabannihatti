export const departments = [
  { code: 'CSE', name: 'Computer Science & Engineering', short: 'CSE', icon: '⌘', tone: 'coral', count: 486, accent: '#F07E5E' },
  { code: 'AIML', name: 'Artificial Intelligence & ML', short: 'AIML', icon: '✦', tone: 'mint', count: 214, accent: '#75BFA5' },
  { code: 'CSDS', name: 'Computer Science & Data Science', short: 'CSDS', icon: '◌', tone: 'sky', count: 198, accent: '#76ABC4' },
  { code: 'ECE', name: 'Electronics & Communication', short: 'ECE', icon: '⌁', tone: 'lavender', count: 392, accent: '#9E9CE0' },
  { code: 'EEE', name: 'Electrical & Electronics', short: 'EEE', icon: 'ϟ', tone: 'yellow', count: 306, accent: '#E4B85F' },
  { code: 'ME', name: 'Mechanical Engineering', short: 'ME', icon: '⚙', tone: 'slate', count: 288, accent: '#8A9AAA' },
  { code: 'CIVIL', name: 'Civil Engineering', short: 'CIVIL', icon: '⌂', tone: 'peach', count: 267, accent: '#D78D7A' },
]

export const semesters = [1, 2, 3, 4, 5, 6, 7, 8]

export const demoStudents = [
  { id: 1, usn: '4PM21CS001', name: 'Aarav Bhat', department: 'CSE', semester: 7, section: 'A', gender: 'Male', email: 'aarav.bhat@pestrust.edu.in', phone: '+91 98452 10341', parentName: 'Vikram Bhat', parentPhone: '+91 98450 77120', attendance: 92, cgpa: 8.9, ia1: 43, ia2: 45, assignmentMarks: 18, previousSgpa: 8.6, backlogs: 0, risk: 'Low', passProbability: 97, initials: 'AB' },
  { id: 2, usn: '4PM21CS014', name: 'Diya Rao', department: 'CSE', semester: 7, section: 'A', gender: 'Female', email: 'diya.rao@pestrust.edu.in', phone: '+91 98806 14229', parentName: 'Shilpa Rao', parentPhone: '+91 98451 92134', attendance: 88, cgpa: 8.4, ia1: 39, ia2: 42, assignmentMarks: 17, previousSgpa: 8.1, backlogs: 0, risk: 'Low', passProbability: 94, initials: 'DR' },
  { id: 3, usn: '4PM21CS027', name: 'Nikhil Shetty', department: 'CSE', semester: 7, section: 'A', gender: 'Male', email: 'nikhil.shetty@pestrust.edu.in', phone: '+91 97315 40985', parentName: 'Mahesh Shetty', parentPhone: '+91 98452 44019', attendance: 76, cgpa: 7.1, ia1: 31, ia2: 34, assignmentMarks: 14, previousSgpa: 7.3, backlogs: 1, risk: 'Medium', passProbability: 78, initials: 'NS' },
  { id: 4, usn: '4PM21CS033', name: 'Ishita Kulkarni', department: 'CSE', semester: 7, section: 'B', gender: 'Female', email: 'ishita.k@pestrust.edu.in', phone: '+91 99801 60322', parentName: 'Suresh Kulkarni', parentPhone: '+91 98440 17732', attendance: 68, cgpa: 6.5, ia1: 27, ia2: 29, assignmentMarks: 12, previousSgpa: 6.8, backlogs: 2, risk: 'High', passProbability: 52, initials: 'IK' },
  { id: 5, usn: '4PM21CS041', name: 'Rohan Desai', department: 'CSE', semester: 7, section: 'B', gender: 'Male', email: 'rohan.desai@pestrust.edu.in', phone: '+91 98441 27418', parentName: 'Anita Desai', parentPhone: '+91 98453 11884', attendance: 83, cgpa: 7.8, ia1: 36, ia2: 38, assignmentMarks: 16, previousSgpa: 7.9, backlogs: 0, risk: 'Low', passProbability: 91, initials: 'RD' },
  { id: 6, usn: '4PM21CS056', name: 'Sanjana Hegde', department: 'CSE', semester: 7, section: 'B', gender: 'Female', email: 'sanjana.hegde@pestrust.edu.in', phone: '+91 99021 77301', parentName: 'Prakash Hegde', parentPhone: '+91 98451 70447', attendance: 73, cgpa: 7.0, ia1: 30, ia2: 36, assignmentMarks: 15, previousSgpa: 7.0, backlogs: 1, risk: 'Medium', passProbability: 74, initials: 'SH' },
  { id: 7, usn: '4PM21CS064', name: 'Aditya Prabhu', department: 'CSE', semester: 7, section: 'C', gender: 'Male', email: 'aditya.prabhu@pestrust.edu.in', phone: '+91 97410 25449', parentName: 'Ramesh Prabhu', parentPhone: '+91 98454 32014', attendance: 96, cgpa: 9.3, ia1: 47, ia2: 46, assignmentMarks: 19, previousSgpa: 9.1, backlogs: 0, risk: 'Low', passProbability: 99, initials: 'AP' },
  { id: 8, usn: '4PM21CS078', name: 'Meghana Nayak', department: 'CSE', semester: 7, section: 'C', gender: 'Female', email: 'meghana.nayak@pestrust.edu.in', phone: '+91 98457 80021', parentName: 'Lakshmi Nayak', parentPhone: '+91 98454 91107', attendance: 61, cgpa: 6.1, ia1: 24, ia2: 28, assignmentMarks: 11, previousSgpa: 6.4, backlogs: 3, risk: 'High', passProbability: 41, initials: 'MN' },
  { id: 9, usn: '4PM21CS083', name: 'Yashwanth K', department: 'CSE', semester: 7, section: 'C', gender: 'Male', email: 'yashwanth.k@pestrust.edu.in', phone: '+91 99167 28401', parentName: 'Kavitha K', parentPhone: '+91 98458 80192', attendance: 81, cgpa: 7.6, ia1: 35, ia2: 37, assignmentMarks: 16, previousSgpa: 7.5, backlogs: 0, risk: 'Low', passProbability: 89, initials: 'YK' },
  { id: 10, usn: '4PM21CS095', name: 'Tanvi Mohan', department: 'CSE', semester: 7, section: 'A', gender: 'Female', email: 'tanvi.mohan@pestrust.edu.in', phone: '+91 98452 62319', parentName: 'Mohan Kumar', parentPhone: '+91 98451 30019', attendance: 78, cgpa: 7.4, ia1: 33, ia2: 35, assignmentMarks: 15, previousSgpa: 7.2, backlogs: 0, risk: 'Medium', passProbability: 84, initials: 'TM' },
  { id: 11, usn: '4PM22CS011', name: 'Naveen Gowda', department: 'CSE', semester: 5, section: 'A', gender: 'Male', email: 'naveen.gowda@pestrust.edu.in', phone: '+91 98459 21103', parentName: 'Uma Gowda', parentPhone: '+91 98451 22203', attendance: 87, cgpa: 8.0, ia1: 38, ia2: 40, assignmentMarks: 17, previousSgpa: 7.8, backlogs: 0, risk: 'Low', passProbability: 93, initials: 'NG' },
  { id: 12, usn: '4PM22CS024', name: 'Aditi Pai', department: 'CSE', semester: 5, section: 'A', gender: 'Female', email: 'aditi.pai@pestrust.edu.in', phone: '+91 99004 10029', parentName: 'Ravi Pai', parentPhone: '+91 98450 19202', attendance: 72, cgpa: 6.9, ia1: 29, ia2: 33, assignmentMarks: 14, previousSgpa: 6.7, backlogs: 1, risk: 'Medium', passProbability: 71, initials: 'AP' },
  { id: 13, usn: '4PM23AI018', name: 'Arjun Rao', department: 'AIML', semester: 7, section: 'A', gender: 'Male', email: 'arjun.rao@pestrust.edu.in', phone: '+91 98450 43119', parentName: 'Madhav Rao', parentPhone: '+91 98451 84119', attendance: 90, cgpa: 8.7, ia1: 42, ia2: 44, assignmentMarks: 18, previousSgpa: 8.5, backlogs: 0, risk: 'Low', passProbability: 96, initials: 'AR' },
  { id: 14, usn: '4PM21EC006', name: 'Kiran Kumar', department: 'ECE', semester: 7, section: 'B', gender: 'Male', email: 'kiran.kumar@pestrust.edu.in', phone: '+91 98453 40029', parentName: 'Shobha Kumar', parentPhone: '+91 98450 20219', attendance: 70, cgpa: 6.7, ia1: 28, ia2: 31, assignmentMarks: 13, previousSgpa: 6.9, backlogs: 2, risk: 'High', passProbability: 58, initials: 'KK' },
]

export const demoMessages = [
  { id: 1, sender: 'Dr. Ananya Rao', recipient: 'Ishita Kulkarni', audience: 'Student', subject: 'Let us make a plan for your attendance', body: 'I noticed your attendance has dipped this month. Please meet me after class so we can make a simple recovery plan.', time: 'Today, 09:42 AM', read: false, initials: 'AR' },
  { id: 2, sender: 'Dr. Ananya Rao', recipient: 'Suresh Kulkarni', audience: 'Parent', subject: 'A quick academic update for Ishita', body: 'Ishita would benefit from a little extra support with attendance and the upcoming internal assessment.', time: 'Yesterday, 04:18 PM', read: true, initials: 'SK' },
  { id: 3, sender: 'Placement Cell', recipient: 'CSE · Semester 7', audience: 'Students', subject: 'Product engineering orientation', body: 'An industry mentor joins us on Friday at 2 PM in Seminar Hall 2. Bring your updated resume.', time: '18 Aug 2026', read: true, initials: 'PC' },
  { id: 4, sender: 'Dr. Ananya Rao', recipient: 'All CSE students', audience: 'Students', subject: 'Project review checkpoints', body: 'Please keep your problem statement and sprint board ready for the review next Tuesday.', time: '15 Aug 2026', read: true, initials: 'AR' },
]

export const demoAnnouncements = [
  { id: 1, title: 'Project review checkpoints', body: 'Project review 2 is scheduled for Tuesday, 25 August. Teams should carry their sprint board and current build.', type: 'Department', department: 'CSE', semester: null, author: 'Dr. Ananya Rao', date: '24 Aug 2026', priority: 'High' },
  { id: 2, title: 'Internal examination schedule published', body: 'The Semester 7 internal assessment timetable is now available. Check the academic calendar for room details.', type: 'Semester', department: 'CSE', semester: 7, author: 'Academic Office', date: '22 Aug 2026', priority: 'Medium' },
  { id: 3, title: 'Product engineering orientation', body: 'Join the Placement Cell for an industry session on building a strong product engineering portfolio.', type: 'College', department: null, semester: null, author: 'Placement Cell', date: '18 Aug 2026', priority: 'Normal' },
]

export const demoRemarks = [
  { id: 1, studentId: 4, studentName: 'Ishita Kulkarni', label: 'Needs Improvement', note: 'Attend the next two weeks consistently and submit the pending DBMS assignment.', date: '20 Aug 2026', author: 'Dr. Ananya Rao' },
  { id: 2, studentId: 8, studentName: 'Meghana Nayak', label: 'Low Attendance', note: 'Parent conversation completed. Follow-up scheduled for Friday.', date: '19 Aug 2026', author: 'Dr. Ananya Rao' },
  { id: 3, studentId: 1, studentName: 'Aarav Bhat', label: 'Excellent Performance', note: 'Consistently strong work in distributed systems and peer mentoring.', date: '16 Aug 2026', author: 'Dr. Ananya Rao' },
]

export const attendanceTrend = [
  { month: 'Feb', attendance: 78, target: 75 },
  { month: 'Mar', attendance: 80, target: 75 },
  { month: 'Apr', attendance: 79, target: 75 },
  { month: 'May', attendance: 83, target: 75 },
  { month: 'Jun', attendance: 81, target: 75 },
  { month: 'Jul', attendance: 84, target: 75 },
  { month: 'Aug', attendance: 82, target: 75 },
]

export const subjectPerformance = [
  { subject: 'DS', score: 86, fill: '#F07E5E' },
  { subject: 'CC', score: 79, fill: '#83C7AE' },
  { subject: 'ML', score: 91, fill: '#8BBFD7' },
  { subject: 'SE', score: 74, fill: '#A3A1DB' },
  { subject: 'CN', score: 82, fill: '#E4B85F' },
]

export const currentUser = {
  name: 'Dr. Ananya Rao',
  role: 'teacher',
  department: 'CSE',
  designation: 'Assistant Professor',
  email: 'ananya.rao@pestrust.edu.in',
  initials: 'AR',
}

export const studentUser = {
  name: 'Ishita Kulkarni',
  role: 'student',
  department: 'CSE',
  semester: 7,
  usn: '4PM21CS033',
  email: 'ishita.k@pestrust.edu.in',
  initials: 'IK',
}

export const parentUser = {
  name: 'Suresh Kulkarni',
  role: 'parent',
  department: 'CSE',
  semester: 7,
  usn: '4PM21CS033',
  studentName: 'Ishita Kulkarni',
  initials: 'SK',
}

export const cloneDemoStudents = () => demoStudents.map((student) => ({ ...student }))
