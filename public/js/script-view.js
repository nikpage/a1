// /js/script-view.js

const outputArea = document.getElementById('outputArea');
const data = sessionStorage.getItem('ai_output');

if (!data) {
  outputArea.innerHTML = '<p>No content found. Return to home page.</p>';
} else {
  const { cv, cover } = JSON.parse(data);
  outputArea.innerHTML = '';

  if (cv) {
    const cvEl = document.createElement('section');
    cvEl.innerHTML = `<h2>CV</h2><pre>${cv}</pre>`;
    outputArea.appendChild(cvEl);
  }

  if (cover) {
    const coverEl = document.createElement('section');
    coverEl.innerHTML = `<h2>Cover Letter</h2><pre>${cover}</pre>`;
    outputArea.appendChild(coverEl);
  }
}
