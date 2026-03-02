export interface ToggleOptions {
  label?: string;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
}

export function createToggle(options: ToggleOptions = {}): HTMLLabelElement {
  const { label, checked = false, onChange } = options;
  const wrapper = document.createElement('label');
  Object.assign(wrapper.style, {
    display: 'inline-flex', alignItems: 'center', gap: '10px', cursor: 'pointer',
    userSelect: 'none', fontSize: '13px', color: 'var(--cv-text-secondary)',
    transition: 'color var(--cv-transition)',
  });

  const track = document.createElement('span');
  Object.assign(track.style, {
    position: 'relative', display: 'inline-block', width: '40px', height: '22px',
    borderRadius: '11px',
    background: checked ? 'var(--cv-accent-gradient)' : 'rgba(148, 163, 184, 0.15)',
    transition: 'all var(--cv-transition)', flexShrink: '0',
    boxShadow: checked ? '0 0 12px rgba(59, 130, 246, 0.3)' : 'none',
  });

  const thumb = document.createElement('span');
  Object.assign(thumb.style, {
    position: 'absolute', top: '2px', left: checked ? '20px' : '2px',
    width: '18px', height: '18px', borderRadius: '50%', background: '#fff',
    transition: 'all var(--cv-transition)',
    boxShadow: '0 1px 4px rgba(0,0,0,0.3), 0 0 1px rgba(0,0,0,0.2)',
  });
  track.appendChild(thumb);

  const input = document.createElement('input');
  input.type = 'checkbox'; input.checked = checked; input.style.display = 'none';
  input.addEventListener('change', () => {
    const on = input.checked;
    track.style.background = on ? 'var(--cv-accent-gradient)' : 'rgba(148, 163, 184, 0.15)';
    track.style.boxShadow = on ? '0 0 12px rgba(59, 130, 246, 0.3)' : 'none';
    thumb.style.left = on ? '20px' : '2px';
    onChange?.(on);
  });

  wrapper.appendChild(input);
  wrapper.appendChild(track);
  if (label) { const s = document.createElement('span'); s.textContent = label; wrapper.appendChild(s); }
  wrapper.addEventListener('mouseenter', () => { wrapper.style.color = 'var(--cv-text-primary)'; });
  wrapper.addEventListener('mouseleave', () => { wrapper.style.color = 'var(--cv-text-secondary)'; });
  return wrapper;
}
