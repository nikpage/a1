// lib/session.js
import { mintSessionToken } from './auth';

const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days
export const COOKIE_NAME = 'auth-token';

// A cookie's identity is name + domain + path, so a host-only `auth-token` does
// NOT replace one previously stored against the parent domain — the browser
// keeps both and sends both, and the server reads whichever comes first. A
// leftover domain-scoped cookie therefore shadows every new login for good.
// Every response that sets or clears the session must also clear the
// domain-scoped twin. Derived from the site URL; skipped for bare hosts like
// `localhost`, which cannot carry a domain cookie.
function parentDomain() {
  try {
    const host = new URL(process.env.NEXT_PUBLIC_SITE_URL || '').hostname;
    return host.includes('.') ? host.replace(/^www\./, '') : null;
  } catch {
    return null;
  }
}

function clearDomainScopedCookies() {
  const domain = parentDomain();
  if (!domain) return [];
  return [
    `${COOKIE_NAME}=; Path=/; Max-Age=0; Domain=.${domain}`,
    `${COOKIE_NAME}=; Path=/; Max-Age=0; Domain=${domain}`,
  ];
}

export function setSessionCookie(res, { user_id, email = null }) {
  const token = mintSessionToken({ user_id, email });
  const isProd = process.env.NODE_ENV === 'production';
  // The session cookie leads; the clears target different cookie identities
  // (domain-scoped, not host-only), so they cannot cancel it whatever the order.
  res.setHeader('Set-Cookie', [
    `${COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${COOKIE_MAX_AGE}; ${
      isProd ? 'SameSite=None; Secure' : 'SameSite=Lax'
    }`,
    ...clearDomainScopedCookies(),
  ]);
}

// Sign-out / account deletion: clear the host-only cookie AND its domain-scoped
// twin, or the stale one survives and the user stays "logged in" as a ghost.
export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', [
    `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly`,
    ...clearDomainScopedCookies(),
  ]);
}
