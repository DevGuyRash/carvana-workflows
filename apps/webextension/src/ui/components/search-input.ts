export interface SearchInputOptions {
  placeholder?: string;
  debounceMs?: number;
  onSearch?: (query: string) => void;
}

export function createSearchInput(options: SearchInputOptions = {}): HTMLDivElement {
  const { placeholder = 'Search...', debounceMs = 250, onSearch } = options;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const wrapper = document.createElement('div');
  Object.assign(wrapper.style, {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  });

  const icon = document.createElement('span');
  Object.assign(icon.style, {
    position: 'absolute',
    left: '10px',
    color: 'var(--cv-text-muted)',
    fontSize: '13px',
    pointerEvents: 'none',
    transition: 'color var(--cv-transition)',
  });
  icon.textContent = '🔍';
  wrapper.appendChild(icon);

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = placeholder;
  Object.assign(input.style, {
    width: '100%',
    paddingLeft: '32px',
    paddingRight: '32px',
    padding: '8px 32px',
    background: 'var(--cv-bg-glass)',
    border: '1px solid var(--cv-border)',
    borderRadius: 'var(--cv-radius-md)',
    color: 'var(--cv-text-primary)',
    fontSize: '13px',
    outline: 'none',
    transition: 'all var(--cv-transition)',
    backdropFilter: 'var(--cv-blur)',
  });
  input.addEventListener('focus', () => {
    input.style.borderColor = 'var(--cv-border-active)';
    input.style.boxShadow = '0 0 0 3px var(--cv-accent-glow)';
    icon.style.color = 'var(--cv-text-secondary)';
  });
  input.addEventListener('blur', () => {
    input.style.borderColor = 'var(--cv-border)';
    input.style.boxShadow = 'none';
    icon.style.color = 'var(--cv-text-muted)';
  });
  wrapper.appendChild(input);

  const clear = document.createElement('button');
  Object.assign(clear.style, {
    position: 'absolute',
    right: '8px',
    background: 'none',
    border: 'none',
    color: 'var(--cv-text-muted)',
    cursor: 'pointer',
    fontSize: '14px',
    padding: '0',
    display: 'none',
    transition: 'color var(--cv-transition)',
  });
  clear.textContent = '×';
  clear.addEventListener('mouseenter', () => { clear.style.color = 'var(--cv-text-primary)'; });
  clear.addEventListener('mouseleave', () => { clear.style.color = 'var(--cv-text-muted)'; });
  clear.addEventListener('click', () => {
    input.value = '';
    clear.style.display = 'none';
    onSearch?.('');
  });
  wrapper.appendChild(clear);

  input.addEventListener('input', () => {
    clear.style.display = input.value ? 'block' : 'none';
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => onSearch?.(input.value.trim()), debounceMs);
  });

  return wrapper;
}
