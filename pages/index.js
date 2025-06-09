import { useEffect, useState } from 'react';
import DashboardHeader from '../components/DashboardHeader';
import CardUpload from '../components/cardUpload';
import CardCVMeta from '../components/cardCV_Meta';
import CardCVFeedback from '../components/cardCVFeedback';

export default function HomePage() {
  const [userId, setUserId] = useState(null);
  const [secretUrl, setSecretUrl] = useState(null);
  const [cvMetadata, setCvMetadata] = useState({});
  const [fieldUsage, setFieldUsage] = useState({});
  const [feedback, setFeedback] = useState('');
  const [selectedLang, setSelectedLang] = useState('en');
  const [selectedMarket, setSelectedMarket] = useState('eu');
  const [tokenCount, setTokenCount] = useState(0);
  const [activeCard, setActiveCard] = useState('meta'); // <-- ADD THIS LINE

  useEffect(() => {
    const existing = sessionStorage.getItem('user_secret');
    if (existing) {
      fetch(`/api/users?secret=${existing}`)
        .then(res => res.json())
        .then(data => {
          setUserId(data.id);
          setSecretUrl(`${window.location.origin}/u/${existing}`);
          setTokenCount(data.tokenCount || 0);
        });
    } else {
      fetch('/api/users', { method: 'POST' })
        .then(res => res.json())
        .then(({ userId: id, secret, tokenCount: tokens }) => {
          setUserId(id);
          setSecretUrl(`${window.location.origin}/u/${secret}`);
          setTokenCount(tokens || 0);
          sessionStorage.setItem('user_secret', secret);
        });
    }
  }, []);

  if (!userId) return <div>Loading...</div>;

  // Prepare header props
  const headerProps = {
    userName: "User",
    tokenCount: tokenCount,
    userStatus: "users",
    metadata: cvMetadata && Object.keys(cvMetadata).length > 0,
    feedback: feedback !== '',
    input: true
  };

  return (
    <>
      <DashboardHeader {...headerProps} />
      <div className="container" style={{ paddingTop: '0px' }}>
        {!cvMetadata || Object.keys(cvMetadata).length === 0 ? (
          <CardUpload
            userId={userId}
            setCvMetadata={setCvMetadata}
            setSelectedLang={setSelectedLang}
            setFieldUsage={setFieldUsage}
          />
        ) : activeCard === 'meta' ? (
          <CardCVMeta
            cvMetadata={cvMetadata}
            setCvMetadata={setCvMetadata}
            fieldUsage={fieldUsage}
            setFieldUsage={setFieldUsage}
            userId={userId}
            selectedMarket={selectedMarket}
            selectedLang={selectedLang}
            setFeedback={setFeedback}
            setActiveCard={setActiveCard}
          />
        ) : (
          <CardCVFeedback feedback={feedback} secretUrl={secretUrl} />
        )}
      </div>
    </>
  );
}
