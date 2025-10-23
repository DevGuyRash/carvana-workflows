/* global GM_setClipboard */
export function copy(text: string){
  GM_setClipboard(text, { type: 'text', mimetype: 'text/plain' });
}
