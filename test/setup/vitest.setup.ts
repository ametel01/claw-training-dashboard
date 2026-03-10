import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

beforeEach(() => {
  (
    globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT: boolean;
    }
  ).IS_REACT_ACT_ENVIRONMENT = true;

  Object.defineProperty(globalThis, 'reportError', {
    value: vi.fn(),
    configurable: true,
    writable: true,
  });

  if (typeof HTMLElement !== 'undefined') {
    HTMLElement.prototype.scrollIntoView = vi.fn();
  }
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
