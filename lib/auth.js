// lib/auth.js
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

// lib/auth.js
export function getTokenFromReq(req) {
  // Try cookie first
  const cookieToken = req.cookies?.['auth-token'];
  if (cookieToken) return cookieToken;

  // Try Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Try query parameter (for magic link)
  const queryToken = req.query?.token;
  if (queryToken) return queryToken;

  return null;
}

export function requireAuth(handler) {
  return async (req, res) => {
    const token = getTokenFromReq(req);

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Add user info to request
    req.user = decoded;

    return handler(req, res);
  };
}
