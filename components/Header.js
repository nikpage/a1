// path: /Header.js
import Image from 'next/image';
import { useState } from 'react';

export default function Header({ user_id, generationsRemaining, docDownloadsRemaining }) {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSend = async (e) => {
    e.preventDefault();
    setSending(true);
    setSent(false);
    setError('');

    try {
      const res = await fetch('/api/send-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, user_id }), // ✅ sends both email + user_id
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to send email.');
      } else {
        setSent(true);
      }
    } catch (err) {
      setError('Network error.');
    }

    setSending(false);
  };

  return (
    <header className="flex items-center justify-between py-8 px-6 mb-8 border-b border-accent bg-bg">
      <div className="flex items-center">
        <Image
          src="/logo_cvprp+trans.png"
          alt="CV App Logo"
          width={120}
          height={60}
          className="h-16 w-auto object-contain"
          priority
        />
      </div>
      <div className="flex flex-col items-end space-y-1 min-w-[250px]">
        <span className="text-sm text-muted-foreground">
          Generations Remaining: <b>{generationsRemaining}</b>
        </span>
        <span className="text-sm text-muted-foreground">
          Doc Downloads Remaining: <b>{docDownloadsRemaining}</b>
        </span>
        <form className="flex space-x-2 mt-2" onSubmit={handleSend} autoComplete="off">
          <input
            type="email"
            required
            placeholder="Email me my link"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
            disabled={sending || sent}
          />
          <button
            type="submit"
            className="bg-primary text-white px-3 py-1 rounded text-sm"
            disabled={sending || sent}
          >
            {sending ? 'Sending...' : sent ? 'Sent' : 'Send'}
          </button>
        </form>
        {error && <div className="text-red-500 text-xs mt-1">{error}</div>}
        {sent && <div className="text-green-600 text-xs mt-1">Email sent!</div>}
      </div>
    </header>
  );
}
