export default function Privacy() {
  return (
    <main style={{ maxWidth: 680, margin: '0 auto', padding: '2rem 1rem', fontFamily: 'sans-serif', lineHeight: 1.6 }}>
      <h1>Privacy & Data Retention</h1>
      <p><strong>What we store:</strong> your uploaded CV text, generated documents, and (if you log in) your email address.</p>
      <p><strong>How long:</strong> generated documents are automatically deleted after 90 days. Your CV and account data are kept until you delete your account.</p>
      <p><strong>Your rights:</strong> you can delete your account and all associated data at any time from your account page.</p>
      <p><strong>Payments:</strong> we do not store card details. Payments are processed by Stripe.</p>
      <p><strong>AI processing:</strong> your CV and job description are sent to Google Gemini for analysis and document generation. Google&apos;s data-handling terms apply.</p>
      <p><strong>Contact:</strong> questions? Email us at privacy@mysuper.cv.</p>
    </main>
  );
}
