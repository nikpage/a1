import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import JobInput from '../../js/session/JobInput.js';
import MetadataTone from '../../js/session/MetadataTone.js';
import DocPreview from '../../js/session/DocPreview.js';
import DownloadPay from '../../js/session/DownloadPay.js';
import { post } from '../../js/services/api.js';

export default function SessionPage({ secretId, initialTokens }) {
  const [step, setStep] = useState(1);
  const [jobMeta, setJobMeta] = useState(null);
  const [parsedCV, setParsedCV] = useState(null);
  const [tone, setTone] = useState('Neutral');
  const [feedback, setFeedback] = useState(null);
  const [docs, setDocs] = useState({ cvHTML: '', coverLetterHTML: '' });
  const [tokens, setTokens] = useState(initialTokens);

  const handleAnalyze = (metadata) => {
    setJobMeta(metadata);
    setStep(2);
  };

  const handleMetadataSubmit = async (metaData) => {
    setTone(metaData.tone);
    setParsedCV(metaData.parsedCV || {});
    setFeedback(metaData.feedback || {});
    const result = await post('/api/build-docs', {
      parsedCV,
      jobMeta: metaData,
      tone: metaData.tone,
      feedback
    });
    setDocs(result);
    setStep(3);
  };

  const handlePurchase = () => {
    // TODO: implement purchase flow
  };

  return (
    <>
      <Head>
        <title>Session {secretId}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className="session-page">
        <header className="session-header">
          <h1>Session: {secretId}</h1>
          <p>Tokens: {tokens}</p>
        </header>

        <main className="session-main">
          {step === 1 && <JobInput onAnalyze={handleAnalyze} />}
          {step === 2 && jobMeta && (
            <MetadataTone initialMeta={jobMeta} onSubmit={handleMetadataSubmit} />
          )}
          {step === 3 && (
            <>
              <DocPreview
                cvHTML={docs.cvHTML}
                coverLetterHTML={docs.coverLetterHTML}
                watermarkText={secretId}
              />
              <DownloadPay
                cvHTML={docs.cvHTML}
                coverLetterHTML={docs.coverLetterHTML}
                tokens={tokens}
                onPurchase={handlePurchase}
              />
            </>
          )}
        </main>
      </div>
    </>
  );
}

export async function getServerSideProps(context) {
  const { secretId } = context.query;
  // Optionally fetch initial token balance or session data
  const initialTokens = 0; // default for new users
  return { props: { secretId, initialTokens } };
}
