// path: /pages/api/login.js
import { Magic } from '@magic-sdk/admin';
const magic = new Magic(process.env.MAGIC_SECRET_KEY);

export default async function handler(req, res) {
  const did = req.headers.authorization?.replace('Bearer ', '');
  if (!did) return res.status(401).end();
  try {
    await magic.token.validate(did);
    const metadata = await magic.users.getMetadataByToken(did);
    res.status(200).json({ user: metadata });
  } catch {
    res.status(401).end();
  }
}
