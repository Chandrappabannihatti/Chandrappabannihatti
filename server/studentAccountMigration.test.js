import test from 'node:test'
import assert from 'node:assert/strict'
import bcrypt from 'bcryptjs'
import { DEFAULT_STUDENT_PASSWORD } from './utils.js'
import { isBcryptHash, migrateStudentAccounts } from './studentAccountMigration.js'

function createFakeDatabase(students, initialAccounts = []) {
  const accounts = initialAccounts.map((account) => ({ ...account }))
  const runQuery = async () => students.map((student) => ({ ...student }))
  const runTransaction = async (callback) => callback({
    query: async (sql, params) => {
      if (sql.startsWith('SELECT id, student_id')) {
        const account = accounts.find((candidate) => candidate.role === 'student' && (Number(candidate.studentId) === Number(params[1]) || (!candidate.studentId && String(candidate.email).toLowerCase() === String(params[2]).toLowerCase())))
        return [[account ? { ...account } : undefined].filter(Boolean)]
      }
      if (sql.startsWith('UPDATE users SET student_id=')) {
        const account = accounts.find((candidate) => Number(candidate.id) === Number(params[1]))
        account.studentId = Number(params[0])
        return [{ affectedRows: 1 }]
      }
      if (sql.startsWith('UPDATE users SET display_name=')) {
        const hasPasswordUpdate = sql.includes('password_hash=?')
        const accountId = hasPasswordUpdate ? params[3] : params[2]
        const account = accounts.find((candidate) => Number(candidate.id) === Number(accountId))
        Object.assign(account, { name: params[0], ...(hasPasswordUpdate ? { passwordHash: params[1], mustChangePassword: true } : {}), studentId: Number(hasPasswordUpdate ? params[2] : params[1]), isActive: true })
        return [{ affectedRows: 1 }]
      }
      if (sql.startsWith('INSERT INTO users')) {
        accounts.push({ role: params[0], name: params[1], email: null, passwordHash: params[2], studentId: Number(params[3]), mustChangePassword: true, id: accounts.length + 1 })
        return [{ insertId: accounts.at(-1).id }]
      }
      return [{ affectedRows: 1 }]
    },
  })
  return { accounts, runQuery, runTransaction }
}

test('recognizes bcrypt hashes and never treats the initial password as a hash', async () => {
  const hash = await bcrypt.hash(DEFAULT_STUDENT_PASSWORD, 10)
  assert.equal(isBcryptHash(hash), true)
  assert.equal(isBcryptHash(DEFAULT_STUDENT_PASSWORD), false)
})

test('student account migration is idempotent and reports created and skipped records', async () => {
  const existingHash = await bcrypt.hash('Already changed', 10)
  const database = createFakeDatabase([
    { id: 1, usn: '4PM26CSE001', name: 'CSE Student', email: 'cse@example.com', passwordHash: existingHash },
    { id: 2, usn: '4PM26ECE001', name: 'ECE Student', email: 'ece@example.com', passwordHash: null },
  ], [{ id: 10, role: 'student', studentId: 1, email: 'cse@example.com', passwordHash: existingHash }])
  const hash = async (password) => bcrypt.hash(password, 10)

  const first = await migrateStudentAccounts({ ...database, hash })
  assert.equal(first.totalStudents, 2)
  assert.deepEqual(first.counts, { checked: 2, created: 1, skipped: 1, errors: 0 })
  assert.equal(database.accounts.filter((account) => account.role === 'student').length, 2)
  assert.equal(database.accounts.find((account) => account.studentId === 2).passwordHash === DEFAULT_STUDENT_PASSWORD, false)

  const second = await migrateStudentAccounts({ ...database, hash })
  assert.deepEqual(second.counts, { checked: 2, created: 0, skipped: 2, errors: 0 })
})

test('student account migration does not bind a duplicate contact email to another student', async () => {
  const existingHash = await bcrypt.hash('Already changed', 10)
  const database = createFakeDatabase([
    { id: 1, usn: '4PM26CSE002', name: 'First Student', email: 'shared@example.com', passwordHash: existingHash },
    { id: 2, usn: '4PM26ECE002', name: 'Second Student', email: 'shared@example.com', passwordHash: null },
  ], [{ id: 10, role: 'student', studentId: 1, email: 'shared@example.com', passwordHash: existingHash }])
  const report = await migrateStudentAccounts({ ...database, hash: (password) => bcrypt.hash(password, 10) })
  assert.deepEqual(report.counts, { checked: 2, created: 1, skipped: 1, errors: 0 })
  assert.equal(database.accounts.filter((account) => account.role === 'student').length, 2)
  assert.equal(database.accounts.find((account) => account.studentId === 2).email, null)
})
