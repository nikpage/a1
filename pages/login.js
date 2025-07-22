<<<<<<< HEAD
// path: /pages/api/login.js
import { Magic } from '@magic-sdk/admin';
const magic = new Magic(process.env.MAGIC_SECRET_KEY);

export default async function handler(req, res) {
  const did = req.headers.authorization?.replace('Bearer ', '');
  if (!did) return res.status(401).end();
  try {
    await magic.token.validate(did);
    const metadata = await magic.users.getMetadataByToken(did);
    res.status(200).json({ user: metadata });
  } catch {
    res.status(401).end();
  }
=======
// path: pages/login.js
import { useState } from 'react';
import { supabase } from '../utils/supabase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setMessage('Sending magic link...');

    const { error } = await supabase.auth.signInWithOtp({
      email: email,
      options: {
        emailRedirectTo: 'http://localhost:3000/auth/callback'
      }
    });

    if (error) {
      setMessage(error.message);
    } else {
      setMessage('Check your email for the magic link.');
    }
  };

  return (
    <main className="flex items-center justify-center min-h-screen flex-col gap-4">
      <h1 className="text-xl font-bold">Log in to save your CV analysis</h1>
      <form onSubmit={handleLogin} className="flex flex-col gap-4 w-80">
        <input
          type="email"
          placeholder="Your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="border p-3 rounded"
        />
        <button type="submit" className="bg-blue-600 text-white py-2 rounded">Send Magic Link</button>
      </form>
      {message && <p className="text-center text-sm mt-4">{message}</p>}
    </main>
  );
>>>>>>> 0dc90bed97c2b789059cc7aec82817ab86fb6540
}
