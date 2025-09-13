// components/TokenCounter.js
import { useTranslation } from 'react-i18next';

export default function TokenCounter({ tokens }) {
  const { t } = useTranslation('tokenCounter');

  return (
    <div className="text-right font-semibold">
      {t('label')} <span className={tokens > 0 ? 'text-green-600' : 'text-red-600'}>{tokens}</span>
    </div>
  )
}
