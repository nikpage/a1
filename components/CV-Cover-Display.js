// path: components/CV-Cover-Display.js

import { useState } from 'react';
import DownloadTokenPanel from './DownloadTokenPanel';

export default function CV_Cover_Display({ user_id, analysis, cvText, coverText, defaultType }) {
  const [showBuyPanel, setShowBuyPanel] = useState(false);

  // Prepare content based on defaultType
  const content = defaultType === 'cv' ? cvText : coverText;

  const renderSection = (title, sectionData) => {
    // Skip rendering the title if it's "cover_letter" and defaultType is "cover"
    const displayTitle = defaultType === 'cover' && title.toLowerCase() === 'cover_letter' ? '' : title.replace(/_/g, ' ');
    return (
      <div style={{ marginBottom: '1.6rem' }} key={title}>
        {displayTitle && (
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            {displayTitle}
          </h2>
        )}
        {typeof sectionData === 'string' ? (
          <p>{sectionData}</p>
        ) : Array.isArray(sectionData) ? (
          <ul>
            {sectionData.map((item, idx) => (
              <li key={idx} className="ml-4">
                {typeof item === 'object' && item !== null ? (
                  <div>
                    {Object.entries(item).map(([key, value]) => (
                      <div key={key}>
                        <strong>{key.replace(/_/g, ' ')}:</strong>{' '}
                        {Array.isArray(value) ? value.join(', ') : String(value)}
                      </div>
                    ))}
                  </div>
                ) : (
                  `• ${item}`
                )}
              </li>
            ))}
          </ul>
        ) : typeof sectionData === 'object' && sectionData !== null ? (
          <div>
            {Object.entries(sectionData).map(([key, value]) => (
              <div key={key}>
                <strong>{key.replace(/_/g, ' ')}:</strong>{' '}
                {Array.isArray(value) ? value.join(', ') : String(value)}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    );
  };

  const renderContent = (data) => {
    if (!data) {
      return <p>No content available</p>;
    }

    // Remove JSON wrapping
    let cleanedData = data.trim().replace(/^```json\n?/, '').replace(/```$/, '').trim();

    // If content is a string, try to parse it as JSON
    let parsedData;
    try {
      if (typeof cleanedData === 'string') {
        parsedData = JSON.parse(cleanedData);
      } else {
        parsedData = cleanedData;
      }
    } catch (e) {
      console.error('Error parsing content:', e);
      return (
        <div className="text-red-600">
          Invalid document format.<br />
          <pre style={{ whiteSpace: 'pre-wrap', color: '#444', fontSize: '0.85rem' }}>{data}</pre>
        </div>
      );
    }

    return Object.entries(parsedData).map(([title, sectionData]) => renderSection(title, sectionData));
  };

  return (
    <div className="prose lg:prose-lg leading-relaxed tracking-wide max-w-2xl mx-auto bg-gray-50 p-8 rounded-lg shadow-sm whitespace-pre-wrap">
      {renderContent(content)}
      {showBuyPanel && <DownloadTokenPanel onClose={() => setShowBuyPanel(false)} />}
    </div>
  );
}
