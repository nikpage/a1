import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function VerifyPage() {
  const router = useRouter();
  const { token } = router.query;

  useEffect(() => {
    if (token) {
      fetch(`/api/auth/verify?token=${token}`)
        .then(res => res.json())
        .then(({ redirect }) => {
          if (redirect) window.location.href = redirect;
        })
        .catch(() => router.push('/?error=login-failed'));
    }
  }, [token]);

  return <p>Verifying, please wait...</p>;
}
