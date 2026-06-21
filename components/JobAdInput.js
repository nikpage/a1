import { useTranslation } from 'react-i18next';
import { detectJobInputMode } from '../utils/detectJobInputMode.js';

export default function JobAdInput({ jobText, setJobText }) {
  const { t } = useTranslation('jobAdInput');
  const mode = detectJobInputMode(jobText);

  return (
    <div>
      <label className="block mb-1 font-medium">{t('label')}</label>
      <textarea
        className="w-full min-h-[100px] border rounded-xl p-2"
        placeholder={t('placeholder')}
        value={jobText}
        onChange={e => setJobText(e.target.value)}
      />
      {mode === 'url' && (
        <p className="text-sm text-blue-600 mt-1">{t('linkDetected')}</p>
      )}
    </div>
  );
}
