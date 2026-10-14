import dotenv from 'dotenv'
import { getPool, query, transaction } from '../db.js'
import { migrateStudentAccounts } from '../studentAccountMigration.js'

dotenv.config()

const pool = getPool()
if (!pool) {
  console.error('Set USE_DEMO_DATA=false and configure MySQL before migrating student accounts.')
  process.exitCode = 1
} else {
  try {
    const report = await migrateStudentAccounts({ runQuery: query, runTransaction: transaction })
    console.log(JSON.stringify(report, null, 2))
    process.exitCode = report.errors.length ? 1 : 0
  } catch (error) {
    console.error(JSON.stringify({ created: [], skipped: [], errors: [{ message: error.message }], counts: { created: 0, skipped: 0, errors: 1 } }, null, 2))
    process.exitCode = 1
  } finally {
    await pool.end()
  }
}
