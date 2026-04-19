import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

class MockAudio {
  onended: null | (() => void) = null;
  onerror: null | (() => void) = null;

  constructor(_src?: string) {}

  async play() {
    this.onended?.();
  }
}

Object.defineProperty(globalThis, 'Audio', {
  configurable: true,
  writable: true,
  value: MockAudio,
});

Object.defineProperty(window, 'speechSynthesis', {
  configurable: true,
  writable: true,
  value: {
    speak: vi.fn(),
  },
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
});
