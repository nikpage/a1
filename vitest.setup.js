// vitest.setup.js
//
// `callGemini` refuses any call that has no AI cost context — no context, no
// call, so spend can never belong to nobody (see utils/ai-meter.js). The test
// runner is no exception: rather than punching a hole in that rule for tests,
// every test file runs inside a real context named 'test'.
//
// Tests mock axios, so nothing here reaches Google. But if a test ever forgets
// to mock it, the call is still attributed, still metered and still subject to
// the daily ceiling — which is the point.

import { enterAiContext } from './utils/ai-meter.js';

enterAiContext({ context: 'test', user_id: null });
