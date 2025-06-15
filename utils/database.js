// utils/database.js
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
})

export async function upsertUser(user_id) {
  const query = `
    INSERT INTO users (user_id, tokens, created_at)
    VALUES ($1, 3, NOW())
    ON CONFLICT (user_id)
    DO UPDATE SET tokens = users.tokens
    RETURNING *
  `
  const result = await pool.query(query, [user_id])
  return result.rows[0]
}

export async function upsertCV(user_id, cv_file_url, cv_data) {
  const query = `
    INSERT INTO cv_data (user_id, cv_file_url, cv_data, created_at)
    VALUES ($1, $2, $3, NOW())
    ON CONFLICT (user_id)
    DO UPDATE SET cv_file_url = $2, cv_data = $3, created_at = NOW()
  `
  await pool.query(query, [user_id, cv_file_url, cv_data])
}

export async function getCVData(user_id) {
  const query = 'SELECT * FROM cv_data WHERE user_id = $1'
  const result = await pool.query(query, [user_id])
  return result.rows[0]
}

export async function getUser(user_id) {
  const query = 'SELECT * FROM users WHERE user_id = $1'
  const result = await pool.query(query, [user_id])
  return result.rows[0]
}

export async function decrementToken(user_id) {
  const query = `
    UPDATE users
    SET tokens = tokens - 1
    WHERE user_id = $1 AND tokens > 0
    RETURNING tokens
  `
  const result = await pool.query(query, [user_id])
  return result.rows[0]
}
