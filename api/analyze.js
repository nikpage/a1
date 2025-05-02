// api/analyze.js
import { buildCVFeedbackPrompt } from '../../prompt-builder';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        const { text, documentType } = req.body;
        const prompt = buildCVFeedbackPrompt(documentType);

        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
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

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'API request failed');
        }

        const data = await response.json();
        res.status(200).json({
            feedback: data.choices[0]?.message?.content,
            usage: data.usage
        });
    } catch (error) {
        console.error('Analysis error:', error);
        res.status(500).json({ message: error.message });
    }
}
