<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CV Uploader & Metadata</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
    .step { display: none; }
    .step.active { display: block; }
    .button { padding: 10px 20px; margin: 5px; cursor: pointer; }
    .button.primary { background: #007bff; color: #fff; border: none; }
    .button.disabled { background: #ccc; cursor: not-allowed; }
    #navigation { margin-bottom: 20px; }
    #navigation .nav-item { display: inline-block; margin-right: 10px; cursor: pointer; }
    #navigation .nav-item.current { font-weight: bold; }
  </style>
</head>
<body>
  <div id="navigation">
    <span class="nav-item current" data-step="1">1. Upload</span>
    <span class="nav-item" data-step="2">2. Review</span>
    <span class="nav-item" data-step="3">3. Submit</span>
  </div>

  <!-- Step 1: File Upload -->
  <div id="step-1" class="step active">
    <h2>Step 1: Upload Your CV</h2>
    <input type="file" id="file-input" accept=".pdf,.doc,.docx" />
    <div id="file-info" style="margin-top:10px;"></div>
    <button type="button" id="next-1" class="button primary disabled" disabled>Next: Review</button>
  </div>

  <!-- Step 2: Review Extracted Text -->
  <div id="step-2" class="step">
    <h2>Step 2: Review Extracted Text</h2>
    <pre id="extracted-text" style="background:#f4f4f4; padding:10px; height:200px; overflow:auto;"></pre>
    <button type="button" id="prev-2" class="button">← Back</button>
    <button type="button" id="next-2" class="button primary">Next: Metadata</button>
  </div>

  <!-- Step 3: Submit Metadata -->
  <div id="step-3" class="step">
    <h2>Step 3: Submit Metadata</h2>
    <form id="metadata-form">
      <label>Name:<br><input type="text" name="name" required /></label><br><br>
      <label>Email:<br><input type="email" name="email" required /></label><br><br>
      <label>Notes:<br><textarea name="notes" rows="4"></textarea></label><br><br>
      <button type="button" id="prev-3" class="button">← Back</button>
      <button type="submit" class="button primary">Submit</button>
    </form>
    <div id="submit-result" style="margin-top:20px;"></div>
  </div>

  <script>
    const navItems = document.querySelectorAll('#navigation .nav-item');
    const steps = {1: document.getElementById('step-1'), 2: document.getElementById('step-2'), 3: document.getElementById('step-3')};
    function showStep(n) {
      Object.values(steps).forEach(s => s.classList.remove('active'));
      steps[n].classList.add('active');
      navItems.forEach(item => {
        item.classList.toggle('current', Number(item.dataset.step) === n);
      });
    }

    // Allow clicking nav items for navigation
    navItems.forEach(item => {
      item.addEventListener('click', () => {
        const step = Number(item.dataset.step);
        if (step === 1 || (step === 2 && fileData) || (step === 3 && extractedText)) {
          showStep(step);
        }
      });
    });

    // Step 1 logic
    const fileInput = document.getElementById('file-input');
    const fileInfo = document.getElementById('file-info');
    const next1 = document.getElementById('next-1');
    let fileData = null;
    let extractedText = '';

    fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      if (!file) return;
      fileInfo.textContent = `Selected: ${file.name} (${(file.size/1024/1024).toFixed(2)} MB)`;
      next1.disabled = false;
      next1.classList.remove('disabled');
      fileData = file;
    });

    next1.addEventListener('click', async () => {
      if (!fileData) return;
      extractedText = await extractText(fileData);
      document.getElementById('extracted-text').textContent = extractedText;
      showStep(2);
    });

    // Back and Next buttons
    document.getElementById('prev-2').addEventListener('click', () => showStep(1));
    document.getElementById('next-2').addEventListener('click', () => showStep(3));
    document.getElementById('prev-3').addEventListener('click', () => showStep(2));

    // Step 3  submit
    document.getElementById('metadata-form').addEventListener('submit', e => {
      e.preventDefault();
      const data = new FormData(e.target);
      const result = {};
      data.forEach((v, k) => result[k] = v);
      document.getElementById('submit-result').innerHTML = `<pre>${JSON.stringify(result, null, 2)}</pre>`;
    });

    // Dummy extractText function
    async function extractText(file) {
      return new Promise(res => {
        const reader = new FileReader();
        reader.onload = () => {
          // just show first 200 chars
          const text = reader.result.slice(0,200) + '...';
          res(text);
        };
        reader.readAsText(file);
      });
    }
  </script>
</body>
</html>
