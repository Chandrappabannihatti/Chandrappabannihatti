import bcrypt from 'bcryptjs'
import { DEFAULT_STUDENT_PASSWORD } from './utils.js'

export function isBcryptHash(value) {
  return /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(String(value || ''))
}

export function emptyMigrationReport() {
  return {
    totalStudents: 0,
    checked: 0,
    created: [],
    skipped: [],
    errors: [],
    counts: { checked: 0, created: 0, skipped: 0, errors: 0 },
  }
}

function addResult(report, bucket, student, message = '') {
  report[bucket].push({ id: Number(student.id), usn: String(student.usn || '').trim().toUpperCase(), ...(message ? { message } : {}) })
  report.counts[bucket] += 1
}

/**
 * Create or repair one student account per profile without changing an
 * existing valid password. The caller supplies the database query and
 * transaction functions so the operation is easy to run and test, and so
 * every individual profile can fail without aborting the rest of the report.
 */
export async function migrateStudentAccounts({ runQuery, runTransaction, hash = bcrypt.hash }) {
  const report = emptyMigrationReport()
  const students = await runQuery('SELECT id, usn, name, email, password_hash AS passwordHash FROM students ORDER BY id')
  report.totalStudents = students.length

  for (const student of students) {
    report.checked += 1
    report.counts.checked += 1
    try {
      const result = await runTransaction(async (connection) => {
        const [userRows] = await connection.query(
          'SELECT id, student_id AS studentId, email, password_hash AS passwordHash, is_active AS isActive FROM users WHERE role=? AND (student_id=? OR (student_id IS NULL AND email=?)) ORDER BY id LIMIT 1 FOR UPDATE',
          ['student', student.id, student.email],
        )
        const account = userRows[0]
        if (account && account.studentId && Number(account.studentId) !== Number(student.id)) {
          const error = new Error('An existing student account is linked to another profile.')
          error.code = 'STUDENT_ACCOUNT_CONFLICT'
          throw error
        }

        const accountIsActive = account && account.isActive !== false && Number(account.isActive) !== 0
        const validAccount = account && accountIsActive && isBcryptHash(account.passwordHash)
        if (validAccount) {
          if (!account.studentId) {
            await connection.query('UPDATE users SET student_id=? WHERE id=? AND role=?', [student.id, account.id, 'student'])
          }
          if (!isBcryptHash(student.passwordHash)) {
            await connection.query('UPDATE students SET password_hash=? WHERE id=?', [account.passwordHash, student.id])
          }
          return { bucket: 'skipped', message: 'valid account already exists' }
        }

        // An inactive account with a valid hash is still a usable credential;
        // reactivate it without replacing the password. This keeps migration
        // safe for students whose account was intentionally paused earlier.
        if (account && isBcryptHash(account.passwordHash)) {
          await connection.query(
            'UPDATE users SET display_name=?, student_id=?, is_active=TRUE WHERE id=? AND role=?',
            [student.name, student.id, account.id, 'student'],
          )
          if (!isBcryptHash(student.passwordHash)) await connection.query('UPDATE students SET password_hash=? WHERE id=?', [account.passwordHash, student.id])
          return { bucket: 'skipped', message: 'valid account reactivated' }
        }

        const passwordHash = await hash(DEFAULT_STUDENT_PASSWORD, 10)
        if (account) {
          await connection.query(
            'UPDATE users SET display_name=?, password_hash=?, student_id=?, must_change_password=TRUE, is_active=TRUE WHERE id=? AND role=?',
            [student.name, passwordHash, student.id, account.id, 'student'],
          )
          await connection.query('UPDATE students SET password_hash=? WHERE id=?', [passwordHash, student.id])
          return { bucket: 'created', message: 'repaired account with missing or invalid bcrypt hash' }
        }

        await connection.query(
          'INSERT INTO users (role, display_name, email, password_hash, student_id, must_change_password) VALUES (?, ?, NULL, ?, ?, TRUE)',
          ['student', student.name, passwordHash, student.id],
        )
        if (!isBcryptHash(student.passwordHash)) await connection.query('UPDATE students SET password_hash=? WHERE id=?', [passwordHash, student.id])
        return { bucket: 'created', message: 'created account with the configured initial credential' }
      })
      addResult(report, result.bucket, student, result.message)
    } catch (error) {
      addResult(report, 'errors', student, error.message || 'Account migration failed.')
    }
  }

  return report
}
