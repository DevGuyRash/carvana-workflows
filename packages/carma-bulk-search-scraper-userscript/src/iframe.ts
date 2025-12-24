export function loadIntoIframe(iframe: HTMLIFrameElement, url: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    let done = false;

    const onLoad = () => {
      if (done) return;
      done = true;
      cleanup();
      resolve(true);
    };

    const onErr = () => {
      if (done) return;
      done = true;
      cleanup();
      reject(new Error('iframe failed to load'));
    };

    const cleanup = () => {
      iframe.removeEventListener('load', onLoad);
      iframe.removeEventListener('error', onErr);
    };

    iframe.addEventListener('load', onLoad);
    iframe.addEventListener('error', onErr);
    iframe.src = url;

    setTimeout(() => {
      if (done) return;
      done = true;
      cleanup();
      reject(new Error('iframe load timeout'));
    }, 30000);
  });
}
