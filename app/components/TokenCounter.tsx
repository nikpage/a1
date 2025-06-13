// app/components/TokenCounter.tsx
interface TokenCounterProps {
  tokens: number
}

export default function TokenCounter({ tokens }: TokenCounterProps) {
  return (
    <div className="bg-white rounded-lg shadow px-4 py-2">
      <div className="flex items-center space-x-2">
        <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z" clipRule="evenodd" />
        </svg>
        <span className="text-sm font-medium text-gray-700">
          {tokens} tokens remaining
        </span>
      </div>
    </div>
  )
}
