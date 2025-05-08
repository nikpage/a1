showFeedback(feedback) {
  this.reviewSection.classList.remove('hidden');

  if (!feedback || typeof feedback !== 'object') {
    this.reviewOutput.innerHTML = '<p>No feedback data available.</p>';
    return;
  }

  let html = `
    <div id="feedback-result" style="margin-bottom: 30px;"></div>
    <form id="metadata-form">
  `;

  for (const key in feedback) {
    if (Array.isArray(feedback[key])) {
      html += `
        <div class="field-block">
          <label>${key}:</label><br>
          <textarea name="${key}" rows="2">${feedback[key].join(', ')}</textarea>
          <label><input type="checkbox" name="use_${key}" checked> Use</label>
        </div><br>`;
    } else {
      html += `
        <div class="field-block">
          <label>${key}:</label><br>
          <input type="text" name="${key}" value="${feedback[key]}">
          <label><input type="checkbox" name="use_${key}" checked> Use</label>
        </div><br>`;
    }
  }

  html += `
    <button id="submit-metadata-btn" type="button" style="margin-top: 20px; padding: 10px 20px;">Submit Metadata</button>
    </form>
  `;

  this.reviewOutput.innerHTML = html;

  setTimeout(() => {
    const submitBtn = document.getElementById('submit-metadata-btn');
    if (submitBtn) {
      submitBtn.addEventListener('click', async () => {
        const form = new FormData(document.getElementById('metadata-form'));
        const payload = {};

        for (const [key, value] of form.entries()) {
          if (key.startsWith('use_')) continue;
          const useKey = 'use_' + key;
          if (form.get(useKey)) {
            payload[key] = value.trim();
          }
        }

        try {
          const res = await fetch('/api/second-stage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              metadata: payload,
              cv_body: this.parsedText
            })
          });

          const result = await res.json();
          if (result.error) throw new Error(result.error);

          document.getElementById('feedback-result').innerHTML = `
            <h3>AI Feedback:</h3>
            <div style="background:#f8f8f8; padding:1rem; border-radius:8px;">
              ${result.finalFeedback ? this.formatAIText(result.finalFeedback) : 'No feedback available.'}
            </div>
          `;
        } catch (err) {
          console.error('Error submitting metadata:', err);
          document.getElementById('feedback-result').innerHTML = `
            <h3>Error:</h3>
            <div style="background:#f8f8f8; padding:1rem; border-radius:8px; color:red;">
              Failed to submit metadata: ${err.message}
            </div>
          `;
        }
      });
    }
  }, 0);
}
