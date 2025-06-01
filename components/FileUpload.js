// components/FileUpload.js

import { useState } from 'react';

function FileUpload({ onUpload, userId }) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const uploadFile = (file) => {
    // Validate userId
    if (!userId) {
      console.error('Error: Missing userId');
      alert('Error: Missing userId. Please provide a valid userId.');
      return;
    }

    // Validate file
    if (!file) {
      console.error('Error: No file selected');
      alert('Error: No file selected. Please select a file to upload.');
      return;
    }

    setIsUploading(true);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64Content = reader.result.split(',')[1]; // Extract base64 content

        // Build the payload to match the backend's expectations
        const payload = {
          userId: userId, // Pass userId
          file: {
            name: file.name, // Pass file name
            content: base64Content, // Pass base64-encoded file content
          },
        };

        // Make the API request
        const response = await fetch('/api/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        const result = await response.json();

        if (response.ok && !result.error) {
          console.log('Upload successful:', result);
          if (onUpload) {
            onUpload(result); // Call the onUpload callback
          }
        } else {
          console.error('Upload failed:', result.error);
          alert(`Upload failed: ${result.error || 'Unknown error'}`);
        }
      } catch (error) {
        console.error('Error uploading file:', error);
        alert('An unexpected error occurred while uploading the file.');
      } finally {
        setIsUploading(false);
      }
    };

    reader.readAsDataURL(file); // Convert file to base64
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      uploadFile(files[0]);
    }
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
          onChange={(e) => uploadFile(e.target.files[0])}
          disabled={isUploading}
          style={{ marginTop: '10px' }}
        />
      </div>
      {isUploading && <p>Uploading...</p>}
    </div>
  );
}

export default FileUpload;
