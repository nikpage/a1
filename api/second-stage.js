// File: /api/second-stage.js
import { KeyManager } from '../js/key-manager.js';
import { buildCVFeedbackPrompt } from '../js/prompt-builder.js';

const km = new KeyManager();

// Enable JSON body parsing
export const config = { api: { bodyParser: true } };

// Helper to limit field size safely
function limitFieldLength(value, max = 1000) {
  if (!value) return 'Not Provided';
  if (typeof value === 'string') return value.length > max ? value.slice(0, max) + '...' : value;
  if (Array.isArray(value)) return value.map(v => v.length > max ? v.slice(0, max) + '...' : v).join(', ');
  return 'Not Provided';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { metadata, cv_body } = req.body;
    if (!metadata || !cv_body) {
      return res.status(400).json({ error: 'Metadata and CV body are required.' });
    }

    const apiKey = km.keys[0];
    if (!apiKey) throw new Error('API key missing');

    const documentType = 'cv_file';
    const targetIndustry = guessIndustry(metadata.industries);
    const country = guessCountry(metadata.languages);

    const promptInstructions = buildCVFeedbackPrompt(documentType, targetIndustry, country);

    const userMetadataSummary = `
📄 Candidate Overview:

• Title: ${limitFieldLength(metadata.title)}
• Seniority Level: ${limitFieldLength(metadata.seniority)}
• Current Company: ${limitFieldLength(metadata.company)}
• Years of Experience: ${limitFieldLength(metadata.years_experience)}
• Target Industries: ${limitFieldLength(metadata.industries)}
• Education: ${limitFieldLength(metadata.education)}
• Languages: ${limitFieldLength(metadata.languages)}

🛠 Skills:

${limitFieldLength(metadata.skills)}

🏆 Achievements:

${limitFieldLength(metadata.achievements)}

🎖 Certifications:

${limitFieldLength(metadata.certifications)}
`;

    // Assemble the final prompt
    const finalPrompt = `
You are reviewing a candidate's CV. Use the profile and document provided below.

${userMetadataSummary}

📝 CV Content:

${cv_body}

📋 Review Instructions:

${promptInstructions}
`;

    // Call DeepSeek Chat Completions API
    const apiRes = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'user', content: finalPrompt }
        ]
      })
    });

    if (!apiRes.ok) {
      const errTxt = await apiRes.text();
      throw new Error(`DeepSeek error ${apiRes.status}: ${errTxt}`);
    }

    const chatJson = await apiRes.json();
    const finalFeedback = chatJson.choices[0].message.content;

    return res.status(200).json({ finalFeedback });
  } catch (err) {
    console.error('API second-stage error:', err);
    return res.status(500).json({ error: err.message });
  }
}

// --- Helpers ---
function guessIndustry(industries) {
  if (!industries) return 'general';
  const lower = industries.toLowerCase();
  if (lower.includes('tech') || lower.includes('software') || lower.includes('it')) return 'tech';
  if (lower.includes('finance') || lower.includes('banking')) return 'finance';
  if (lower.includes('healthcare') || lower.includes('medical')) return 'healthcare';
  return 'general';
}

function guessCountry(languages) {
  if (!languages) return 'us';
  const lower = languages.toLowerCase();
  if (lower.includes('czech')) return 'cz';
  if (lower.includes('spanish')) return 'es';
  if (lower.includes('german')) return 'de';
  if (lower.includes('french')) return 'fr';
  if (lower.includes('polish')) return 'pl';
  if (lower.includes('romanian')) return 'ro';
  if (lower.includes('ukrainian')) return 'ua';
  return 'us';
}
