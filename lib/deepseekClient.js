// lib/deepseekClient.js
import KeyManager from './key-manager';
import { buildCVMetadataExtractionPrompt, buildCVFeedbackPrompt } from './prompt-builder';

const API_URL = process.env.DEEPSEEK_API_URL;
const FALLBACK_KEY = process.env.DEEPSEEK_API_KEY;

async function callDeepSeek(prompt) {
  const apiKey = KeyManager.getKey() || FALLBACK_KEY;
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ prompt }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DeepSeek error: ${err}`);
  }
  return res.json();
}

export async function extractMetadata(text) {
  const prompt = buildCVMetadataExtractionPrompt(text);
  return callDeepSeek(prompt);
}

export async function getFeedback(metadata, cvBody) {
  const prompt = buildCVFeedbackPrompt(metadata, cvBody);
  return callDeepSeek(prompt);
}
