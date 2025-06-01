import React from 'react';

export default function Header({ email }) {
  return (
    <header style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0.5rem 1rem',
      backgroundColor: '#f5f5f5',
      borderBottom: '1px solid #ddd',
      height: '60px',
      overflow: 'hidden', // Ensures the content stays within the header
    }}>
      <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
        <img
          src="/logo_cvprp+trans.png"
          alt="Logo"
          style={{
            height: '100%',
            width: 'auto',
            objectFit: 'contain',
          }}
        />
      </div>

      <div style={{ fontSize: '0.95rem', color: '#333' }}>
        {email ? `Logged in as: ${email}` : 'Not logged in'}
      </div>
    </header>
  );
}
