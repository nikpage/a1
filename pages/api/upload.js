const handleUpload = async () => {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    const base64 = reader.result.split(',')[1];
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        file: { content: base64, name: file.name, type: file.type },
      }),
    });
    const { metadata } = await res.json();
    console.log('🧠 Metadata received:', metadata);

    // Save to document_inputs
    await fetch('/api/save-document-input', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        type: 'cv',
        source: 'upload',
        fileName: file.name,
        content: metadata,
      }),
    });

    if (onUpload) onUpload({ metadata });
  };
  re
