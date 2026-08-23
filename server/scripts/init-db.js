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
await connection.end()
console.log('CAMPS schema created.')
