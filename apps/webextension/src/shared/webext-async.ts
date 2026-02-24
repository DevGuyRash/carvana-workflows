function hasBrowserPromiseApi(): boolean {
  return Boolean((globalThis as any).browser?.tabs?.query);
}

export function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message || String(error);
  }

  if (typeof error === 'string') {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export async function queryActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const api = (globalThis as any).browser ?? (globalThis as any).chrome;
  if (!api?.tabs?.query) {
    throw new Error('tabs.query API unavailable');
  }

  if (hasBrowserPromiseApi()) {
    const tabs = await api.tabs.query({ active: true, currentWindow: true });
    return Array.isArray(tabs) ? tabs[0] : undefined;
  }

  return await new Promise<chrome.tabs.Tab | undefined>((resolve, reject) => {
    try {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const errorText = chrome.runtime.lastError?.message;
        if (errorText) {
          reject(new Error(errorText));
          return;
        }

        resolve(Array.isArray(tabs) ? tabs[0] : undefined);
      });
    } catch (error) {
      reject(error);
    }
  });
}

export async function sendRuntimeMessage<Request, Response>(
  message: Request,
): Promise<Response | undefined> {
  const api = (globalThis as any).browser ?? (globalThis as any).chrome;
  if (!api?.runtime?.sendMessage) {
    throw new Error('runtime.sendMessage API unavailable');
  }

  if ((globalThis as any).browser?.runtime?.sendMessage) {
    return (await api.runtime.sendMessage(message)) as Response | undefined;
  }

  return await new Promise<Response | undefined>((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(message, (response) => {
        const errorText = chrome.runtime.lastError?.message;
        if (errorText) {
          reject(new Error(errorText));
          return;
        }

        resolve(response as Response | undefined);
      });
    } catch (error) {
      reject(error);
    }
  });
}

export async function sendTabMessage<Request, Response>(
  tabId: number,
  message: Request,
): Promise<Response | undefined> {
  const api = (globalThis as any).browser ?? (globalThis as any).chrome;
  if (!api?.tabs?.sendMessage) {
    throw new Error('tabs.sendMessage API unavailable');
  }

  if ((globalThis as any).browser?.tabs?.sendMessage) {
    return (await api.tabs.sendMessage(tabId, message)) as Response | undefined;
  }

  return await new Promise<Response | undefined>((resolve, reject) => {
    try {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        const errorText = chrome.runtime.lastError?.message;
        if (errorText) {
          reject(new Error(errorText));
          return;
        }

        resolve(response as Response | undefined);
      });
    } catch (error) {
      reject(error);
    }
  });
}

export async function executeScriptFile(tabId: number, file: string): Promise<void> {
  const api = (globalThis as any).browser ?? (globalThis as any).chrome;

  if (api?.scripting?.executeScript) {
    if ((globalThis as any).browser?.scripting?.executeScript) {
      await api.scripting.executeScript({
        target: { tabId },
        files: [file],
      });
      return;
    }

    await new Promise<void>((resolve, reject) => {
      try {
        chrome.scripting.executeScript(
          {
            target: { tabId },
            files: [file],
          },
          () => {
            const errorText = chrome.runtime.lastError?.message;
            if (errorText) {
              reject(new Error(errorText));
              return;
            }

            resolve();
          },
        );
      } catch (error) {
        reject(error);
      }
    });
    return;
  }

  if (api?.tabs?.executeScript) {
    if ((globalThis as any).browser?.tabs?.executeScript) {
      await api.tabs.executeScript(tabId, { file });
      return;
    }

    await new Promise<void>((resolve, reject) => {
      try {
        chrome.tabs.executeScript(tabId, { file }, () => {
          const errorText = chrome.runtime.lastError?.message;
          if (errorText) {
            reject(new Error(errorText));
            return;
          }

          resolve();
        });
      } catch (error) {
        reject(error);
      }
    });
    return;
  }

  throw new Error('script injection API unavailable');
}

export async function storageGet<T>(key: string, fallback: T): Promise<T> {
  const api = (globalThis as any).browser ?? (globalThis as any).chrome;
  if (!api?.storage?.local?.get) {
    throw new Error('storage.local.get API unavailable');
  }

  if ((globalThis as any).browser?.storage?.local?.get) {
    const result = await api.storage.local.get(key);
    const value = result?.[key];
    return (value === undefined ? fallback : (value as T));
  }

  return await new Promise<T>((resolve, reject) => {
    try {
      chrome.storage.local.get([key], (result) => {
        const errorText = chrome.runtime.lastError?.message;
        if (errorText) {
          reject(new Error(errorText));
          return;
        }

        const value = result?.[key];
        resolve(value === undefined ? fallback : (value as T));
      });
    } catch (error) {
      reject(error);
    }
  });
}

export async function storageSet(entries: Record<string, unknown>): Promise<void> {
  const api = (globalThis as any).browser ?? (globalThis as any).chrome;
  if (!api?.storage?.local?.set) {
    throw new Error('storage.local.set API unavailable');
  }

  if ((globalThis as any).browser?.storage?.local?.set) {
    await api.storage.local.set(entries);
    return;
  }

  await new Promise<void>((resolve, reject) => {
    try {
      chrome.storage.local.set(entries, () => {
        const errorText = chrome.runtime.lastError?.message;
        if (errorText) {
          reject(new Error(errorText));
          return;
        }

        resolve();
      });
    } catch (error) {
      reject(error);
    }
  });
}
