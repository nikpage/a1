import { useState } from 'react';

function FileUpload({ onUpload, userId }) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const uploadFile = (file) => {
    if (!userId) {
      alert('Missing userId.');
      return;
    }

    if (!file) {
      alert('No file selected.');
      return;
    }

    setIsUploading(true);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64Content = reader.result.split(',')[1];
        const payload = {
          userId,
          file: {
            name: file.name,
            content: base64Content,
          },
        };

        const response = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const result = await response.json();

        if (response.ok && !result.error) {
          onUpload && onUpload(result);
        } else {
          alert(`Upload failed: ${result.error || 'Unknown error'}`);
        }
      } catch (error) {
        alert('Error uploading file.');
      } finally {
        setIsUploading(false);
      }
    };

    reader.onerror = () => {
      alert('Failed to read the file.');
      setIsUploading(false);
    };

    reader.readAsDataURL(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);

    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  };

  const handleFileInput = (e) => {
    const file = e.target.files[0];
    if (file) uploadFile(file);
  };

  return (
    <div>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${isDragOver ? '#007bff' : '#ccc'}`,
          borderRadius: '8px',
          padding: '20px',
          textAlign: 'center',
          backgroundColor: isDragOver ? '#f8f9fa' : '#fff',
          cursor: 'pointer',
          margin: '10px 0',
        }}
      >
        <p>Drag and drop files here, or click to select</p>
        <input
          type="file"
          onChange={handleFileInput}
          disabled={isUploading}
          style={{ marginTop: '10px' }}
        />
      </div>
      {isUploading && <p>Uploading...</p>}
    </div>
  );
}

export default FileUpload;
