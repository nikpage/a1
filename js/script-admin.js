// script-admin.js

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const res = await fetch('/api/stats');
    const stats = await res.json();

    document.getElementById('cv-count').innerText = stats.cv || 0;
    document.getElementById('cover-count').innerText = stats.cover || 0;
    document.getElementById('extract-count').innerText = stats.extract || 0;
    document.getElementById('tokens-spent').innerText = stats.tokens || 0;
    document.getElementById('tone-formal').innerText = stats.tone?.Formal || 0;
    document.getElementById('tone-neutral').innerText = stats.tone?.Neutral || 0;
    document.getElementById('tone-casual').innerText = stats.tone?.Casual || 0;
    document.getElementById('tone-cocky').innerText = stats.tone?.Cocky || 0;
  } catch (error) {
    console.error('Failed to load admin stats', error);
  }
});
