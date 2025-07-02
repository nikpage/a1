// path: pages/auth/callback.js

import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function Callback() {
  const router = useRouter();

  useEffect(() => {
    const redirectUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        router.push(`/${session.user.id}`);
      } else {
        router.push('/'); // fallback
      }
    };
    redirectUser();
  }, [router]);

  return <p>Redirecting...</p>;
}
