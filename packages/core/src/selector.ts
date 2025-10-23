import type { AttributeMatcher, SelectorSpec, TextMatcher } from './types';
import { asArray, isVisible, normalizeWhitespace, toRegExp } from './utils';

function matchesText(text: string, matcher: TextMatcher): boolean {
  const t = 'trim' in matcher && matcher.trim ? normalizeWhitespace(text) : text;
  if ('equals' in matcher) {
    return matcher.caseInsensitive ? t.toLowerCase() === matcher.equals.toLowerCase() : t === matcher.equals;
  }
  if ('includes' in matcher) {
    return matcher.caseInsensitive ? t.toLowerCase().includes(matcher.includes.toLowerCase()) : t.includes(matcher.includes);
  }
  if ('regex' in matcher) {
    const re = toRegExp(matcher); if (!re) return false; return re.test(t);
  }
  return false;
}

function matchesAttr(value: string|null, matcher: AttributeMatcher): boolean {
  if (value == null) return false;
  if (typeof matcher === 'string') return value === matcher;
  if (matcher.equals != null) return value === matcher.equals;
  if (matcher.includes != null) return value.includes(matcher.includes);
  if (matcher.regex != null) {
    const re = new RegExp(matcher.regex, matcher.flags);
    return re.test(value);
  }
  return false;
}

function candidateSet(root: Document|Element, spec: SelectorSpec): Element[] {
  // Prefer CSS selector or id to narrow candidates
  if (spec.selector) return Array.from(root.querySelectorAll(spec.selector));
  if (spec.id) {
    const el = (root instanceof Document ? root : root.ownerDocument!).getElementById(spec.id);
    return el ? [el] : [];
  }
  if (spec.tag) return Array.from(root.getElementsByTagName(spec.tag));
  if (spec.role) return Array.from(root.querySelectorAll(`[role="${spec.role}"]`));
  // Fallback: full scan (kept efficient via TreeWalker)
  const walker = (root instanceof Document ? root : root.ownerDocument!).createTreeWalker(
    root, NodeFilter.SHOW_ELEMENT, null
  );
  const els: Element[] = [];
  let n: Node|null;
  while ((n = walker.nextNode())) els.push(n as Element);
  return els;
}

function _matches(el: Element, spec: SelectorSpec): boolean {
  if (spec.selector && !el.matches(spec.selector)) return false;
  if (spec.id && (el as HTMLElement).id !== spec.id) return false;
  if (spec.tag && el.tagName.toLowerCase() !== spec.tag.toLowerCase()) return false;
  if (spec.type) {
    const t = (el as HTMLInputElement).type?.toLowerCase() || el.getAttribute('type')?.toLowerCase();
    if (t !== spec.type.toLowerCase()) return false;
  }
  if (spec.role) {
    const r = el.getAttribute('role');
    if (r !== spec.role) return false;
  }
  if (spec.attribute) {
    for (const [k, v] of Object.entries(spec.attribute)) {
      const val = el.getAttribute(k);
      if (!matchesAttr(val, v)) return false;
    }
  }
  if (spec.text) {
    const t = (el.textContent || '').trim();
    if (!matchesText(t, spec.text)) return false;
  }
  if (spec.visible && !isVisible(el)) return false;
  if (spec.within) {
    let p: Element|null = el.parentElement;
    let ok = false;
    while (p) {
      if (_matches(p, spec.within)) { ok = true; break; }
      p = p.parentElement;
    }
    if (!ok) return false;
  }
  if (spec.and) {
    for (const sub of spec.and) if (!_matches(el, sub)) return false;
  }
  if (spec.or) {
    let ok = false;
    for (const sub of spec.or) { if (_matches(el, sub)) { ok = true; break; } }
    if (!ok) return false;
  }
  if (spec.not) {
    if (_matches(el, spec.not)) return false;
  }
  return true;
}

export function findAll(spec: SelectorSpec, opts?: { root?: Document|Element; visibleOnly?: boolean }): Element[] {
  const root = opts?.root ?? document;
  const cands = candidateSet(root, spec);
  const out: Element[] = [];
  for (const el of cands) {
    if (_matches(el, spec) && (!opts?.visibleOnly || isVisible(el))) out.push(el);
  }
  return out;
}

export function findOne(spec: SelectorSpec, opts?: { root?: Document|Element; visibleOnly?: boolean }): Element | null {
  const all = findAll(spec, opts);
  if (all.length === 0) return null;
  if (spec.nth != null) return all[spec.nth] ?? null;
  return all[0];
}

export function highlight(elements: Element[], ms = 800){
  const doc = elements[0]?.ownerDocument || document;
  for (const el of elements) {
    const old = el.getAttribute('data-cv-highlight');
    if (old) continue;
    el.setAttribute('data-cv-highlight', '1');
    const prevOutline = (el as HTMLElement).style.outline;
    (el as HTMLElement).style.outline = '3px solid #2ecc71';
    setTimeout(() => {
      (el as HTMLElement).style.outline = prevOutline;
      el.removeAttribute('data-cv-highlight');
    }, ms);
  }
}
