import type { RuntimeCommand, RuntimeResponse } from './shared/messages';
import { loadRuntime } from './shared/runtime';

let initialized = false;

async function handleCommand(command: RuntimeCommand): Promise<RuntimeResponse> {
  const runtime = await loadRuntime();

  try {
    if (command.kind === 'detect-site') {
      return { ok: true, data: runtime.detect_site(window.location.href) };
    }

    if (command.kind === 'list-workflows') {
      return { ok: true, data: runtime.list_workflows(command.site) };
    }

    if (command.kind === 'run-workflow') {
      return { ok: true, data: runtime.run_workflow(command.site, command.workflowId) };
    }

    if (command.kind === 'capture-jira-table') {
      return { ok: true, data: runtime.capture_jira_filter_table() };
    }

    return { ok: false, error: 'unsupported command' };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}

function installListener(): void {
  if (initialized) {
    return;
  }

  initialized = true;
  chrome.runtime.onMessage.addListener(
    (
      message: RuntimeCommand,
      _sender: chrome.runtime.MessageSender,
      sendResponse: (response?: RuntimeResponse) => void,
    ) => {
      void handleCommand(message).then(sendResponse);
      return true;
    },
  );
}

installListener();
