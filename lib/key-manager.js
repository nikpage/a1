// lib/deepseekClient.js
import { KeyManager } from './key-manager';
import { buildCVMetadataExtractionPrompt, buildCVFeedbackPrompt } from './prompt-builder';

const API_URL = process.env.DEEPSEEK_API_URL;
const keyManager = new KeyManager();

async function callDeepSeek(prompt) {
  console.log('callDeepSeek invoked');
  const apiKey = keyManager.getNextKey() || (() => { throw new Error('No API key'); })();
  console.log('Using DeepSeek API key in callDeepSeek:', apiKey);

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [ { role: "user", content: prompt } ]
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DeepSeek error: ${err}`);
  }

  const json = await res.json();
  if (json.usage) keyManager.trackUsage(json.usage);
  return json;
}

export async function generate(prompt) {
  return callDeepSeek(prompt);
}

export function extractMetadata(text) {
  return callDeepSeek(buildCVMetadataExtractionPrompt(text));
}

export function getFeedback(metadata, cvBody) {
  return callDeepSeek(buildCVFeedbackPrompt(metadata, cvBody));
}
