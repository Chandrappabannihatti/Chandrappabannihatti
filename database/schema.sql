-- CAMPS MySQL 8.0 schema
CREATE DATABASE IF NOT EXISTS camps CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE camps;

CREATE TABLE IF NOT EXISTS departments (
  code VARCHAR(10) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sections (
  section_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  department_code VARCHAR(10) NOT NULL,
  semester TINYINT UNSIGNED NOT NULL,
  section_name VARCHAR(20) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_section_scope (department_code, semester, section_name),
  KEY idx_section_scope (department_code, semester),
  CONSTRAINT fk_section_department FOREIGN KEY (department_code) REFERENCES departments(code) ON DELETE CASCADE,
  CONSTRAINT chk_section_semester CHECK (semester BETWEEN 1 AND 8)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS subjects (
  subject_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  department_code VARCHAR(10) NOT NULL,
  semester TINYINT UNSIGNED NOT NULL,
  subject_code VARCHAR(30) NOT NULL,
  subject_name VARCHAR(160) NOT NULL,
  credits DECIMAL(3,1) NOT NULL DEFAULT 3.0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_subject_scope (department_code, semester, subject_code),
  KEY idx_subject_scope (department_code, semester, is_active),
  CONSTRAINT fk_subject_department FOREIGN KEY (department_code) REFERENCES departments(code) ON DELETE CASCADE,
  CONSTRAINT chk_subject_semester CHECK (semester BETWEEN 1 AND 8),
  CONSTRAINT chk_subject_credits CHECK (credits > 0 AND credits <= 30)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  role ENUM('admin', 'teacher', 'student', 'parent') NOT NULL,
  display_name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role (role, is_active)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS admins (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NULL,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_admins_email (email),
  CONSTRAINT fk_admin_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS teachers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NULL,
  employee_code VARCHAR(30) NOT NULL,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  department_code VARCHAR(10) NOT NULL,
  designation VARCHAR(100) NULL,
  phone VARCHAR(24) NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_teacher_employee (employee_code),
  UNIQUE KEY uq_teacher_email (email),
  KEY idx_teacher_department (department_code, is_active),
  CONSTRAINT fk_teacher_department FOREIGN KEY (department_code) REFERENCES departments(code),
  CONSTRAINT fk_teacher_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS students (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  usn VARCHAR(30) NOT NULL,
  name VARCHAR(120) NOT NULL,
  department_code VARCHAR(10) NOT NULL,
  semester TINYINT UNSIGNED NOT NULL,
  section VARCHAR(20) NOT NULL DEFAULT 'A',
  section_id BIGINT UNSIGNED NULL,
  gender ENUM('Male', 'Female', 'Other') NULL,
  date_of_birth DATE NULL,
  blood_group VARCHAR(8) NULL,
  address VARCHAR(255) NULL,
  email VARCHAR(160) NOT NULL,
  phone VARCHAR(24) NULL,
  parent_name VARCHAR(120) NULL,
  father_name VARCHAR(120) NULL,
  mother_name VARCHAR(120) NULL,
  parent_phone VARCHAR(24) NULL,
  parent_email VARCHAR(160) NULL,
  certifications JSON NULL,
  skills JSON NULL,
  password_hash VARCHAR(255) NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  joined_on DATE NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_student_usn (usn),
  KEY idx_student_scope (department_code, semester, section, is_active),
  KEY idx_student_section (section_id, semester, is_active),
  KEY idx_student_name (name),
  CONSTRAINT fk_student_department FOREIGN KEY (department_code) REFERENCES departments(code),
  CONSTRAINT fk_student_section FOREIGN KEY (section_id) REFERENCES sections(section_id) ON DELETE SET NULL,
  CONSTRAINT chk_student_semester CHECK (semester BETWEEN 1 AND 8)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS parents (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NULL,
  phone VARCHAR(24) NULL,
  password_hash VARCHAR(255) NOT NULL,
  relationship VARCHAR(30) NOT NULL DEFAULT 'Parent',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_parent_student_email (student_id, email),
  KEY idx_parent_student (student_id, is_active),
  CONSTRAINT fk_parent_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS attendance (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id BIGINT UNSIGNED NOT NULL,
  subject_code VARCHAR(30) NULL,
  attendance_date DATE NOT NULL,
  status ENUM('Present', 'Absent', 'On Duty', 'Leave') NOT NULL,
  attendance_percentage DECIMAL(5,2) NULL,
  marked_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_attendance_mark (student_id, subject_code, attendance_date),
  KEY idx_attendance_student_date (student_id, attendance_date),
  CONSTRAINT fk_attendance_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  CONSTRAINT fk_attendance_teacher FOREIGN KEY (marked_by) REFERENCES teachers(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS internal_marks (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id BIGINT UNSIGNED NOT NULL,
  subject_code VARCHAR(30) NOT NULL,
  semester TINYINT UNSIGNED NOT NULL,
  ia1 DECIMAL(5,2) NULL,
  ia2 DECIMAL(5,2) NULL,
  practical DECIMAL(5,2) NULL,
  cgpa DECIMAL(4,2) NULL,
  recorded_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_internal_student_subject_semester (student_id, subject_code, semester),
  KEY idx_internal_student (student_id, semester),
  CONSTRAINT fk_internal_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  CONSTRAINT fk_internal_teacher FOREIGN KEY (recorded_by) REFERENCES teachers(id) ON DELETE SET NULL,
  CONSTRAINT chk_internal_semester CHECK (semester BETWEEN 1 AND 8)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS assignments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id BIGINT UNSIGNED NOT NULL,
  subject_code VARCHAR(30) NOT NULL,
  title VARCHAR(160) NOT NULL,
  marks DECIMAL(5,2) NULL,
  max_marks DECIMAL(5,2) NOT NULL DEFAULT 20,
  due_date DATE NULL,
  submitted_at DATETIME NULL,
  status ENUM('Pending', 'Submitted', 'Late', 'Graded') NOT NULL DEFAULT 'Pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_assignment_student (student_id, status),
  CONSTRAINT fk_assignment_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS achievements (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id BIGINT UNSIGNED NOT NULL,
  teacher_id BIGINT UNSIGNED NULL,
  section_id BIGINT UNSIGNED NULL,
  department_code VARCHAR(10) NOT NULL,
  semester TINYINT UNSIGNED NOT NULL,
  achievement_type VARCHAR(60) NOT NULL,
  achievement_date DATE NOT NULL,
  title VARCHAR(180) NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_achievement_student_entry (student_id, achievement_date, title),
  KEY idx_achievement_scope (department_code, semester, section_id, achievement_date),
  KEY idx_achievement_student (student_id, achievement_date),
  CONSTRAINT fk_achievement_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  CONSTRAINT fk_achievement_teacher FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE SET NULL,
  CONSTRAINT fk_achievement_section FOREIGN KEY (section_id) REFERENCES sections(section_id) ON DELETE SET NULL,
  CONSTRAINT fk_achievement_department FOREIGN KEY (department_code) REFERENCES departments(code) ON DELETE RESTRICT,
  CONSTRAINT chk_achievement_semester CHECK (semester BETWEEN 1 AND 8)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS remarks (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id BIGINT UNSIGNED NOT NULL,
  teacher_id BIGINT UNSIGNED NOT NULL,
  label VARCHAR(80) NOT NULL,
  note TEXT NOT NULL,
  is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_remarks_student_created (student_id, created_at),
  CONSTRAINT fk_remark_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  CONSTRAINT fk_remark_teacher FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS messages (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sender_id BIGINT UNSIGNED NOT NULL,
  recipient_user_id BIGINT UNSIGNED NULL,
  recipient_scope VARCHAR(80) NULL,
  student_id BIGINT UNSIGNED NULL,
  department_code VARCHAR(10) NULL,
  semester TINYINT UNSIGNED NULL,
  section_id BIGINT UNSIGNED NULL,
  audience ENUM('Student', 'Parent', 'Students', 'Parents', 'Class group') NOT NULL DEFAULT 'Student',
  subject VARCHAR(180) NOT NULL,
  body TEXT NOT NULL,
  read_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_message_recipient (recipient_user_id, read_at, created_at),
  KEY idx_message_scope (recipient_scope, department_code, semester, created_at),
  KEY idx_message_section (section_id, created_at),
  CONSTRAINT fk_message_sender FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_message_recipient FOREIGN KEY (recipient_user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_message_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL,
  CONSTRAINT fk_message_department FOREIGN KEY (department_code) REFERENCES departments(code) ON DELETE SET NULL,
  CONSTRAINT fk_message_section FOREIGN KEY (section_id) REFERENCES sections(section_id) ON DELETE SET NULL,
  CONSTRAINT chk_message_semester CHECK (semester IS NULL OR semester BETWEEN 1 AND 8)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS announcements (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(180) NOT NULL,
  body TEXT NOT NULL,
  visibility_type ENUM('College', 'Department', 'Semester') NOT NULL,
  department_code VARCHAR(10) NULL,
  semester TINYINT UNSIGNED NULL,
  section_id BIGINT UNSIGNED NULL,
  priority ENUM('Normal', 'Medium', 'High') NOT NULL DEFAULT 'Normal',
  author_id BIGINT UNSIGNED NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  published_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_announcement_visibility (visibility_type, department_code, semester, is_active, published_at),
  KEY idx_announcement_section (section_id, published_at),
  CONSTRAINT fk_announcement_department FOREIGN KEY (department_code) REFERENCES departments(code) ON DELETE SET NULL,
  CONSTRAINT fk_announcement_section FOREIGN KEY (section_id) REFERENCES sections(section_id) ON DELETE SET NULL,
  CONSTRAINT fk_announcement_author FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_announcement_semester CHECK (semester IS NULL OR semester BETWEEN 1 AND 8)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS predictions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id BIGINT UNSIGNED NOT NULL,
  attendance DECIMAL(5,2) NOT NULL DEFAULT 0,
  ia1 DECIMAL(5,2) NOT NULL DEFAULT 0,
  ia2 DECIMAL(5,2) NOT NULL DEFAULT 0,
  assignment_marks DECIMAL(5,2) NOT NULL DEFAULT 0,
  previous_sgpa DECIMAL(4,2) NOT NULL DEFAULT 0,
  cgpa DECIMAL(4,2) NOT NULL DEFAULT 0,
  backlogs TINYINT UNSIGNED NOT NULL DEFAULT 0,
  risk ENUM('Low', 'Medium', 'High') NOT NULL,
  pass_probability DECIMAL(5,2) NOT NULL,
  model_version VARCHAR(40) NOT NULL DEFAULT 'xgboost-0.9.4',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_prediction_student_latest (student_id, created_at),
  KEY idx_prediction_risk (risk, created_at),
  CONSTRAINT fk_prediction_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  notification_type VARCHAR(40) NOT NULL,
  title VARCHAR(180) NOT NULL,
  body TEXT NOT NULL,
  read_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_notification_user (user_id, read_at, created_at),
  CONSTRAINT fk_notification_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
