import mysql from 'mysql2/promise'
import dotenv from 'dotenv'

dotenv.config()

const config = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'camps_app',
  password: process.env.DB_PASSWORD || '',
  connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT || 5000),
}
const configuredDatabase = process.env.DB_NAME || 'camps_project4'
const identifier = (value) => `\`${String(value).replaceAll('`', '``')}\``
const coreTables = ['students', 'users', 'parents', 'teachers', 'attendance', 'internal_marks', 'subject_records', 'predictions']

let connection
try {
  connection = await mysql.createConnection(config)
  const [databaseRows] = await connection.query('SHOW DATABASES')
  const accessibleDatabases = databaseRows.map((row) => Object.values(row)[0]).filter(Boolean).map(String)
  const candidates = [...new Set([configuredDatabase, 'camps', 'camps_project4', ...accessibleDatabases.filter((name) => /^camps(?:_|$)/i.test(name))])]
  const databases = []

  for (const database of candidates) {
    if (!accessibleDatabases.includes(database)) {
      databases.push({ database, accessible: false, reason: 'not listed for the configured MySQL user' })
      continue
    }
    const [tableRows] = await connection.query(
      'SELECT table_name AS tableName FROM information_schema.tables WHERE table_schema=? ORDER BY table_name',
      [database],
    )
    const tables = tableRows.map((row) => row.tableName)
    const result = { database, accessible: true, tables, counts: {}, studentColumns: [] }
    for (const table of coreTables) {
      if (!tables.includes(table)) continue
      try {
        const [countRows] = await connection.query(`SELECT COUNT(*) AS count FROM ${identifier(database)}.${identifier(table)}`)
        result.counts[table] = Number(countRows[0]?.count || 0)
      } catch (error) {
        result.counts[table] = { error: error.code || error.message }
      }
    }
    if (tables.includes('students')) {
      const [columnRows] = await connection.query(
        'SELECT column_name AS name, data_type AS dataType, is_nullable AS nullable FROM information_schema.columns WHERE table_schema=? AND table_name=? ORDER BY ordinal_position',
        [database, 'students'],
      )
      result.studentColumns = columnRows
      const [semesterRows] = await connection.query(`SELECT department_code AS department, semester, COUNT(*) AS count FROM ${identifier(database)}.${identifier('students')} GROUP BY department_code, semester ORDER BY department_code, semester`)
      result.studentCountsByDepartmentSemester = semesterRows.map((row) => ({ department: row.department, semester: Number(row.semester), count: Number(row.count) }))
    }
    databases.push(result)
  }

  console.log(JSON.stringify({
    connection: { host: config.host, port: config.port, user: config.user, configuredDatabase },
    databases,
    note: 'Read-only inspection. No schema or data writes were attempted.',
  }, null, 2))
} catch (error) {
  console.error(JSON.stringify({
    connection: { host: config.host, port: config.port, user: config.user, configuredDatabase },
    error: { code: error.code || error.name, message: error.message },
    note: 'Read-only inspection could not connect. No schema or data writes were attempted.',
  }, null, 2))
  process.exitCode = 2
} finally {
  await connection?.end().catch(() => {})
}
