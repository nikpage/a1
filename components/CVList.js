// components/CVList.js
export default function CVList({ cvs }) {
  if (!cvs || cvs.length === 0) return <p className="cvlist-empty">No CVs uploaded yet.</p>;

  return (
    <ul className="cvlist">
      {cvs.map((cv) => (
        <li key={cv.id} className="cvlist-item">
          <a
            href={cv.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="cvlist-link"
          >
            View CV
          </a>
          <p className="cvlist-meta">Updated: {new Date(cv.updated_at).toLocaleString()}</p>
        </li>
      ))}
    </ul>
  );
}
