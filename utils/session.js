import crypto from 'crypto'

export default function genSessionId() {
  return crypto.randomBytes(16).toString('hex')
}
