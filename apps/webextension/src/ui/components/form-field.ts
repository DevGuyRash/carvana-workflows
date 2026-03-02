export interface FormFieldOptions {
  label: string;
  type?: 'text' | 'select' | 'textarea' | 'number';
  value?: string;
  placeholder?: string;
  options?: { value: string; label: string }[];
  error?: string;
  onChange?: (value: string) => void;
}

export function createFormField(options: FormFieldOptions): HTMLDivElement {
  const { label, type = 'text', value = '', placeholder = '', error, onChange } = options;

  const wrapper = document.createElement('div');
  Object.assign(wrapper.style, {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  });

  const labelEl = document.createElement('label');
  Object.assign(labelEl.style, {
    fontSize: '12px',
    fontWeight: '500',
    color: 'var(--cv-text-secondary)',
  });
  labelEl.textContent = label;
  wrapper.appendChild(labelEl);

  let inputEl: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

  if (type === 'select' && options.options) {
    const select = document.createElement('select');
    for (const opt of options.options) {
      const option = document.createElement('option');
      option.value = opt.value;
      option.textContent = opt.label;
      if (opt.value === value) option.selected = true;
      select.appendChild(option);
    }
    inputEl = select;
  } else if (type === 'textarea') {
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.placeholder = placeholder;
    textarea.rows = 3;
    inputEl = textarea;
  } else {
    const input = document.createElement('input');
    input.type = type;
    input.value = value;
    input.placeholder = placeholder;
    inputEl = input;
  }

  Object.assign(inputEl.style, {
    background: 'var(--cv-bg-secondary)',
    border: `1px solid ${error ? 'var(--cv-error)' : 'var(--cv-border)'}`,
    borderRadius: 'var(--cv-radius-sm)',
    color: 'var(--cv-text-primary)',
    padding: '8px 10px',
    fontSize: '13px',
    outline: 'none',
    transition: 'border-color var(--cv-transition)',
    width: '100%',
  });

  inputEl.addEventListener('focus', () => {
    inputEl.style.borderColor = error ? 'var(--cv-error)' : 'var(--cv-border-active)';
  });
  inputEl.addEventListener('blur', () => {
    inputEl.style.borderColor = error ? 'var(--cv-error)' : 'var(--cv-border)';
  });
  inputEl.addEventListener('input', () => {
    onChange?.(inputEl.value);
  });

  wrapper.appendChild(inputEl);

  if (error) {
    const errorEl = document.createElement('div');
    Object.assign(errorEl.style, {
      fontSize: '11px',
      color: 'var(--cv-error)',
    });
    errorEl.textContent = error;
    wrapper.appendChild(errorEl);
  }

  return wrapper;
}
