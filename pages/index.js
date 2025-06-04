// /pages/index.js

import { useEffect, useState } from 'react';
import Header from '../components/Header';
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

  useEffect(() => {
    const existing = sessionStorage.getItem('user_secret');
    if (existing) {
      fetch(`/api/users?secret=${existing}`)
        .then(res => res.json())
        .then(data => {
          setUserId(data.id);
          setSecretUrl(`${window.location.origin}/u/${existing}`);
        });
    } else {
      fetch('/api/users', { method: 'POST' })
        .then(res => res.json())
        .then(({ userId: id, secret }) => {
          setUserId(id);
          setSecretUrl(`${window.location.origin}/u/${secret}`);
          sessionStorage.setItem('user_secret', secret);
        });
    }
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const header = document.querySelector('header');
      if (window.scrollY > 50) {
        header.classList.add('shrink');
      } else {
        header.classList.remove('shrink');
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (!userId) return <div>Loading...</div>;

  return (
    <>
      <Header />
      <div className="container">
        {!cvMetadata || Object.keys(cvMetadata).length === 0 ? (
          <CardUpload
            userId={userId}
            setCvMetadata={setCvMetadata}
            setSelectedLang={setSelectedLang}
            setFieldUsage={setFieldUsage}
          />
        ) : (
          <>
            <CardCVMeta
              cvMetadata={cvMetadata}
              setCvMetadata={setCvMetadata}
              fieldUsage={fieldUsage}
              setFieldUsage={setFieldUsage}
              userId={userId}
              selectedMarket={selectedMarket}
              selectedLang={selectedLang}
              setFeedback={setFeedback}
            />
            <CardCVFeedback feedback={feedback} secretUrl={secretUrl} />
          </>
        )}
      </div>
    </>
  );
}
