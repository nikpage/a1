import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Logger is environment-sensitive at module load time. We re-import it inside each
// describe block after setting NODE_ENV so the IS_PROD branch is evaluated freshly.

describe('logger — non-production mode', () => {
  let logger;
  let spyLog, spyWarn, spyError;

  beforeEach(async () => {
    vi.resetModules();
    process.env.NODE_ENV = 'test'; // not 'production'
    spyLog   = vi.spyOn(console, 'log').mockImplementation(() => {});
    spyWarn  = vi.spyOn(console, 'warn').mockImplementation(() => {});
    spyError = vi.spyOn(console, 'error').mockImplementation(() => {});
    ({ logger } = await import('../lib/logger.js'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logger.info calls console.log', () => {
    logger.info('hello info');
    expect(spyLog).toHaveBeenCalledOnce();
    expect(spyLog.mock.calls[0]).toContain('hello info');
  });

  it('logger.debug calls console.log', () => {
    logger.debug('hello debug');
    expect(spyLog).toHaveBeenCalledOnce();
    expect(spyLog.mock.calls[0]).toContain('hello debug');
  });

  it('logger.warn calls console.warn', () => {
    logger.warn('hello warn');
    expect(spyWarn).toHaveBeenCalledOnce();
    expect(spyWarn.mock.calls[0]).toContain('hello warn');
  });

  it('logger.error calls console.error', () => {
    logger.error('hello error');
    expect(spyError).toHaveBeenCalledOnce();
    expect(spyError.mock.calls[0]).toContain('hello error');
  });
});

describe('logger — production mode', () => {
  let logger;
  let spyLog, spyWarn, spyError;

  beforeEach(async () => {
    vi.resetModules();
    process.env.NODE_ENV = 'production';
    spyLog   = vi.spyOn(console, 'log').mockImplementation(() => {});
    spyWarn  = vi.spyOn(console, 'warn').mockImplementation(() => {});
    spyError = vi.spyOn(console, 'error').mockImplementation(() => {});
    ({ logger } = await import('../lib/logger.js'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.NODE_ENV;
  });

  it('logger.info is a no-op (console.log never called)', () => {
    logger.info('should be silent');
    expect(spyLog).not.toHaveBeenCalled();
  });

  it('logger.debug is a no-op (console.log never called)', () => {
    logger.debug('should be silent');
    expect(spyLog).not.toHaveBeenCalled();
  });

  it('logger.warn still emits in production', () => {
    logger.warn('prod warn');
    expect(spyWarn).toHaveBeenCalledOnce();
    expect(spyWarn.mock.calls[0]).toContain('prod warn');
  });

  it('logger.error still emits in production', () => {
    logger.error('prod error');
    expect(spyError).toHaveBeenCalledOnce();
    expect(spyError.mock.calls[0]).toContain('prod error');
  });
});
