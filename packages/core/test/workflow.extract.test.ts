import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Engine } from '../src/workflow';
import { Store } from '../src/storage';
import type { PageDefinition, WorkflowDefinition } from '../src/types';

describe('Engine extract workflows', () => {
  const mem = new Map<string, string>();
  const clipboardMock = vi.fn();

  beforeEach(() => {
    mem.clear();
    clipboardMock.mockReset();
    const g = globalThis as any;
    g.GM_getValue = (key: string) => mem.get(key);
    g.GM_setValue = (key: string, value: string) => { mem.set(key, value); };
    g.GM_deleteValue = (key: string) => { mem.delete(key); };
    g.GM_listValues = () => Array.from(mem.keys());
    g.GM_setClipboard = clipboardMock;
    g.GM_registerMenuCommand = vi.fn();
    g.alert = vi.fn();
    (navigator as any).clipboard = { writeText: vi.fn() };
    document.title = 'Workflow Extract Test';
  });

  it('copies full page info payload', async () => {
    const workflow: WorkflowDefinition = {
      id: 'demo.page.info',
      label: 'Demo: Page Info',
      steps: [
        {
          kind: 'extract',
          items: [
            { from: { global: 'document.title' }, intoKey: 'title', take: 'raw' },
            { from: { global: 'location.href' }, intoKey: 'href', take: 'raw' },
            { from: { global: 'location.host' }, intoKey: 'host', take: 'raw' },
            { from: { global: 'location.pathname' }, intoKey: 'path', take: 'raw' },
            { from: { global: 'navigator.userAgent' }, intoKey: 'ua', take: 'raw' },
            { from: { global: 'timestamp' }, intoKey: 'timestamp', take: 'raw' }
          ],
          copyToClipboard: true,
          present: false
        }
      ]
    };

    const page: PageDefinition = {
      id: 'demo',
      label: 'Demo',
      detector: { exists: { selector: 'html' } },
      workflows: [workflow]
    };

    const engine = new Engine({ pages: [page] }, new Store('spec')); // MenuUI init ok in jsdom
    await engine.runWorkflow(workflow);

    expect(clipboardMock).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(clipboardMock.mock.calls[0][0]);
    expect(Object.keys(payload)).toEqual(
      expect.arrayContaining(['title', 'href', 'host', 'path', 'ua', 'timestamp'])
    );
    expect(payload.href).toBe(globalThis.location.href);
  });

  it('captures regex-based data and exposes template vars', async () => {
    const workflow: WorkflowDefinition = {
      id: 'demo.capture',
      label: 'Demo Capture',
      steps: [
        {
          kind: 'captureData',
          id: 'paste',
          prompt: 'Paste order data',
          copyToClipboard: true,
          patterns: [
            { pattern: 'Order\\s*#\\s*(\\d+)', into: 'orderId' },
            { pattern: 'Email:\\s*([^\\n]+)', into: 'email' }
          ]
        },
        {
          kind: 'error',
          message: 'Order={{vars.orderId}} Email={{vars.email}}'
        }
      ]
    };

    const page: PageDefinition = {
      id: 'demo',
      label: 'Demo',
      detector: { exists: { selector: 'html' } },
      workflows: [workflow]
    };

    const engine = new Engine({ pages: [page] }, new Store('spec'));
    (engine as any).promptForText = vi.fn().mockResolvedValue('Order #42\nEmail: user@test.com');

    const alertMock = globalThis.alert as any;
    alertMock.mockReset();

    await engine.runWorkflow(workflow, true);

    expect(clipboardMock).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(clipboardMock.mock.calls[0][0]);
    expect(payload.orderId).toBe('42');
    expect(payload.email).toBe('user@test.com');
    expect(payload.__raw).toContain('Order #42');
    expect(alertMock).toHaveBeenCalledWith('Order=42 Email=user@test.com');
  });
});
