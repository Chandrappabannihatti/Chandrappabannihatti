-- Demo data is inserted by `npm run db:seed` so password hashes are generated safely at runtime.
-- The runtime seed also inserts representative scoped achievement records from src/data/demo.js.
-- Demo credentials when USE_DEMO_DATA=true:
-- admin@camps.edu / Admin@123
-- teacher@camps.edu / Teacher@123
-- 4PM21CS033 / Student@123
-- 4PM21CS033 / Parent@123

USE camps;
INSERT INTO departments (code, name) VALUES
('CSE', 'Computer Science & Engineering'),
('AIML', 'Artificial Intelligence & ML'),
('CSDS', 'Computer Science & Data Science'),
('ECE', 'Electronics & Communication'),
('EEE', 'Electrical & Electronics'),
('ME', 'Mechanical Engineering'),
('CIVIL', 'Civil Engineering')
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO sections (department_code, semester, section_name)
SELECT d.code, semesters.semester, section_names.section_name
FROM departments d
CROSS JOIN (SELECT 1 AS semester UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8) semesters
CROSS JOIN (SELECT 'A' AS section_name UNION ALL SELECT 'B' UNION ALL SELECT 'C') section_names
WHERE d.code = 'CSE'
ON DUPLICATE KEY UPDATE section_name = VALUES(section_name);
