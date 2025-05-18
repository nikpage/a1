// /api/analyze.js

import crypto from 'crypto';
import { KeyManager } from '../js/key-manager.js';
import { buildCVMetadataExtractionPrompt } from '../js/prompt-builder.js';

const km = new KeyManager();
export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  // shared-secret header validation
  const secretHeader = req.headers['x-shared-secret'];
  if (secretHeader !== process.env.API_SHARED_SECRET) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'No text provided' });

    const apiKey = km.keys[0];
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
    let parsed;
    try {
      parsed = JSON.parse(chatJson.choices[0].message.content);
    } catch {
      throw new Error('Invalid JSON from DeepSeek');
    }

    const userId = crypto.randomUUID();

    // insert metadata into cv_metadata table
    const metaRes = await fetch(
      'https://ybfvkdxeusgqdwbekcxm.supabase.co/rest/v1/cv_metadata',
      {
        method: 'POST',
        headers: {
          apikey:        process.env.SERVICE_ROLE_KEY,
          Authorization: `Bearer ${process.env.SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify([{
          user_id:  userId,
          metadata: parsed
        }])
      }
    );
    if (!metaRes.ok) {
      const errTxt = await metaRes.text();
      throw new Error(`Metadata insert error ${metaRes.status}: ${errTxt}`);
    }

    return res.status(200).json({ userId, metadata: parsed });
  } catch (err) {
    console.error('API analyze error:', err);
    return res.status(500).json({ error: err.message });
  }
}


// /api/second-stage.js

import { KeyManager } from '../js/key-manager.js';
import { buildCVFeedbackPrompt } from '../js/prompt-builder.js';

const km = new KeyManager();
export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  // shared-secret header validation
  const secretHeader = req.headers['x-shared-secret'];
  if (secretHeader !== process.env.API_SHARED_SECRET) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { userId, metadata, cv_body } = req.body;
    if (!userId || !metadata || !cv_body) {
      return res
        .status(400)
        .json({ error: 'userId, metadata and cv_body are required.' });
    }

    const apiKey = km.keys[0];
    if (!apiKey) throw new Error('API key missing');

    const documentType = 'cv_file';
    const targetIndustry = guessIndustry(metadata.industries || '');

    const userMetadataSummary = `
📄 Candidate Overview:
• Title: ${metadata.current_role || metadata.title || 'Not Provided'}
• Seniority Level: ${metadata.seniority || 'Not Provided'}
• Current Company: ${metadata.primary_company || metadata.company || 'Not Provided'}
• Years of Experience: ${metadata.years_experience || 'Not Provided'}
• Target Industries: ${metadata.industries || 'Not Provided'}
• Education: ${metadata.education || 'Not Provided'}
• Languages: ${metadata.languages || 'Not Provided'}

🛤 Career Arcs Summary:
${metadata.career_arcs_summary || 'Not Provided'}

🔀 Parallel Experiences Summary:
${metadata.parallel_experiences_summary || 'Not Provided'}

🛠 Skills: ${metadata.skills || 'Not Provided'}

🏆 Achievements: ${metadata.key_achievements || metadata.achievements || 'Not Provided'}

🎖 Certifications: ${metadata.certifications || 'Not Provided'}
`;

    const promptInstructions = buildCVFeedbackPrompt(documentType, targetIndustry);
    const finalPrompt = `
You are reviewing a candidate's CV.

ALWAYS respond in the candidate’s native language. Do not use English unless absolutely necessary.

Candidate Overview:
${userMetadataSummary}

📝 CV Content:
${cv_body}

📋 Review Instructions:
${promptInstructions}
`;

    const apiRes = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: finalPrompt }]
      })
    });

    if (!apiRes.ok) {
      const errTxt = await apiRes.text();
      throw new Error(`DeepSeek error ${apiRes.status}: ${errTxt}`);
    }

    const chatJson = await apiRes.json();
    const finalFeedback = chatJson.choices[0].message.content;

    // insert feedback into cv_feedback table
    const fbRes = await fetch(
      'https://ybfvkdxeusgqdwbekcxm.supabase.co/rest/v1/cv_feedback',
      {
        method: 'POST',
        headers: {
          apikey:        process.env.SERVICE_ROLE_KEY,
          Authorization: `Bearer ${process.env.SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify([{
          user_id:  userId,
          feedback: finalFeedback
        }])
      }
    );
    if (!fbRes.ok) {
      const errTxt = await fbRes.text();
      throw new Error(`Feedback insert error ${fbRes.status}: ${errTxt}`);
    }

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
  if (lower.includes('tech') || lower.includes('software') || lower.includes('it'))
    return 'tech';
  if (lower.includes('finance') || lower.includes('banking')) return 'finance';
  if (lower.includes('healthcare') || lower.includes('medical'))
    return 'healthcare';
  return 'general';
}
