import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Next compiles JSX inside plain .js files; the test runner has to be told the
  // same, or importing a component for a render test fails to parse.
  plugins: [react({ include: '**/*.{js,jsx}' })],
  // rolldown-vite's oxc transform picks its parser from the file extension, so
  // JSX inside a .js component is a parse error unless it is told otherwise.
  oxc: { lang: 'jsx', jsx: 'automatic' },
  test: {
    // Node by default — almost every test here is over plain modules. A test
    // that renders a component opts into jsdom with the file-level docblock
    // pragma `@vitest-environment jsdom`, so the DOM cost is paid only there.
    environment: 'node',
    // .jsx for the component tests, which need the JSX loader above.
    include: ['**/*.test.js', '**/*.test.jsx'],
    globals: true,
    // Puts every test inside an AI cost context, because callGemini refuses an
    // unattributed call. See vitest.setup.js.
    setupFiles: ['./vitest.setup.js'],
  },
});
