// components/MasterProgressTracker.js
//
// The 4-step onboarding blueprint shown at the top of the master-build flow.
// Step 1 (Add Your CV — upload + background master build) is already done by the
// time the user lands here. Step 2 (Verify Master Profile) is the active step:
// the user confirms the structured record and settles any open questions. Steps 3
// and 4 are locked until onboarding completes and the user enters USE.
//
//   states per step: 'done' | 'active' | 'locked'

const STEPS = [
  { key: 'addcv', label: 'Add Your CV' },
  { key: 'master', label: 'Verify Master Profile' },
  { key: 'job', label: 'Add Target Job' },
  { key: 'create', label: 'Create Super CV & Cover Letter' },
];

function dot(state) {
  if (state === 'done') return { ring: 'bg-green-600 border-green-600 text-white', mark: '✓' };
  if (state === 'active') return { ring: 'bg-white border-blue-600 text-blue-600', mark: '' };
  return { ring: 'bg-gray-100 border-gray-300 text-gray-400', mark: '🔒' };
}

export default function MasterProgressTracker({ states }) {
  // states: { addcv, master, job, create }
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
