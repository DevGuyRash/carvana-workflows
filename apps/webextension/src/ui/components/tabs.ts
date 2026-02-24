export interface TabDef { id: string; label: string; icon?: string; render: () => HTMLElement; }
export interface TabsOptions { tabs: TabDef[]; activeId?: string; onChange?: (tabId: string) => void; }

export function createTabs(options: TabsOptions): HTMLDivElement {
  const { tabs, activeId, onChange } = options;
  let currentId = activeId ?? tabs[0]?.id ?? '';
  const rendered: Record<string, HTMLElement> = {};

  const root = document.createElement('div');
  Object.assign(root.style, { display: 'flex', flexDirection: 'column', height: '100%' });

  const bar = document.createElement('nav');
  Object.assign(bar.style, {
    display: 'flex', gap: '0', borderBottom: '1px solid var(--cv-border)',
    background: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'var(--cv-blur)',
    flexShrink: '0', overflowX: 'auto', padding: '0 8px',
  });
  bar.setAttribute('role', 'tablist');

  const content = document.createElement('div');
  Object.assign(content.style, { flex: '1', overflow: 'auto', position: 'relative' });

  const buttons: Record<string, HTMLButtonElement> = {};

  function activateTab(id: string) {
    if (id === currentId && rendered[id]) return;
    currentId = id;
    for (const [btnId, btn] of Object.entries(buttons)) {
      const active = btnId === id;
      btn.style.color = active ? 'var(--cv-text-primary)' : 'var(--cv-text-muted)';
      btn.style.borderBottomColor = active ? 'var(--cv-accent)' : 'transparent';
      btn.style.background = active ? 'rgba(59, 130, 246, 0.06)' : 'transparent';
      btn.style.boxShadow = active ? '0 1px 0 0 var(--cv-accent)' : 'none';
      btn.setAttribute('aria-selected', String(active));
    }
    content.innerHTML = '';
    if (!rendered[id]) { const t = tabs.find(t => t.id === id); if (t) rendered[id] = t.render(); }
    if (rendered[id]) content.appendChild(rendered[id]);
    onChange?.(id);
  }

  for (const tab of tabs) {
    const btn = document.createElement('button');
    Object.assign(btn.style, {
      display: 'flex', alignItems: 'center', gap: '7px', padding: '12px 18px',
      fontSize: '13px', fontWeight: '500', color: 'var(--cv-text-muted)',
      background: 'transparent', border: 'none', borderBottom: '2px solid transparent',
      cursor: 'pointer', transition: 'all var(--cv-transition)', whiteSpace: 'nowrap',
      letterSpacing: '0.01em', position: 'relative',
    });
    btn.setAttribute('role', 'tab'); btn.setAttribute('aria-selected', 'false');
    if (tab.icon) { const i = document.createElement('span'); i.textContent = tab.icon; i.style.fontSize = '14px'; btn.appendChild(i); }
    const l = document.createElement('span'); l.textContent = tab.label; btn.appendChild(l);
    btn.addEventListener('click', () => activateTab(tab.id));
    btn.addEventListener('mouseenter', () => { if (currentId !== tab.id) { btn.style.color = 'var(--cv-text-secondary)'; btn.style.background = 'rgba(148, 163, 184, 0.04)'; } });
    btn.addEventListener('mouseleave', () => { if (currentId !== tab.id) { btn.style.color = 'var(--cv-text-muted)'; btn.style.background = 'transparent'; } });
    buttons[tab.id] = btn; bar.appendChild(btn);
  }
  root.appendChild(bar); root.appendChild(content);
  activateTab(currentId);
  return root;
}
