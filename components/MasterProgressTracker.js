// components/MasterProgressTracker.js
//
// The 4-step onboarding blueprint shown at the top of the master-build flow.
// Steps 1 and 2 are already done by the time the user lands here (the teaser scan
// and the background master build/standardization). Step 3 is the active Flag
// Fixer. Step 4 is locked until onboarding completes and the user enters USE.
//
//   states per step: 'done' | 'active' | 'locked'

const STEPS = [
  { key: 'scan', label: 'Raw Scan' },
  { key: 'standardize', label: 'Standardization & Restructuring' },
  { key: 'flags', label: 'Resolve Open Questions' },
  { key: 'generate', label: 'Generate Winner CV' },
];

function dot(state) {
  if (state === 'done') return { ring: 'bg-green-600 border-green-600 text-white', mark: '✓' };
  if (state === 'active') return { ring: 'bg-white border-blue-600 text-blue-600', mark: '' };
  return { ring: 'bg-gray-100 border-gray-300 text-gray-400', mark: '🔒' };
}

export default function MasterProgressTracker({ states }) {
  // states: { scan, standardize, flags, generate }
  return (
    <ol className="flex items-center w-full mb-8" aria-label="Onboarding progress">
      {STEPS.map((step, i) => {
        const state = states?.[step.key] || 'locked';
        const { ring, mark } = dot(state);
        return (
          <li key={step.key} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center text-center">
              <span
                className={`flex items-center justify-center w-9 h-9 rounded-full border-2 text-sm font-semibold ${ring}`}
                aria-current={state === 'active' ? 'step' : undefined}
              >
                {mark || i + 1}
              </span>
              <span
                className={`mt-2 text-xs max-w-[8rem] ${
                  state === 'locked' ? 'text-gray-400' : 'text-gray-700 font-medium'
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-2 ${
                  states?.[STEPS[i + 1].key] === 'locked' ? 'bg-gray-200' : 'bg-green-600'
                }`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
