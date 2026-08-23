-- Demo data is inserted by `npm run db:seed` so password hashes are generated safely at runtime.
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
