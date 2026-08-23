-- ============================================================================
-- CAMPS — Centralized Academic Monitoring & Prediction System
-- MySQL schema (normalized, FK-constrained)
--
-- Usage:
--   mysql -u root -p < database/schema.sql
--   mysql -u root -p < database/dummy_data.sql
--
-- Then point the Flask backend at it:
--   export DATABASE_URL="mysql+pymysql://root:password@localhost:3306/academic_monitoring"
-- ============================================================================

CREATE DATABASE IF NOT EXISTS academic_monitoring
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE academic_monitoring;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS ml_predictions;
DROP TABLE IF EXISTS backlogs;
DROP TABLE IF EXISTS semester_results;
DROP TABLE IF EXISTS assignments;
DROP TABLE IF EXISTS ia_marks;
DROP TABLE IF EXISTS attendance;
DROP TABLE IF EXISTS parent_student;
DROP TABLE IF EXISTS parents;
DROP TABLE IF EXISTS students;
DROP TABLE IF EXISTS teacher_subjects;
DROP TABLE IF EXISTS teachers;
DROP TABLE IF EXISTS subjects;
DROP TABLE IF EXISTS departments;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS roles;
SET FOREIGN_KEY_CHECKS = 1;

-- -------------------------------------------------------------- lookup
CREATE TABLE roles (
  id     INT AUTO_INCREMENT PRIMARY KEY,
  name   VARCHAR(32) NOT NULL UNIQUE           -- admin | teacher | student | parent
) ENGINE=InnoDB;

-- -------------------------------------------------------------- identity
CREATE TABLE users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role_id       INT NOT NULL,
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id),
  INDEX idx_users_email (email)
) ENGINE=InnoDB;

-- -------------------------------------------------------------- structure
CREATE TABLE departments (
  id   INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  code VARCHAR(16)  NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE subjects (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  code          VARCHAR(16)  NOT NULL UNIQUE,
  name          VARCHAR(160) NOT NULL,
  semester      INT NOT NULL,
  credits       INT NOT NULL DEFAULT 4,
  department_id INT NOT NULL,
  CONSTRAINT fk_subject_dept FOREIGN KEY (department_id) REFERENCES departments(id)
) ENGINE=InnoDB;

CREATE TABLE teachers (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  user_id       INT NOT NULL UNIQUE,
  employee_id   VARCHAR(32) NOT NULL UNIQUE,
  department_id INT NOT NULL,
  designation   VARCHAR(80) DEFAULT 'Assistant Professor',
  phone         VARCHAR(20),
  CONSTRAINT fk_teacher_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_teacher_dept FOREIGN KEY (department_id) REFERENCES departments(id)
) ENGINE=InnoDB;

CREATE TABLE teacher_subjects (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  teacher_id INT NOT NULL,
  subject_id INT NOT NULL,
  semester   INT NOT NULL,
  section    VARCHAR(4) DEFAULT 'A',
  CONSTRAINT fk_ts_teacher FOREIGN KEY (teacher_id) REFERENCES teachers(id),
  CONSTRAINT fk_ts_subject FOREIGN KEY (subject_id) REFERENCES subjects(id)
) ENGINE=InnoDB;

CREATE TABLE students (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  user_id        INT NOT NULL UNIQUE,
  usn            VARCHAR(16) NOT NULL UNIQUE,
  department_id  INT NOT NULL,
  semester       INT NOT NULL,
  section        VARCHAR(4) DEFAULT 'A',
  gender         VARCHAR(12),
  phone          VARCHAR(20),
  admission_year INT,
  CONSTRAINT fk_student_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_student_dept FOREIGN KEY (department_id) REFERENCES departments(id),
  INDEX idx_students_usn (usn)
) ENGINE=InnoDB;

CREATE TABLE parents (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL UNIQUE,
  phone      VARCHAR(20),
  occupation VARCHAR(80),
  CONSTRAINT fk_parent_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE parent_student (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  parent_id  INT NOT NULL,
  student_id INT NOT NULL,
  relation   VARCHAR(24) DEFAULT 'Guardian',
  CONSTRAINT fk_ps_parent  FOREIGN KEY (parent_id)  REFERENCES parents(id),
  CONSTRAINT fk_ps_student FOREIGN KEY (student_id) REFERENCES students(id),
  CONSTRAINT uq_parent_student UNIQUE (parent_id, student_id)
) ENGINE=InnoDB;

-- -------------------------------------------------------------- academic records
CREATE TABLE attendance (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  student_id       INT NOT NULL,
  subject_id       INT NOT NULL,
  semester         INT NOT NULL,
  classes_held     INT NOT NULL DEFAULT 0,
  classes_attended INT NOT NULL DEFAULT 0,
  updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_att_student FOREIGN KEY (student_id) REFERENCES students(id),
  CONSTRAINT fk_att_subject FOREIGN KEY (subject_id) REFERENCES subjects(id),
  CONSTRAINT uq_attendance UNIQUE (student_id, subject_id, semester)
) ENGINE=InnoDB;

CREATE TABLE ia_marks (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  subject_id INT NOT NULL,
  semester   INT NOT NULL,
  ia1        FLOAT DEFAULT 0,          -- out of 50
  ia2        FLOAT DEFAULT 0,          -- out of 50
  CONSTRAINT fk_ia_student FOREIGN KEY (student_id) REFERENCES students(id),
  CONSTRAINT fk_ia_subject FOREIGN KEY (subject_id) REFERENCES subjects(id),
  CONSTRAINT uq_ia UNIQUE (student_id, subject_id, semester)
) ENGINE=InnoDB;

CREATE TABLE assignments (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  subject_id INT NOT NULL,
  semester   INT NOT NULL,
  marks      FLOAT DEFAULT 0,          -- out of 10
  CONSTRAINT fk_asg_student FOREIGN KEY (student_id) REFERENCES students(id),
  CONSTRAINT fk_asg_subject FOREIGN KEY (subject_id) REFERENCES subjects(id),
  CONSTRAINT uq_asg UNIQUE (student_id, subject_id, semester)
) ENGINE=InnoDB;

CREATE TABLE semester_results (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  student_id   INT NOT NULL,
  semester     INT NOT NULL,
  sgpa         FLOAT NOT NULL,
  cgpa         FLOAT NOT NULL,
  published_on DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_res_student FOREIGN KEY (student_id) REFERENCES students(id),
  CONSTRAINT uq_result UNIQUE (student_id, semester)
) ENGINE=InnoDB;

CREATE TABLE backlogs (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  subject_id INT NOT NULL,
  semester   INT NOT NULL,
  status     VARCHAR(16) DEFAULT 'active',     -- active | cleared
  CONSTRAINT fk_bl_student FOREIGN KEY (student_id) REFERENCES students(id),
  CONSTRAINT fk_bl_subject FOREIGN KEY (subject_id) REFERENCES subjects(id)
) ENGINE=InnoDB;

-- -------------------------------------------------------------- ML + ops
CREATE TABLE ml_predictions (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  student_id       INT NOT NULL,
  semester         INT,
  risk_level       VARCHAR(16) NOT NULL,       -- Low | Medium | High
  pass_probability FLOAT NOT NULL,
  confidence       FLOAT,
  features_json    TEXT,
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_mlp_student FOREIGN KEY (student_id) REFERENCES students(id),
  INDEX idx_mlp_student (student_id),
  INDEX idx_mlp_created (created_at)
) ENGINE=InnoDB;

CREATE TABLE notifications (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  title      VARCHAR(160) NOT NULL,
  message    VARCHAR(500),
  kind       VARCHAR(24) DEFAULT 'info',       -- info | success | warning | danger
  is_read    TINYINT(1) DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_notif_user (user_id)
) ENGINE=InnoDB;
