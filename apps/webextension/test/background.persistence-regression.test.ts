import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sendTabMessageMock = vi.fn();
const storageGetMock = vi.fn();
const storageSetMock = vi.fn();
const queryActiveTabMock = vi.fn();
const formatErrorMock = vi.fn((error: unknown) => (error instanceof Error ? error.message : String(error)));

vi.mock('../src/shared/webext-async', () => ({
  sendTabMessage: sendTabMessageMock,
  storageGet: storageGetMock,
  storageSet: storageSetMock,
  queryActiveTab: queryActiveTabMock,
  formatError: formatErrorMock,
}));

type RuntimeMessageListener = (
  message: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
) => boolean | void;

let runtimeMessageListener: RuntimeMessageListener | null = null;

function installChromeStub() {
  runtimeMessageListener = null;

  (globalThis as any).chrome = {
    runtime: {
      onInstalled: { addListener: vi.fn() },
      onMessage: {
        addListener: vi.fn((listener: RuntimeMessageListener) => {
          runtimeMessageListener = listener;
        }),
      },
      lastError: undefined,
      getURL: vi.fn(() => 'chrome-extension://id/extension.html'),
    },
    tabs: {
      onUpdated: { addListener: vi.fn() },
      onActivated: { addListener: vi.fn() },
      query: vi.fn(),
      get: vi.fn(),
      create: vi.fn(),
    },
    downloads: {
      download: vi.fn(),
    },
  };
}

async function importBackground() {
  vi.resetModules();
  installChromeStub();
  await import('../src/background');
  expect(runtimeMessageListener).toBeTypeOf('function');
}

async function dispatchMessage(message: unknown): Promise<any> {
  if (!runtimeMessageListener) {
    throw new Error('runtime message listener not installed');
  }

  return await new Promise((resolve) => {
    runtimeMessageListener!(
      message,
      { tab: { id: 101, windowId: 1, url: 'https://example.com' } } as chrome.runtime.MessageSender,
      (response) => resolve(response),
    );
  });
}

beforeEach(() => {
  sendTabMessageMock.mockReset();
  storageGetMock.mockReset();
  storageSetMock.mockReset();
  queryActiveTabMock.mockReset();
  formatErrorMock.mockClear();

  storageGetMock.mockImplementation(async (key: string, fallback: unknown) => {
    if (key === 'cv_rules_state') return {};
    if (key === 'cv_logs') return [];
    return fallback;
  });

  storageSetMock.mockImplementation(async (entries: Record<string, unknown>) => {
    const keys = Object.keys(entries);
    if (keys.some((key) => key.startsWith('cv_last_run_'))) {
      throw new Error('storage quota exceeded');
    }
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('background rule persistence regression', () => {
  it('keeps run-rule-with-result-mode return path successful when last-run storage write fails', async () => {
    await importBackground();
    const runtimeResult = {
      ok: true,
      data: { status: 'success', artifacts: [] },
    };
    sendTabMessageMock.mockResolvedValueOnce(runtimeResult);

    const response = await dispatchMessage({
      kind: 'run-rule-with-result-mode',
      payload: { ruleId: 'rule-1', site: 'carvana', resultMode: 'return' },
    });

    expect(response).toEqual(runtimeResult);
    expect(storageSetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        cv_last_run_carvana: runtimeResult.data,
        ['cv_last_run_carvana_rule-1']: runtimeResult.data,
      }),
    );
  });

  it('keeps run-rule path successful when last-run storage write fails', async () => {
    await importBackground();
    const runtimeResult = {
      ok: true,
      data: { status: 'success', artifacts: [] },
    };
    sendTabMessageMock.mockResolvedValueOnce(runtimeResult);

    const response = await dispatchMessage({
      kind: 'run-rule',
      payload: { ruleId: 'rule-2', site: 'carvana' },
    });

    expect(response).toEqual(runtimeResult);
    expect(storageSetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        cv_last_run_carvana: runtimeResult.data,
        ['cv_last_run_carvana_rule-2']: runtimeResult.data,
      }),
    );
  });
});
