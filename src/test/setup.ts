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

class MockMediaRecorder {
  ondataavailable: null | ((event: { data: Blob }) => void) = null;
  onstop: null | (() => void) = null;

  constructor(_stream?: MediaStream) {}

  start() {}

  stop() {
    this.onstop?.();
  }
}

Object.defineProperty(globalThis, 'MediaRecorder', {
  configurable: true,
  writable: true,
  value: MockMediaRecorder,
});

Object.defineProperty(navigator, 'mediaDevices', {
  configurable: true,
  writable: true,
  value: {
    getUserMedia: vi.fn().mockResolvedValue({
      getTracks: () => [{ stop: vi.fn() }],
    }),
  },
});

Object.defineProperty(window, 'visualViewport', {
  configurable: true,
  writable: true,
  value: {
    width: 390,
    height: 844,
    offsetTop: 0,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  },
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
});
