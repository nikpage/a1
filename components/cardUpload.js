// /components/cardUpload.js

import FileUpload from './FileUpload';
import { franc } from 'franc';
import { languages } from '../lib/market-config';

export default function CardUpload({ userId, setCvMetadata, setSelectedLang, setFieldUsage }) {
  const detectLanguageCode = (text) => {
    const lang3 = franc(text, { minLength: 20 });
    if (lang3 === 'und') return 'en';
    return languages.find(l => l.iso6393 === lang3)?.code || 'en';
  };

  const handleUploadResult = ({ metadata, rawText }) => {
    if (!metadata) {
      console.error('No metadata received');
      return;
    }
    const detectedLang = detectLanguageCode(rawText || '');
    setSelectedLang(languages.some(l => l.code === detectedLang) ? detectedLang : 'en');
    setCvMetadata(metadata);

    const usage = {};
    const fields = [
      'current_role', 'seniority', 'primary_company', 'career_arcs_summary',
      'parallel_experiences_summary', 'years_experience', 'industries', 'education',
      'skills', 'languages', 'key_achievements', 'user_name', 'contact_info'
    ];
    fields.forEach(key => {
      const val = metadata[key];
      if (val && (Array.isArray(val) ? val.length : true)) {
        usage[key] = true;
      }
    });
    for (let i = 0; i < 30; i++) {
      usage[`skills_${i}`] = metadata.skills?.[i] ? true : false;
      usage[`industries_${i}`] = metadata.industries?.[i] ? true : false;
    }
    setFieldUsage(usage);
  };

  return <FileUpload userId={userId} onUpload={handleUploadResult} />;
}
