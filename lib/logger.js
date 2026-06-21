const IS_PROD = process.env.NODE_ENV === 'production';

export const logger = {
  debug: IS_PROD ? () => {} : (...a) => console.log('[DEBUG]', ...a),
  info:  IS_PROD ? () => {} : (...a) => console.log('[INFO]',  ...a),
  warn:  (...a) => console.warn('[WARN]',  ...a),
  error: (...a) => console.error('[ERROR]', ...a),
};
