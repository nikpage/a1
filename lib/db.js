// lib/db.js
import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'
import { join } from 'path'

const file = join(process.cwd(), 'db.json')
const adapter = new JSONFile(file)
const db = new Low(adapter)

export async function initDB() {
  await db.read()
  db.data ||= { users: [], cvmetadata: [], cvdata: [] }

  // upsert master user
  if (!db.data.users.find(u => u.token === 'master')) {
    db.data.users.push({
      token: 'master',
      email: 'you@yourdomain.com',
      role: 'master',
      createdAt: new Date().toISOString()
    })
    await db.write()
  }
}

export default db
