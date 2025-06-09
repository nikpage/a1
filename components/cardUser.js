///  /components/cardUser.js
import { useEffect, useState } from 'react';

export default function CardUser({ userId }) {
  const [cvFiles, setCvFiles] = useState([]);
  const [newCvName, setNewCvName] = useState('');

  useEffect(() => {
    if (!userId) return;

    const fetchCvFiles = async () => {
      try {
        const res = await fetch(`/api/user-files?userId=${userId}`);
        const data = await res.json();

        if (Array.isArray(data)) {
          setCvFiles(data);
        } else {
          console.error('Invalid CV data:', data);
        }
      } catch (err) {
        console.error('Error fetching CV files:', err);
      }
    };

    fetchCvFiles();
  }, [userId]);

  const handleRenameCv = async (fileId) => {
    try {
      const res = await fetch('/api/rename-cv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId, newName: newCvName }),
      });

      if (res.ok) {
        alert('CV renamed successfully!');
        setNewCvName('');
        const updated = cvFiles.map((file) =>
          file.id === fileId ? { ...file, name: newCvName } : file
        );
        setCvFiles(updated);
      } else {
        alert('Error renaming CV');
      }
    } catch (err) {
      console.error('Rename error:', err);
      alert('Rename failed');
    }
  };

  const handleDeleteCv = async (fileId) => {
    try {
      const res = await fetch('/api/delete-cv', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId }),
      });

      if (res.ok) {
        alert('CV deleted!');
        setCvFiles(cvFiles.filter((file) => file.id !== fileId));
      } else {
        alert('Error deleting CV');
      }
    } catch (err) {
      console.error('Delete error:', err);
      alert('Delete failed');
    }
  };

  if (!userId) {
    return <p>User not loaded.</p>;
  }

  return (
    <div style={{ padding: '1rem' }}>
      <h2>Your CV & Related Files</h2>
      {cvFiles.length === 0 ? (
        <p>No CV found for this user.</p>
      ) : (
        <ul>
          {cvFiles.map((file) => (
            <li key={file.id} style={{ marginBottom: '1rem' }}>
              <strong>{file.name}</strong>
              <div style={{ marginTop: '0.5rem' }}>
                <input
                  type="text"
                  placeholder="New name"
                  value={newCvName}
                  onChange={(e) => setNewCvName(e.target.value)}
                  style={{ marginRight: '0.5rem' }}
                />
                <button onClick={() => handleRenameCv(file.id)}>
                  Rename
                </button>
                <button
                  onClick={() =>
                    confirm('Are you sure you want to delete this CV?') &&
                    handleDeleteCv(file.id)
                  }
                  style={{ marginLeft: '0.5rem', color: 'red' }}
                >
                  Delete
                </button>
              </div>
              {file.relatedFiles?.length > 0 && (
                <ul style={{ marginTop: '0.5rem' }}>
                  {file.relatedFiles.map((rf) => (
                    <li key={rf.id}>{rf.name}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
