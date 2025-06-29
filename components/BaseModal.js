// path: components/BaseModal.js

export default function BaseModal({ onClose, children }) {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(0,0,0,0.4)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 9999  // <-- bump from 1000 to 9999
    }}>
      <div style={{
        background: '#fff',
        padding: 40,
        borderRadius: 12,
        textAlign: 'center',
        maxWidth: 480,
        width: '90%',
        boxShadow: '0 2px 20px rgba(0,0,0,0.3)'  // Optional: add visual lift
      }}>
        {children}
        <button onClick={onClose} style={{ marginTop: 20 }}>Close</button>
      </div>
    </div>
  );
}
