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
        const account = accounts.find((candidate) => candidate.role === 'student' && (Number(candidate.studentId) === Number(params[1]) || String(candidate.email).toLowerCase() === String(params[2]).toLowerCase()))
        return [[account ? { ...account } : undefined].filter(Boolean)]
      }
      if (sql.startsWith('UPDATE users SET student_id=')) {
        const account = accounts.find((candidate) => Number(candidate.id) === Number(params[1]))
        account.studentId = Number(params[0])
        return [{ affectedRows: 1 }]
      }
      if (sql.startsWith('UPDATE users SET display_name=')) {
        const account = accounts.find((candidate) => Number(candidate.id) === Number(params[4]))
        Object.assign(account, { name: params[0], email: params[1], passwordHash: params[2], studentId: Number(params[3]), mustChangePassword: true })
        return [{ affectedRows: 1 }]
      }
      if (sql.startsWith('INSERT INTO users')) {
        accounts.push({ role: params[0], name: params[1], email: params[2], passwordHash: params[3], studentId: Number(params[4]), mustChangePassword: true, id: accounts.length + 1 })
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
  assert.deepEqual(first.counts, { created: 1, skipped: 1, errors: 0 })
  assert.equal(database.accounts.filter((account) => account.role === 'student').length, 2)
  assert.equal(database.accounts.find((account) => account.studentId === 2).passwordHash === DEFAULT_STUDENT_PASSWORD, false)

  const second = await migrateStudentAccounts({ ...database, hash })
  assert.deepEqual(second.counts, { created: 0, skipped: 2, errors: 0 })
})
