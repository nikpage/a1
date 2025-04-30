// script-index.js

document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('welcome-modal');
  const startBtn = document.getElementById('start-btn');
  const resumeUpload = document.getElementById('resume-upload');
  const uploadedFileName = document.getElementById('uploaded-file-name');
  const extractBtn = document.getElementById('extract-btn');
  const magicBtn = document.getElementById('magic-btn');
  const statusMessage = document.getElementById('status-message');

  // Show modal on first visit
  if (!localStorage.getItem('cvpro_visited')) {
    modal.classList.add('show');
  }

  startBtn.addEventListener('click', () => {
    modal.classList.remove('show');
    localStorage.setItem('cvpro_visited', 'true');
  });

  resumeUpload.addEventListener('change', () => {
    const file = resumeUpload.files[0];
    if (file) {
      uploadedFileName.textContent = file.name;
    }
  });

  extractBtn.addEventListener('click', async () => {
    const jobDesc = document.getElementById('job-description').value.trim();
    if (!jobDesc) {
      statusMessage.textContent = 'Please paste a job description!';
      return;
    }
    statusMessage.textContent = 'Extracting...';
    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: jobDesc })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      document.getElementById('job-title').value = data.title || '';
      document.getElementById('company-name').value = data.company || '';
      document.getElementById('hr-contact').value = data.hiringManager || '';
      document.getElementById('kw1').value = data.keywords[0] || '';
      document.getElementById('kw2').value = data.keywords[1] || '';
      document.getElementById('kw3').value = data.keywords[2] || '';
      document.getElementById('kw4').value = data.keywords[3] || '';
      document.getElementById('kw5').value = data.keywords[4] || '';
      document.getElementById('kw6').value = data.keywords[5] || '';

      statusMessage.textContent = '✔️ Extraction complete!';
    } catch (error) {
      console.error(error);
      statusMessage.textContent = '❌ Error extracting details.';
    }
  });

  magicBtn.addEventListener('click', async () => {
    const file = resumeUpload.files[0];
    if (!file) {
      alert('Please upload your resume file.');
      return;
    }

    let fileContent = await readFileContent(file);
    const tone = document.querySelector('input[name="tone"]:checked').value;
    const langBtn = document.querySelector('.lang-btn.active');
    const language = langBtn ? langBtn.dataset.lang : 'en';

    const docType = getSelectedDocType();

    const jobDetails = {
      title: document.getElementById('job-title').value,
      company: document.getElementById('company-name').value,
      hiringManager: document.getElementById('hr-contact').value,
      keywords: [
        document.getElementById('kw1').value,
        document.getElementById('kw2').value,
        document.getElementById('kw3').value,
        document.getElementById('kw4').value,
        document.getElementById('kw5').value,
        document.getElementById('kw6').value
      ]
    };

    localStorage.setItem('generation-payload', JSON.stringify({
      fileContent,
      tone,
      language,
      docType,
      jobDetails
    }));

    window.location.href = 'view.html';
  });

  function getSelectedDocType() {
    if (document.getElementById('cv-only').clicked) return 'CV';
    if (document.getElementById('cover-only').clicked) return 'Cover';
    return 'Both';
  }

  function readFileContent(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
      reader.readAsText(file);
    });
  }
});
