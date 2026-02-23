interface BrowserLike {
  runtime: {
    getURL(path: string): string;
  };
}

export function browserApi(): BrowserLike {
  const api = (globalThis as any).browser ?? (globalThis as any).chrome;
  if (!api) {
    throw new Error('WebExtension API unavailable');
  }

  return api as BrowserLike;
}
