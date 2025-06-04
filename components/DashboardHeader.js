// components/DashboardHeader.js
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import styles from '../styles/DashboardHeader.module.css';

export default function DashboardHeader({
  secret,
  showNav = false,
  showTicker = false,
  tickerItems = [],
  className = ""
}) {
  const [emailPrefix, setEmailPrefix] = useState('');
  const [tokenBalance, setTokenBalance] = useState(null);
  const [check, setCheck] = useState({
    users: '⏳',
    cv_metadata: '⏳',
    cv_feedback: '⏳',
    document_inputs: '⏳',
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
        setCheck({
          users: '❌',
          cv_metadata: '❌',
          cv_feedback: '❌',
          document_inputs: '❌',
        });
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
        .limit(1);

      if (metaErr || !metadata || metadata.length === 0) {
        setCheck((prev) => ({
          ...prev,
          cv_metadata: '❌',
          cv_feedback: '❌',
          document_inputs: '❌',
        }));
        return;
      }

      setCheck((prev) => ({ ...prev, cv_metadata: '✔️' }));

      const { data: feedback, error: fbErr } = await supabase
        .from('cv_feedback')
        .select('id')
        .eq('cv_metadata_id', metadata[0].id)
        .limit(1);

      setCheck((prev) => ({
        ...prev,
        cv_feedback: fbErr || !feedback || feedback.length === 0 ? '❌' : '✔️',
      }));

      const { data: doc, error: docErr } = await supabase
        .from('document_inputs')
        .select('id')
        .eq('user_id', user.id)
        .eq('type', 'cv')
        .limit(1);

      setCheck((prev) => ({
        ...prev,
        document_inputs: docErr || !doc || doc.length === 0 ? '❌' : '✔️',
      }));
    };

    fetchUserAndCheck();
  }, [secret]);

  return (
    <div className={`dashboard-header ${className}`}>
      <div className="header-main">
        <div className="header-left">
          <img src="/logo_cvprp+trans.png" alt="CV Pro" style={{height: '60px'}} />

          {/* Navigation for index page */}
          {showNav && (
            <nav className="header-nav">
              <a href="#features">Features</a>
              <a href="#pricing">Pricing</a>
              <a href="#about">About</a>
            </nav>
          )}
        </div>

        <div className="header-right">
          {secret && (
            <div className="user-info">
              <h2>Welcome, {emailPrefix}</h2>
              <div className="stats-line">
                <span className="token-balance">
                  Tokens: {tokenBalance !== null ? tokenBalance : '...'}
                </span>
                <span className="verification">
                  Status: users {check.users} metadata {check.cv_metadata} feedback {check.cv_feedback} input {check.document_inputs}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Ticker section */}
      {showTicker && tickerItems.length > 0 && (
        <div className="ticker-container">
          <div className="ticker-content">
            {tickerItems.map((item, index) => (
              <span key={index} className="ticker-item">
                {item}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
