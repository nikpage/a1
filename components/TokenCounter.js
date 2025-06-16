export default function TokenCounter({ tokens }) {
  return (
    <div className="text-right font-semibold">
      Tokens: <span className={tokens > 0 ? 'text-green-600' : 'text-red-600'}>{tokens}</span>
    </div>
  )
}
