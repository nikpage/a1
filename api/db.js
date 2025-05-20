// /api/db.js
export default function handler(req, res) {
  // Ignore everything and always succeed
  return res.status(200).json({ success: true });
}
