// script-view.js

document.addEventListener('DOMContentLoaded', async () => {
  const payload = JSON.parse(localStorage.getItem('generation-payload'));
  if (!payload) {
    document.getElementById('generated-text').textContent = 'No document to show.';
    return;
  }

  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  document.getElementById('generated-text').textContent = data.result;

  document.getElementById('download-btn').addEventListener('click', () => {
    const blob = new Blob([data.result], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'generated-document.txt';
    a.click();
    URL.revokeObjectURL(url);
  });
});
