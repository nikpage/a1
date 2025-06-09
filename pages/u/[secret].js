// /pages/u/[secret].js

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import DashboardHeader from '../../components/DashboardHeader';
import CardTools from '../../components/cardTools';
import CardDashboard from '../../components/cardDashboard';
import CardDocsView from '../../components/cardDocsView';
import CardUser from '../../components/cardUser';

const CARD_MAP = {
  dashboard: CardDashboard,
  docs: CardDocsView,
  user: CardUser,
  // Add more cards if you have them
};

export default function SecretPage() {
  const router = useRouter();
  const { secret } = router.query;

  const [userId, setUserId] = useState(null);
  const [tone, setTone] = useState('neutral');
  const [activeTool, setActiveTool] = useState('dashboard');

  useEffect(() => {
    if (!secret) return;
    const fetchUser = async () => {
      try {
        const res = await fetch(`/api/users?secret=${secret}`);
        const user = await res.json();
        if (user?.id && typeof user.id === 'string' && user.id.length === 36) {
          setUserId(user.id);
        } else if (user?.userId && typeof user.userId === 'string' && user.userId.length === 36) {
          setUserId(user.userId);
        } else {
          setUserId(null);
        }
      } catch {
        setUserId(null);
      }
    };
    fetchUser();
  }, [secret]);

  const Card = CARD_MAP[activeTool];

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <CardTools active={activeTool} onSelect={setActiveTool} />
      <div style={{ flex: 1, marginLeft: 70, padding: '2rem' }}>
        <DashboardHeader secret={secret} />

        <div style={{ margin: '1rem 0 2rem 0' }}>
          <span><b>User ID:</b> {userId || 'Not found'}</span>
          <div style={{ marginTop: '1rem' }}>
            <label>Select Tone:</label>
            {['neutral', 'formal', 'casual', 'cocky'].map((t) => (
              <button
                key={t}
                style={{ marginLeft: '0.5rem' }}
                onClick={() => setTone(t)}
                className={tone === t ? 'selected' : ''}
              >
                {t[0].toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {userId && Card && <Card userId={userId} />}
      </div>
    </div>
  );
}
