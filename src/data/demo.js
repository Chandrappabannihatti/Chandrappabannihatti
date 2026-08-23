export const departments = [
  { code: 'CSE', name: 'Computer Science & Engineering', short: 'CSE', icon: '⌘', tone: 'coral', count: 486, accent: '#F07E5E' },
  { code: 'AIML', name: 'Artificial Intelligence & ML', short: 'AIML', icon: '✦', tone: 'mint', count: 214, accent: '#75BFA5' },
  { code: 'CSDS', name: 'Computer Science & Data Science', short: 'CSDS', icon: '◌', tone: 'sky', count: 198, accent: '#76ABC4' },
  { code: 'CE', name: 'Computer Engineering', short: 'CE', icon: '⌁', tone: 'teal', count: 205, accent: '#70BDB5' },
  { code: 'ECE', name: 'Electronics & Communication Engineering', short: 'ECE', icon: '⌁', tone: 'lavender', count: 392, accent: '#9E9CE0' },
  { code: 'EEE', name: 'Electrical & Electronics Engineering', short: 'EEE', icon: 'ϟ', tone: 'yellow', count: 306, accent: '#E4B85F' },
  { code: 'ME', name: 'Mechanical Engineering', short: 'ME', icon: '⚙', tone: 'slate', count: 288, accent: '#8A9AAA' },
  { code: 'CIVIL', name: 'Civil Engineering', short: 'CIVIL', icon: '⌂', tone: 'peach', count: 267, accent: '#D78D7A' },
]

export const semesters = [1, 2, 3, 4, 5, 6, 7, 8]

export const demoSubjects = [
  { id: 1, subjectId: 1, department: 'CSE', semester: 7, subjectCode: 'CS701', subjectName: 'Machine Learning', credits: 4, isActive: true },
  { id: 2, subjectId: 2, department: 'CSE', semester: 7, subjectCode: 'CS702', subjectName: 'Cloud Computing', credits: 4, isActive: true },
  { id: 3, subjectId: 3, department: 'CSE', semester: 7, subjectCode: 'CS703', subjectName: 'Distributed Systems', credits: 3, isActive: true },
  { id: 4, subjectId: 4, department: 'CSE', semester: 7, subjectCode: 'CS704', subjectName: 'Software Engineering', credits: 3, isActive: true },
  { id: 5, subjectId: 5, department: 'CSE', semester: 7, subjectCode: 'CS705', subjectName: 'Major Project', credits: 6, isActive: true },
]

export function getDemoSubjects() {
  if (typeof window === 'undefined') return demoSubjects.map((subject) => ({ ...subject }))
  try {
    const stored = JSON.parse(window.localStorage.getItem('camps_subjects') || 'null')
    if (Array.isArray(stored)) return stored
  } catch { /* use bundled demo subjects */ }
  return demoSubjects.map((subject) => ({ ...subject }))
}

export const demoSections = semesters.flatMap((semester) => ['A', 'B', 'C'].map((sectionName, index) => ({
  sectionId: `CSE-${semester}-${sectionName}`,
  department: 'CSE',
  semester,
  sectionName,
  studentCount: 0,
  createdAt: '2026-06-01',
  sortOrder: index,
})))

export const demoStudents = [

  { id: 1, usn: '4PM21CS001', name: 'Aarav Bhat', department: 'CSE', semester: 7, section: 'A', gender: 'Male', email: 'aarav.bhat@pestrust.edu.in', phone: '+91 98452 10341', parentName: 'Vikram Bhat', parentPhone: '+91 98450 77120', attendance: 92, cgpa: 8.9, ia1: 43, ia2: 45, assignmentMarks: 18, previousSgpa: 8.6, backlogs: 0, risk: 'Low', passProbability: 97, initials: 'AB' },
  { id: 2, usn: '4PM21CS014', name: 'Diya Rao', department: 'CSE', semester: 7, section: 'A', gender: 'Female', email: 'diya.rao@pestrust.edu.in', phone: '+91 98806 14229', parentName: 'Shilpa Rao', parentPhone: '+91 98451 92134', attendance: 88, cgpa: 8.4, ia1: 39, ia2: 42, assignmentMarks: 17, previousSgpa: 8.1, backlogs: 0, risk: 'Low', passProbability: 94, initials: 'DR' },
  { id: 3, usn: '4PM21CS027', name: 'Nikhil Shetty', department: 'CSE', semester: 7, section: 'A', gender: 'Male', email: 'nikhil.shetty@pestrust.edu.in', phone: '+91 97315 40985', parentName: 'Mahesh Shetty', parentPhone: '+91 98452 44019', attendance: 76, cgpa: 7.1, ia1: 31, ia2: 34, assignmentMarks: 14, previousSgpa: 7.3, backlogs: 1, risk: 'Medium', passProbability: 78, initials: 'NS' },
  { id: 4, usn: '4PM21CS033', name: 'Ishita Kulkarni', department: 'CSE', semester: 7, section: 'B', gender: 'Female', dateOfBirth: '2004-02-18', bloodGroup: 'O+', address: 'Vinobha Nagar, Shivamogga, Karnataka', email: 'ishita.k@pestrust.edu.in', phone: '+91 99801 60322', parentName: 'Suresh Kulkarni', fatherName: 'Suresh Kulkarni', motherName: 'Madhavi Kulkarni', parentPhone: '+91 98440 17732', parentEmail: 'suresh.kulkarni@example.com', certifications: ['Python for Everybody', 'AWS Cloud Foundations'], skills: ['Python', 'React', 'SQL'], attendance: 68, cgpa: 6.5, ia1: 27, ia2: 29, assignmentMarks: 12, previousSgpa: 6.8, backlogs: 2, risk: 'High', passProbability: 52, initials: 'IK' },
  { id: 5, usn: '4PM21CS041', name: 'Rohan Desai', department: 'CSE', semester: 7, section: 'B', gender: 'Male', email: 'rohan.desai@pestrust.edu.in', phone: '+91 98441 27418', parentName: 'Anita Desai', parentPhone: '+91 98453 11884', attendance: 83, cgpa: 7.8, ia1: 36, ia2: 38, assignmentMarks: 16, previousSgpa: 7.9, backlogs: 0, risk: 'Low', passProbability: 91, initials: 'RD' },
  { id: 6, usn: '4PM21CS056', name: 'Sanjana Hegde', department: 'CSE', semester: 7, section: 'B', gender: 'Female', email: 'sanjana.hegde@pestrust.edu.in', phone: '+91 99021 77301', parentName: 'Prakash Hegde', parentPhone: '+91 98451 70447', attendance: 73, cgpa: 7.0, ia1: 30, ia2: 36, assignmentMarks: 15, previousSgpa: 7.0, backlogs: 1, risk: 'Medium', passProbability: 74, initials: 'SH' },
  { id: 7, usn: '4PM21CS064', name: 'Aditya Prabhu', department: 'CSE', semester: 7, section: 'C', gender: 'Male', email: 'aditya.prabhu@pestrust.edu.in', phone: '+91 97410 25449', parentName: 'Ramesh Prabhu', parentPhone: '+91 98454 32014', attendance: 96, cgpa: 9.3, ia1: 47, ia2: 46, assignmentMarks: 19, previousSgpa: 9.1, backlogs: 0, risk: 'Low', passProbability: 99, initials: 'AP' },
  { id: 8, usn: '4PM21CS078', name: 'Meghana Nayak', department: 'CSE', semester: 7, section: 'C', gender: 'Female', email: 'meghana.nayak@pestrust.edu.in', phone: '+91 98457 80021', parentName: 'Lakshmi Nayak', parentPhone: '+91 98454 91107', attendance: 61, cgpa: 6.1, ia1: 24, ia2: 28, assignmentMarks: 11, previousSgpa: 6.4, backlogs: 3, risk: 'High', passProbability: 41, initials: 'MN' },
  { id: 9, usn: '4PM21CS083', name: 'Yashwanth K', department: 'CSE', semester: 7, section: 'C', gender: 'Male', email: 'yashwanth.k@pestrust.edu.in', phone: '+91 99167 28401', parentName: 'Kavitha K', parentPhone: '+91 98458 80192', attendance: 81, cgpa: 7.6, ia1: 35, ia2: 37, assignmentMarks: 16, previousSgpa: 7.5, backlogs: 0, risk: 'Low', passProbability: 89, initials: 'YK' },
  { id: 10, usn: '4PM21CS095', name: 'Tanvi Mohan', department: 'CSE', semester: 7, section: 'A', gender: 'Female', email: 'tanvi.mohan@pestrust.edu.in', phone: '+91 98452 62319', parentName: 'Mohan Kumar', parentPhone: '+91 98451 30019', attendance: 78, cgpa: 7.4, ia1: 33, ia2: 35, assignmentMarks: 15, previousSgpa: 7.2, backlogs: 0, risk: 'Medium', passProbability: 84, initials: 'TM' },
  { id: 11, usn: '4PM22CS011', name: 'Naveen Gowda', department: 'CSE', semester: 5, section: 'A', gender: 'Male', email: 'naveen.gowda@pestrust.edu.in', phone: '+91 98459 21103', parentName: 'Uma Gowda', parentPhone: '+91 98451 22203', attendance: 87, cgpa: 8.0, ia1: 38, ia2: 40, assignmentMarks: 17, previousSgpa: 7.8, backlogs: 0, risk: 'Low', passProbability: 93, initials: 'NG' },
  { id: 12, usn: '4PM22CS024', name: 'Aditi Pai', department: 'CSE', semester: 5, section: 'A', gender: 'Female', email: 'aditi.pai@pestrust.edu.in', phone: '+91 99004 10029', parentName: 'Ravi Pai', parentPhone: '+91 98450 19202', attendance: 72, cgpa: 6.9, ia1: 29, ia2: 33, assignmentMarks: 14, previousSgpa: 6.7, backlogs: 1, risk: 'Medium', passProbability: 71, initials: 'AP' },
  { id: 15, usn: '4PM25CS004', name: 'Riya Bhat', department: 'CSE', semester: 1, section: 'A', gender: 'Female', email: 'riya.bhat@pestrust.edu.in', phone: '+91 98450 10401', parentName: 'Naveen Bhat', parentPhone: '+91 98450 70401', attendance: 89, cgpa: 8.2, ia1: 41, ia2: 39, assignmentMarks: 17, previousSgpa: 8.2, backlogs: 0, risk: 'Low', passProbability: 95, initials: 'RB' },
  { id: 16, usn: '4PM24CS019', name: 'Vivek Rao', department: 'CSE', semester: 2, section: 'A', gender: 'Male', email: 'vivek.rao@pestrust.edu.in', phone: '+91 98450 10419', parentName: 'Uma Rao', parentPhone: '+91 98450 70419', attendance: 84, cgpa: 7.9, ia1: 37, ia2: 40, assignmentMarks: 16, previousSgpa: 7.7, backlogs: 0, risk: 'Low', passProbability: 91, initials: 'VR' },
  { id: 17, usn: '4PM24CS032', name: 'Nandini Hegde', department: 'CSE', semester: 3, section: 'B', gender: 'Female', email: 'nandini.hegde@pestrust.edu.in', phone: '+91 98450 10432', parentName: 'Raghav Hegde', parentPhone: '+91 98450 70432', attendance: 77, cgpa: 7.3, ia1: 32, ia2: 35, assignmentMarks: 15, previousSgpa: 7.1, backlogs: 1, risk: 'Medium', passProbability: 82, initials: 'NH' },
  { id: 18, usn: '4PM23CS047', name: 'Karthik M', department: 'CSE', semester: 4, section: 'A', gender: 'Male', email: 'karthik.m@pestrust.edu.in', phone: '+91 98450 10447', parentName: 'Meera M', parentPhone: '+91 98450 70447', attendance: 91, cgpa: 8.6, ia1: 43, ia2: 42, assignmentMarks: 18, previousSgpa: 8.3, backlogs: 0, risk: 'Low', passProbability: 96, initials: 'KM' },
  { id: 19, usn: '4PM22CS061', name: 'Pooja Shetty', department: 'CSE', semester: 6, section: 'B', gender: 'Female', email: 'pooja.shetty@pestrust.edu.in', phone: '+91 98450 10461', parentName: 'Suresh Shetty', parentPhone: '+91 98450 70461', attendance: 74, cgpa: 7.0, ia1: 30, ia2: 33, assignmentMarks: 14, previousSgpa: 7.2, backlogs: 1, risk: 'Medium', passProbability: 75, initials: 'PS' },
  { id: 20, usn: '4PM20CS089', name: 'Abhishek Pai', department: 'CSE', semester: 8, section: 'A', gender: 'Male', email: 'abhishek.pai@pestrust.edu.in', phone: '+91 98450 10489', parentName: 'Anita Pai', parentPhone: '+91 98450 70489', attendance: 86, cgpa: 8.1, ia1: 39, ia2: 41, assignmentMarks: 17, previousSgpa: 8.0, backlogs: 0, risk: 'Low', passProbability: 93, initials: 'AP' },
  { id: 13, usn: '4PM23AI018', name: 'Arjun Rao', department: 'AIML', semester: 7, section: 'A', gender: 'Male', email: 'arjun.rao@pestrust.edu.in', phone: '+91 98450 43119', parentName: 'Madhav Rao', parentPhone: '+91 98451 84119', attendance: 90, cgpa: 8.7, ia1: 42, ia2: 44, assignmentMarks: 18, previousSgpa: 8.5, backlogs: 0, risk: 'Low', passProbability: 96, initials: 'AR' },
  { id: 14, usn: '4PM21EC006', name: 'Kiran Kumar', department: 'ECE', semester: 7, section: 'B', gender: 'Male', email: 'kiran.kumar@pestrust.edu.in', phone: '+91 98453 40029', parentName: 'Shobha Kumar', parentPhone: '+91 98450 20219', attendance: 70, cgpa: 6.7, ia1: 28, ia2: 31, assignmentMarks: 13, previousSgpa: 6.9, backlogs: 2, risk: 'High', passProbability: 58, initials: 'KK' },
]

export const demoMessages = [
  { id: 1, department: 'CSE', semester: 7, section: 'B', sender: 'Dr. Ananya Rao', recipient: 'Ishita Kulkarni', audience: 'Student', subject: 'Let us make a plan for your attendance', body: 'I noticed your attendance has dipped this month. Please meet me after class so we can make a simple recovery plan.', time: 'Today, 09:42 AM', read: false, initials: 'AR' },
  { id: 2, department: 'CSE', semester: 7, section: 'B', sender: 'Dr. Ananya Rao', recipient: 'Suresh Kulkarni', audience: 'Parent', subject: 'A quick academic update for Ishita', body: 'Ishita would benefit from a little extra support with attendance and the upcoming internal assessment.', time: 'Yesterday, 04:18 PM', read: true, initials: 'SK' },
  { id: 3, department: 'CSE', semester: 7, sender: 'Placement Cell', recipient: 'CSE · Semester 7', audience: 'Students', subject: 'Product engineering orientation', body: 'An industry mentor joins us on Friday at 2 PM in Seminar Hall 2. Bring your updated resume.', time: '18 Aug 2026', read: true, initials: 'PC' },
  { id: 4, department: 'CSE', semester: 7, sender: 'Dr. Ananya Rao', recipient: 'All CSE students', audience: 'Students', subject: 'Project review checkpoints', body: 'Please keep your problem statement and sprint board ready for the review next Tuesday.', time: '15 Aug 2026', read: true, initials: 'AR' },
  { id: 5, department: 'CSE', semester: 1, sender: 'Academic Office', recipient: 'CSE · Semester 1', audience: 'Students', subject: 'Welcome to your first semester', body: 'Your mentor introduction and foundation course orientation are scheduled for this week.', time: '19 Aug 2026', read: true, initials: 'AO' },
  { id: 6, department: 'CSE', semester: 2, sender: 'Dr. Ananya Rao', recipient: 'CSE · Semester 2', audience: 'Students', subject: 'Programming lab checklist', body: 'Bring your lab record and complete the arrays practice set before the next session.', time: '18 Aug 2026', read: true, initials: 'AR' },
  { id: 7, department: 'CSE', semester: 3, sender: 'CSE Department', recipient: 'CSE · Semester 3', audience: 'Students', subject: 'Database design clinic', body: 'A guided database design clinic is available after class on Thursday.', time: '17 Aug 2026', read: true, initials: 'CD' },
  { id: 8, department: 'CSE', semester: 4, sender: 'CSE Department', recipient: 'CSE · Semester 4', audience: 'Students', subject: 'Mini project milestone', body: 'Teams should update their problem statement and sprint board before the next review.', time: '16 Aug 2026', read: true, initials: 'CD' },
  { id: 9, department: 'CSE', semester: 5, sender: 'Dr. Ananya Rao', recipient: 'CSE · Semester 5', audience: 'Students', subject: 'Industry readiness workshop', body: 'Bring your current resume for the peer review workshop this Friday.', time: '15 Aug 2026', read: true, initials: 'AR' },
  { id: 10, department: 'CSE', semester: 6, sender: 'CSE Department', recipient: 'CSE · Semester 6', audience: 'Students', subject: 'Placement profile review', body: 'Please complete your placement profile and upload the latest project links.', time: '14 Aug 2026', read: true, initials: 'CD' },
  { id: 11, department: 'CSE', semester: 8, sender: 'Placement Cell', recipient: 'CSE · Semester 8', audience: 'Students', subject: 'Final placement sprint', body: 'Mock interviews and technical preparation slots are open for final semester students.', time: '13 Aug 2026', read: true, initials: 'PC' },
]

export const demoAnnouncements = [
  { id: 1, title: 'Project review checkpoints', section: 'B', body: 'Project review 2 is scheduled for Tuesday, 25 August. Teams should carry their sprint board and current build.', type: 'Department', department: 'CSE', semester: 7, author: 'Dr. Ananya Rao', date: '24 Aug 2026', priority: 'High' },
  { id: 2, title: 'Internal examination schedule published', section: 'B', body: 'The Semester 7 internal assessment timetable is now available. Check the academic calendar for room details.', type: 'Semester', department: 'CSE', semester: 7, author: 'Academic Office', date: '22 Aug 2026', priority: 'Medium' },
  { id: 4, title: 'Foundation course orientation', body: 'Meet your mentor and bring your questions about the first semester learning plan.', type: 'Semester', department: 'CSE', semester: 1, author: 'Academic Office', date: '20 Aug 2026', priority: 'Normal' },
  { id: 5, title: 'Programming lab checklist', body: 'Review the arrays and functions checklist before the upcoming programming lab.', type: 'Semester', department: 'CSE', semester: 2, author: 'CSE Department', date: '20 Aug 2026', priority: 'Normal' },
  { id: 6, title: 'Database design clinic', body: 'Join the guided database design clinic after class on Thursday.', type: 'Semester', department: 'CSE', semester: 3, author: 'CSE Department', date: '19 Aug 2026', priority: 'Normal' },
  { id: 7, title: 'Mini project milestone', body: 'Keep your problem statement and sprint board ready for the next milestone review.', type: 'Semester', department: 'CSE', semester: 4, author: 'CSE Department', date: '19 Aug 2026', priority: 'Medium' },
  { id: 8, title: 'Industry readiness workshop', body: 'Bring your resume for the semester five peer review workshop this Friday.', type: 'Semester', department: 'CSE', semester: 5, author: 'CSE Department', date: '18 Aug 2026', priority: 'Normal' },
  { id: 9, title: 'Placement profile review', body: 'Complete your placement profile and upload your latest project links.', type: 'Semester', department: 'CSE', semester: 6, author: 'Placement Cell', date: '18 Aug 2026', priority: 'High' },
  { id: 10, title: 'Final placement sprint', body: 'Mock interview and technical preparation slots are open for final semester students.', type: 'Semester', department: 'CSE', semester: 8, author: 'Placement Cell', date: '17 Aug 2026', priority: 'High' },
  { id: 3, title: 'Product engineering orientation', body: 'Join the Placement Cell for an industry session on building a strong product engineering portfolio.', type: 'College', department: null, semester: null, author: 'Placement Cell', date: '18 Aug 2026', priority: 'Normal' },
]

export const demoRemarks = [
  { id: 1, studentId: 4, studentName: 'Ishita Kulkarni', label: 'Needs Improvement', note: 'Attend the next two weeks consistently and submit the pending DBMS assignment.', date: '20 Aug 2026', author: 'Dr. Ananya Rao' },
  { id: 2, studentId: 8, studentName: 'Meghana Nayak', label: 'Low Attendance', note: 'Parent conversation completed. Follow-up scheduled for Friday.', date: '19 Aug 2026', author: 'Dr. Ananya Rao' },
  { id: 3, studentId: 1, studentName: 'Aarav Bhat', label: 'Excellent Performance', note: 'Consistently strong work in distributed systems and peer mentoring.', date: '16 Aug 2026', author: 'Dr. Ananya Rao' },
]

export const achievementTypes = ['Academic', 'Hackathon', 'Certification', 'Sports', 'Cultural', 'Leadership', 'Community service']

export const demoAchievements = [
  { id: 1, studentId: 4, studentName: 'Ishita Kulkarni', usn: '4PM21CS033', department: 'CSE', semester: 7, section: 'B', achievementType: 'Hackathon', date: '2026-08-12', title: 'Smart India Hackathon finalist', description: 'Selected as a finalist for the campus accessibility solution built during the national hackathon.', author: 'Dr. Ananya Rao' },
  { id: 2, studentId: 5, studentName: 'Rohan Desai', usn: '4PM21CS041', department: 'CSE', semester: 7, section: 'B', achievementType: 'Certification', date: '2026-07-28', title: 'Cloud foundations certification', description: 'Completed the Cloud Foundations certification with a distinction.', author: 'Dr. Ananya Rao' },
  { id: 3, studentId: 1, studentName: 'Aarav Bhat', usn: '4PM21CS001', department: 'CSE', semester: 7, section: 'A', achievementType: 'Leadership', date: '2026-08-05', title: 'Peer mentor for distributed systems', description: 'Led weekly peer-learning sessions for the distributed systems study group.', author: 'Dr. Ananya Rao' },
  { id: 4, studentId: 7, studentName: 'Aditya Prabhu', usn: '4PM21CS064', department: 'CSE', semester: 7, section: 'C', achievementType: 'Sports', date: '2026-07-19', title: 'Inter-college badminton runner-up', description: 'Represented the institute at the inter-college badminton tournament.', author: 'Dr. Ananya Rao' },
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
