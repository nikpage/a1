// utils/log-gemini.js
//
// The single `[Gemini] …` console cost line required by the AI cost-logging rule
// in CLAUDE.md — one implementation shared by every caller (uploadAndAnalyze,
// TabbedViewer, DocumentGenerator, AddInfoPanel) so the format can never drift
// between them. Accepts one usage object or an array of them.

export function logGemini(u) {
  if (!u) return;
  if (Array.isArray(u)) { u.forEach(logGemini); return; }
  console.log(`[Gemini] ${u.label} | model: ${u.model} | in: ${u.inputTokens.toLocaleString()} out: ${u.outputTokens.toLocaleString()} think: ${(u.thinkingTokens||0).toLocaleString()} total: ${u.totalTokens.toLocaleString()} | cost: $${u.costUsd.toFixed(6)}`);
}

export default logGemini;
