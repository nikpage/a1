// /api/analyze.js

import { buildCVFeedbackPrompt } from '../../public/js/prompt-builder.js'; // Correct path for Vercel functions
import { KeyManager } from '../../public/js/key-manager.js'; // Import KeyManager too

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
    }

    const keyManager = new KeyManager();
    const apiKey = process.env.DEEPSEEK_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ message: 'DeepSeek API Key missing from server config.' });
    }

    try {
        const { text, documentType = 'cv_file' } = req.body;

        if (!text) {
            return res.status(400).json({ message: 'Missing text to analyze.' });
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

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data?.error?.message || 'DeepSeek API error');
        }

        // Optional: Track usage
        if (data.usage) {
            keyManager.trackUsage(data.usage);
        }

        res.status(200).json({
            feedback: data.choices?.[0]?.message?.content || '',
            usage: data.usage
        });

    } catch (error) {
        console.error('Server API error:', error);
        res.status(500).json({ message: error.message || 'Server error occurred' });
    }
}
