// /public/js/generate.js (fixed version)

export async function generateDocument(data) {
  const statusText = document.getElementById('statusText');

  try {
    statusText.textContent = 'Generating document...';

    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error('Server did not return JSON. Got: ' + contentType);
    }

    const result = await response.json();

    if (result.error) {
      throw new Error(result.error);
    }

    statusText.textContent = 'Document generated successfully!';
    return result;
  } catch (error) {
    console.error('Error generating document:', error);
    statusText.textContent = `Error: ${error.message}`;
    return null;
  }
}
