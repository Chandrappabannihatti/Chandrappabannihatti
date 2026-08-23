import fs from 'node:fs/promises'
import path from 'node:path'
import mysql from 'mysql2/promise'
import dotenv from 'dotenv'

dotenv.config()

const connection = await mysql.createConnection({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  multipleStatements: true,
})
const schema = await fs.readFile(path.resolve('database/schema.sql'), 'utf8')
await connection.query(schema)

// CREATE TABLE IF NOT EXISTS does not change an already-initialised students table.
// Add the expanded profile columns when upgrading an existing CAMPS database.
const [existingColumns] = await connection.query("SELECT COLUMN_NAME AS name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'students'")
const studentProfileColumns = {
  date_of_birth: 'DATE NULL',
  blood_group: 'VARCHAR(8) NULL',
  address: 'VARCHAR(255) NULL',
  father_name: 'VARCHAR(120) NULL',
  mother_name: 'VARCHAR(120) NULL',
  parent_email: 'VARCHAR(160) NULL',
  certifications: 'JSON NULL',
  skills: 'JSON NULL',
}
for (const [name, definition] of Object.entries(studentProfileColumns)) {
  if (!existingColumns.some((column) => column.name === name)) await connection.query(`ALTER TABLE students ADD COLUMN ${name} ${definition}`)
}

// Subject codes are shared by the subject catalog and record tables. Keep legacy tables wide enough for newly created subjects.
await connection.query('ALTER TABLE attendance MODIFY COLUMN subject_code VARCHAR(30) NULL')
await connection.query('ALTER TABLE internal_marks MODIFY COLUMN subject_code VARCHAR(30) NOT NULL')
await connection.query('ALTER TABLE assignments MODIFY COLUMN subject_code VARCHAR(30) NOT NULL')

await connection.end()
console.log('CAMPS schema created or upgraded.')
