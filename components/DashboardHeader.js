import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function DashboardHeader({ secret }) {
  const [emailPrefix, setEmailPrefix] = useState('');
  const [tokenBalance, setTokenBalance] = useState(null);
  const [check, setCheck] = useState({
    users: '⏳',
    cv_metadata: '⏳',
    cv_feedback: '⏳',
  });

  useEffect(() => {
    if (!secret) return;

    const fetchUserAndCheck = async () => {
      const { data: user, error } = await supabase
        .from('users')
        .select('id, email, token_balance')
        .eq('secret', secret)
        .single();

      if (error || !user) {
        setCheck({ users: '❌', cv_metadata: '❌', cv_feedback: '❌' });
        return;
      }

      setCheck((prev) => ({ ...prev, users: '✔️' }));

      const prefix = user.email?.split('@')[0] || 'Unknown';
      setEmailPrefix(prefix);
      setTokenBalance(user.token_balance ?? 0);

      const { data: metadata, error: metaErr } = await supabase
        .from('cv_metadata')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (metaErr || !metadata) {
        setCheck((prev) => ({ ...prev, cv_metadata: '❌', cv_feedback: '❌' }));
        return;
      }

      setCheck((prev) => ({ ...prev, cv_metadata: '✔️' }));

      const { data: feedback, error: fbErr } = await supabase
        .from('cv_feedback')
        .select('id')
        .eq('cv_metadata_id', metadata.id)
        .maybeSingle();

      setCheck((prev) => ({
        ...prev,
        cv_feedback: fbErr || !feedback ? '❌' : '✔️',
      }));
    };

    fetchUserAndCheck();
  }, [secret]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '1rem' }}>
      <img src="/logo.png" alt="Logo" style={{ height: '40px', marginRight: '1rem' }} />
      <div>
        <h2>Welcome, {emailPrefix}</h2>
        <p>
          Token Balance: {tokenBalance !== null ? tokenBalance : '...'} &nbsp;|&nbsp;
          Verification: users {check.users}, metadata {check.cv_metadata}, feedback {check.cv_feedback}
        </p>
      </div>
    </div>
  );
}
