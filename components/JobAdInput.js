export default function JobAdInput({ jobText, setJobText }) {
  return (
    <div>
      <label className="block mb-1 font-medium">Paste Job Description (optional):</label>
      <textarea
        className="w-full min-h-[100px] border rounded-xl p-2"
        value={jobText}
        onChange={e => setJobText(e.target.value)}
      />
    </div>
  )
}
