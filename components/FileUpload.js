import { useState } from 'react';

export default function FileUpload({ userId, onUpload }) {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploaded, setIsUploaded] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setIsUploaded(false);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setIsUploaded(false);
    }
  };

  const handleUpload = async (e) => {
    e.stopPropagation(); // keep drop zone safe
    if (!file) return;
    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result.split(',')[1];
      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            file: { content: base64, name: file.name, type: file.type },
          }),
        });
        const data = await res.json();
        if (data?.metadata && onUpload) {
          onUpload({ metadata: data.metadata });
          setIsUploaded(true);
        } else {
          console.error('Upload error or missing metadata:', data);
        }
      } catch (error) {
        console.error('Upload failed:', error);
      }
      setIsLoading(false);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div
      className={`file-drop-zone ${isDragging ? 'dragover' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => document.getElementById('fileInput').click()}
      style={{
        position: 'relative', // 💡 so the button can be absolutely placed inside
        border: '2px dashed var(--primary-green)',
        borderRadius: '8px',
        padding: '2rem',
        textAlign: 'center',
        fontWeight: 500,
        cursor: 'pointer',
        backgroundColor: isDragging ? 'var(--primary-green)' : 'transparent',
        color: isDragging ? '#fff' : 'var(--primary-blue)',
        borderColor: isDragging ? 'var(--primary-blue)' : 'var(--primary-green)',
        transition: 'background-color 0.2s ease, border-color 0.2s ease',
        minHeight: '150px',
      }}
    >
      <p>{isDragging ? 'Drop the file here!' : 'Drag & drop a file, or click to select'}</p>
      <input
        id="fileInput"
        type="file"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />
      {file && (
        <div style={{ marginTop: '1rem', color: 'var(--primary-blue)' }}>
          <p style={{ margin: 0 }}>Selected: {file.name}</p>
          {/* Button locked to bottom-left corner */}
          <button
            onClick={handleUpload}
            disabled={!file || isLoading || isUploaded}
            style={{
              position: 'absolute',
              bottom: '1rem',
              left: '1rem',
              backgroundColor:
                isLoading || isUploaded ? 'var(--primary-blue)' : 'var(--primary-green)',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              padding: '0.5rem 1rem',
              cursor: !file || isLoading || isUploaded ? 'not-allowed' : 'pointer',
              opacity: isLoading || isUploaded ? 0.7 : 1,
              transition: 'background-color 0.2s ease, transform 0.1s ease, opacity 0.2s ease',
            }}
            onMouseDown={(e) => {
              if (!isLoading && !isUploaded) e.currentTarget.style.transform = 'scale(0.97)';
            }}
            onMouseUp={(e) => {
              if (!isLoading && !isUploaded) e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            {isLoading ? 'Uploading…' : isUploaded ? 'Uploaded' : 'Upload CV'}
          </button>
        </div>
      )}
    </div>
  );
}
