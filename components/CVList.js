// components/CVList.js
export default function CVList({ cvs }) {
  if (!cvs || cvs.length === 0) return <p className="mt-4">No CVs uploaded yet.</p>;

  return (
    <ul className="mt-4 space-y-2">
      {cvs.map((cv) => (
        <li key={cv.id} className="p-2 border rounded">
          <a
            href={cv.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-blue-600 hover:underline"
          >
            View CV
          </a>
          <p className="text-sm text-gray-500">Updated: {new Date(cv.updated_at).toLocaleString()}</p>
        </li>
      ))}
    </ul>
  );
}
