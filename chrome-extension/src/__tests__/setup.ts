import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Chrome APIs
const createMockStorageArea = () => ({
  get: vi.fn((keys, callback) => {
    if (callback) callback({});
    return Promise.resolve({});
  }),
  set: vi.fn((items, callback) => {
    if (callback) callback();
    return Promise.resolve();
  }),
  remove: vi.fn((keys, callback) => {
    if (callback) callback();
    return Promise.resolve();
  }),
  clear: vi.fn((callback) => {
    if (callback) callback();
    return Promise.resolve();
  }),
});

const mockChrome = {
  storage: {
    sync: createMockStorageArea(),
    local: createMockStorageArea(),
    onChanged: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
      hasListener: vi.fn(),
    },
  },
  runtime: {
    sendMessage: vi.fn((message, callback) => {
      if (callback) callback({});
      return Promise.resolve({});
    }),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
      hasListener: vi.fn(),
    },
    getManifest: vi.fn(() => ({
      version: '1.0.0',
      name: 'Test Extension',
    })),
    id: 'test-extension-id',
  },
  sidePanel: {
    open: vi.fn((options) => Promise.resolve()),
    setOptions: vi.fn((options) => Promise.resolve()),
    getOptions: vi.fn((options) => Promise.resolve({})),
  },
  windows: {
    getAll: vi.fn(() => Promise.resolve([])),
    getCurrent: vi.fn(() => Promise.resolve({ id: 1 })),
    get: vi.fn((windowId) => Promise.resolve({ id: windowId })),
  },
  tabs: {
    query: vi.fn(() => Promise.resolve([])),
    getCurrent: vi.fn(() => Promise.resolve({ id: 1 })),
    sendMessage: vi.fn((tabId, message, callback) => {
      if (callback) callback({});
      return Promise.resolve({});
    }),
  },
};

// Assign to global
(global as any).chrome = mockChrome;

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});
