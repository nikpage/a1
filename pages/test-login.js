// pages/test-login.js
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Initialize the client right here for this test ONLY
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function TestLoginPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    // This listener will report any successful login
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') {
        console.log('TEST PAGE LOGIN SUCCESSFUL:', session);
        setCurrentUser(session.user);
        setMessage('Login successful. See user data below.');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setMessage('Sending magic link...');
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // We redirect back to this same test page
        emailRedirectTo: 'http://localhost:3000/test-login',
      }
    });
    if (error) {
      setMessage(`Error: ${error.message}`);
    } else {
      setMessage('Check your email for the magic link to log in.');
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setMessage('Signed out.');
    setEmail('');
  }

  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif', lineHeight: '1.6' }}>
      <h1>Supabase Auth Isolation Test</h1>
      <p>This page tests authentication in isolation.</p>

      {!currentUser ? (
        <form onSubmit={handleLogin}>
          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ padding: '8px', marginRight: '10px' }}
          />
          <button type="submit" style={{ padding: '8px' }}>Send Magic Link</button>
        </form>
      ) : (
        <div>
          <h2>Welcome!</h2>
          <pre style={{ background: '#f0f0f0', padding: '15px', borderRadius: '5px' }}>
            {JSON.stringify(currentUser, null, 2)}
          </pre>
          <button onClick={handleSignOut} style={{ padding: '8px', marginTop: '10px' }}>Sign Out</button>
        </div>
      )}

      {message && <p style={{ marginTop: '20px', fontWeight: 'bold' }}>{message}</p>}
    </div>
  );
}
