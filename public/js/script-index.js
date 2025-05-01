// /js/script-index.js

const fileInput = document.getElementById('fileInput');
const jobAd = document.getElementById('jobAd');
const extractBtn = document.getElementById('extractBtn');
const generateBtn = document.getElementById('generateBtn');
const tone = document.getElementById('tone');
const docType = document.getElementById('docType');
const statusText = document.getElementById('statusText');
const jobDetailsContainer = document.getElementById('jobDetails');
const editableFields = document.getElementById('editableFields');
const flags = document.querySelectorAll('.flag');

let selectedLang = 'en';
let resumeText = '';
let jobDetails = {};

flags.forEach(btn =>
  btn.addEventListener('click', () => {
    flags.forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedLang = btn.dataset.lang;
  })
);

extractBtn.onclick = async () => {
  const input = jobAd.value.trim();
  if (!input) return alert('Paste a job ad first.');

  const res = await fetch('/api/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input })
  });

  const data = await res.json();
  if (!data.title) return alert('Extraction failed.');

  jobDetails = data;
  showEditableFields(data);
};

function showEditableFields({ title, company, hiringManager, keywords }) {
  jobDetailsContainer.classList.remove('hidden');
  editableFields.innerHTML = `
    <label>Title: <input value="${title}" data-key="title"></label>
    <label>Company: <input value="${company}" data-key="company"></label>
    <label>Hiring Manager: <input value="${hiringManager || ''}" data-key="hiringManager"></label>
    <label>Keywords: <input value="${keywords.join(', ')}" data-key="keywords"></label>
  `;
}

generateBtn.onclick = async () => {
  statusText.textContent = 'Generating...';
  const fields = document.querySelectorAll('#editableFields input');
  fields.forEach(input => {
    const key = input.dataset.key;
    if (key === 'keywords') {
      jobDetails[key] = input.value.split(',').map(k => k.trim()).filter(Boolean);
    } else {
      jobDetails[key] = input.value.trim();
    }
  });

  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileContent: resumeText,
      jobDetails,
      tone: tone.value,
      docType: docType.value,
      lang: selectedLang
    })
  });

  const data = await res.json();
  if (data.cv || data.cover) {
    sessionStorage.setItem('ai_output', JSON.stringify(data));
    window.location.href = '/view.html';
  } else {
    alert('Generation failed.');
  }

};
