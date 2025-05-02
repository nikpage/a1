// /api/analyze.js
import fetch from 'node-fetch';
import { buildCVFeedbackPrompt } from '../js/prompt-builder.js';
import { KeyManager } from '../js/key-manager.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
    }

    const keyManager = new KeyManager();
    const apiKey = keyManager.keys[0];

    if (!apiKey) {
        return res.status(500).json({ message: 'No DeepSeek API Key available.' });
    }

    try {
        const { text, documentType = 'cv_file' } = req.body;

        if (!text) {
            return res.status(400).json({ message: 'No text provided.' });
        }

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
        console.log('RAW RESPONSE:', raw);

        let data;
        try {
            data = JSON.parse(raw);
        } catch (err) {
            console.error('Failed to parse DeepSeek response:', raw);
            return res.status(500).json({ message: 'Invalid JSON from DeepSeek', raw });
        }

        if (!response.ok) {
            console.error('DeepSeek API Error:', data);
            return res.status(500).json({ message: data.error?.message || 'DeepSeek API Error', raw });
        }

        keyManager.trackUsage(data.usage);

        return res.status(200).json({
            feedback: data.choices?.[0]?.message?.content || '',
            usage: data.usage
        });

    } catch (error) {
        console.error('Server API error:', error);
        return res.status(500).json({ message: error.message || 'Internal Server Error' });
    }
}
