import mysql from 'mysql2/promise'
import dotenv from 'dotenv'

dotenv.config()

let pool

export function getPool() {
  if (pool) return pool
  if (String(process.env.USE_DEMO_DATA ?? 'true').toLowerCase() === 'true') return null
  pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    database: process.env.DB_NAME || 'camps',
    user: process.env.DB_USER || 'camps_app',
    password: process.env.DB_PASSWORD || '',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    namedPlaceholders: true,
    dateStrings: true,
  })
  return pool
}

export async function query(sql, params = {}) {
  const activePool = getPool()
  if (!activePool) throw new Error('Database is not enabled. Set USE_DEMO_DATA=false to use MySQL.')
  const [rows] = await activePool.query(sql, params)
  return rows
}

export async function transaction(callback) {
  const activePool = getPool()
  if (!activePool) throw new Error('Database is not enabled.')
  const connection = await activePool.getConnection()
  try {
    await connection.beginTransaction()
    const result = await callback(connection)
    await connection.commit()
    return result
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}
