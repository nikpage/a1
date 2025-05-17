import { KeyManager } from '../js/key-manager.js';
import { buildCVMetadataExtractionPrompt } from '../js/prompt-builder.js';
import clientPromise from '../lib/mongo.js';

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
        Authorization: `Bearer ${apiKey}`
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
      console.error('[DeepSeek API] Error response:', errTxt);
      throw new Error(`DeepSeek error ${apiRes.status}: ${errTxt}`);
    }

    const content = await apiRes.text();
    console.log('[DeepSeek API] Raw response:', content);

    let chatJson;
    try {
      chatJson = JSON.parse(content);
    } catch (parseErr) {
      console.error('[DeepSeek API] JSON parse error:', parseErr.message, 'Raw content:', content);
      throw new Error(`Failed to parse DeepSeek response: ${parseErr.message}`);
    }

    if (!chatJson.choices || !chatJson.choices[0] || !chatJson.choices[0].message || !chatJson.choices[0].message.content) {
      console.error('[DeepSeek API] Invalid response structure:', chatJson);
      throw new Error('Invalid response structure from DeepSeek');
    }

    const parsedContent = chatJson.choices[0].message.content;
    let parsed;
    try {
      parsed = JSON.parse(parsedContent);
    } catch (parseErr) {
      console.error('[DeepSeek API] Content JSON parse error:', parseErr.message, 'Raw content:', parsedContent);
      throw new Error(`Invalid JSON in DeepSeek content: ${parseErr.message}`);
    }

    // — save parsed CV into MongoDB —
    console.log('🚀 [Mongo] Inserting document:', { rawText: text, analysis: parsed });
    const client = await clientPromise;
    const db = client.db('cvpro');
    await db.collection('users').insertOne({
      rawText: text,
      analysis: parsed,
      createdAt: new Date()
    });
    console.log('✅ [Mongo] Insert complete');

    return res.status(200).json(parsed);
  } catch (err) {
    console.error('API analyze error:', err);
    return res.status(500).json({ error: `Failed to process request: ${err.message}` });
  }
}
