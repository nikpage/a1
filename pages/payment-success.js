// pages/payment-success.js

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

export default function PaymentSuccess() {
  const router = useRouter();
  const { user_id, quantity } = router.query;
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!user_id || !quantity || done) return;

    fetch('/api/stripe/add-tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id, amount: parseInt(quantity) }),
    })
      .finally(() => {
        setDone(true);
        router.replace(`/${user_id}?success=true`);
      });
  }, [user_id, quantity, done]);

  return null;
}
