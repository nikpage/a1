// /api/analyze.js
import fetch from 'node-fetch';

import { buildCVFeedbackPrompt } from '../js/prompt-builder.js';
import { KeyManager } from '../js/key-manager.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
    }

    const keyManager = new KeyManager();
    const apiKey = keyManager.keys[0]; // ✅ Get key from KeyManager

    if (!apiKey) {
        return res.status(500).json({ message: 'No DeepSeek API Key available.' });
    }

    try {
        const { text, documentType = 'cv_file' } = req.body;
        const prompt = buildCVFeedbackPrompt(documentType);

        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [
                    { role: 'system', content: prompt },
                    { role: 'user', content: text }
                ],
                temperature: 0.7
            })
        });

        const raw = await response.text();
console.log('RAW:', raw);
const data = JSON.parse(raw);


        if (!response.ok) {
            throw new Error(data?.error?.message || 'DeepSeek API error');
        }

        keyManager.trackUsage(data.usage);

        res.status(200).json({
            feedback: data.choices?.[0]?.message?.content || '',
            usage: data.usage
        });

    } catch (error) {
        console.error('Server API error:', error);
        res.status(500).json({ message: error.toString() });
    }
}
