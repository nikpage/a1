// ===== DEV VERSION =====
// /api/analyze.js
import { KeyManager } from '../js/key-manager.js';
import { buildCVMetadataExtractionPrompt } from '../js/prompt-builder.js'; // <-- Missing import
const km = new KeyManager();

// Enable JSON body parsing
export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'No text provided' });

    const apiKey = km.keys[0];
    console.log('[DeepSeek API] Using Key index:', km.currentKeyIndex);


    if (!apiKey) throw new Error('API key missing');

    const apiRes = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'user', content: buildCVMetadataExtractionPrompt(text) }
        ],
        response_format: { type: 'json_object' }
      })
    });

    if (!apiRes.ok) {
      const errTxt = await apiRes.text();
      throw new Error(`DeepSeek error ${apiRes.status}: ${errTxt}`);
    }

    const chatJson = await apiRes.json();
    const content = chatJson.choices[0].message.content;
    let parsed;
    let locationHint = null;
    try {
      parsed = JSON.parse(content);

if (parsed.places && parsed.places.length > 0) {
  locationHint = parsed.places[0]; // or run scoring logic
} else if (parsed.languages && parsed.languages.length > 0) {
  const langToCountry = { cs: 'Czech Republic', fr: 'France', de: 'Germany', es: 'Spain', it: 'Italy', pl: 'Poland', nl: 'Netherlands', en: 'UK' };
  const langCode = parsed.languages[0].toLowerCase();
  locationHint = langToCountry[langCode] || 'Europe';
}

    } catch {
      throw new Error('Invalid JSON from DeepSeek');
    }

    // Normalize European language codes
const isoMap = {
  cz: 'cs',       // Czech
  en_gb: 'en',    // English UK
  en_us: 'en',    // English US
  fr_fr: 'fr',    // French
  de_de: 'de',    // German
  it_it: 'it',    // Italian
  es_es: 'es',    // Spanish
  pt_pt: 'pt',    // Portuguese
  pt_br: 'pt',    // Brazilian Portuguese (still relevant in EU apps)
  nl: 'nl',       // Dutch
  pl: 'pl',       // Polish
  sk: 'sk',       // Slovak
  ro: 'ro',       // Romanian
  hu: 'hu',       // Hungarian
  bg: 'bg',       // Bulgarian
  el: 'el',       // Greek
  sv: 'sv',       // Swedish
  da: 'da',       // Danish
  fi: 'fi',       // Finnish
  no: 'no'        // Norwegian
};

let primaryLang = Array.isArray(parsed.languages) && parsed.languages.length > 0
  ? parsed.languages[0].toLowerCase()
  : null;

if (primaryLang && isoMap[primaryLang]) {
  primaryLang = isoMap[primaryLang];
}

return res.status(200).json({ ...parsed, languageHint: primaryLang, locationHint });
  } catch (err) {
    console.error('API analyze error:', err);
    return res.status(500).json({ error: err.message });
  }
}
