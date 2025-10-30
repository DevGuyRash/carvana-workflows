import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearValidationBanner,
  isValidationBannerVisible,
  showValidationBanner,
  type ValidationBannerPayload
} from './hud-validation-banner';
import { getValidationBannerTokens, type ValidationBannerState } from './hud-theme-validation';

const HOST_ID = 'cv-menu-host';

const createHost = () => {
  const host = document.createElement('div');
  host.id = HOST_ID;
  const shadow = host.attachShadow({ mode: 'open' });
  document.body.appendChild(host);
  return { host, shadow };
};

const getShadowRoot = () => {
  const host = document.getElementById(HOST_ID);
  if (!host || !host.shadowRoot) {
    throw new Error('HUD host shadow root is not mounted.');
  }
  return host.shadowRoot;
};

const mountBanner = (payload: ValidationBannerPayload) => {
  const success = showValidationBanner(payload);
  expect(success).toBe(true);
  const shadow = getShadowRoot();
  const root = shadow.getElementById('cv-validation-banner-root') as HTMLDivElement | null;
  const banner = shadow.getElementById('cv-validation-banner') as HTMLDivElement | null;
  const message = shadow.querySelector('.cv-validation-message') as HTMLParagraphElement | null;
  const detail = shadow.querySelector('.cv-validation-detail') as HTMLParagraphElement | null;
  const icon = shadow.querySelector('.cv-validation-icon') as HTMLSpanElement | null;
  const dismiss = shadow.querySelector('.cv-validation-dismiss') as HTMLButtonElement | null;
  const live = shadow.getElementById('cv-validation-banner-live') as HTMLDivElement | null;

  if (!root || !banner || !message || !detail || !icon || !dismiss || !live) {
    throw new Error('Validation banner structure is incomplete.');
  }

  return { root, banner, message, detail, icon, dismiss, live };
};

const normalizeColor = (color: string): string => {
  if (!color.startsWith('#')) return color;
  const hex = color.slice(1);
  const parse = (component: string) => parseInt(component, 16);
  const [r, g, b] = [parse(hex.slice(0, 2)), parse(hex.slice(2, 4)), parse(hex.slice(4, 6))];
  return `rgb(${r}, ${g}, ${b})`;
};

describe('hud-validation-banner', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    createHost();
  });

  afterEach(() => {
    clearValidationBanner();
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  it.each([
    ['validated', 'Success'] as const,
    ['needsRevalidated', 'Critical'] as const,
    ['unknown', 'Warning'] as const
  ])('renders %s state with expected tokens and ARIA output', (state, livePrefix) => {
    const tokens = getValidationBannerTokens().states[state];
    const payloadDetail = state === 'needsRevalidated' ? 'Re-run invoice validation' : undefined;
    const payload: ValidationBannerPayload = {
      state: state as ValidationBannerState,
      message: `${tokens.label}!`,
      detail: payloadDetail
    };

    const { root, banner, message, detail, icon, dismiss, live } = mountBanner(payload);

    expect(root.hasAttribute('hidden')).toBe(false);
    expect(root.dataset.anchor).toBe('right');
    expect(banner.dataset.state).toBe(tokens.state);
    expect(banner.dataset.tone).toBe(tokens.aria.tone);
    expect(banner.classList.contains('is-active')).toBe(true);
    expect(message.textContent).toBe(payload.message);

    if (payloadDetail) {
      expect(detail.hidden).toBe(false);
      expect(detail.textContent).toBe(payloadDetail);
    } else {
      expect(detail.hidden).toBe(true);
      expect(detail.textContent).toBe('');
    }

    if (tokens.iconId) {
      expect(icon.hidden).toBe(false);
      expect(icon.dataset.iconId).toBe(tokens.iconId);
      expect(icon.textContent).not.toBe('');
    } else {
      expect(icon.hidden).toBe(true);
      expect(icon.dataset.iconId).toBeUndefined();
    }

    expect(dismiss.textContent).toBe('Dismiss');
    expect(dismiss.getAttribute('aria-label')).toBe('Dismiss validation banner');

    expect(banner.style.getPropertyValue('--cv-validation-bg-base')).toBe(tokens.baseBackground);
    expect(banner.style.getPropertyValue('--cv-validation-text-base')).toBe(tokens.baseTextColor);
    expect(banner.style.getPropertyValue('--cv-validation-shadow')).toBe(tokens.dropShadow);
    expect(banner.style.animation).toContain(`cv-validation-${tokens.state}-animation`);
    expect(banner.style.animation).toContain(`${tokens.animation.durationMs}ms`);

    expect(live.getAttribute('aria-live')).toBe(payload.ariaLiveMode ?? tokens.aria.politeness);
    expect(live.textContent).toBe(`${livePrefix}: ${payload.message}`);
    expect(isValidationBannerVisible()).toBe(true);
  });

  it('removes animation styling after animationend and applies resting visuals', () => {
    const tokens = getValidationBannerTokens().states.unknown;
    const { banner } = mountBanner({
      state: 'unknown',
      message: tokens.label
    });

    expect(banner.style.animation).toContain('cv-validation-unknown-animation');

    setTimeout(() => {
      banner.dispatchEvent(new Event('animationend'));
    }, 0);

    vi.runAllTimers();

    expect(banner.style.animation).toBe('');
    const expectedBackground = normalizeColor(tokens.animation.settlesInto ?? tokens.baseBackground);
    expect(banner.style.background).toBe(expectedBackground);
    expect(banner.style.boxShadow).toBe(tokens.dropShadow);
  });

  it('clears banner nodes and aria output when dismissed', () => {
    const tokens = getValidationBannerTokens().states.validated;
    const { root, banner, live } = mountBanner({
      state: 'validated',
      message: tokens.label
    });

    expect(clearValidationBanner()).toBe(true);
    expect(root.getAttribute('hidden')).toBe('true');
    expect(banner.classList.contains('is-active')).toBe(false);
    expect(banner.style.animation).toBe('');
    expect(banner.style.getPropertyValue('--cv-validation-iteration')).toBe('');
    expect(banner.style.getPropertyValue('--cv-validation-duration')).toBe('');
    expect(banner.style.getPropertyValue('--cv-validation-easing')).toBe('');
    expect(live.textContent).toBe('');
  });

  it('applies left anchor positioning when requested', () => {
    const tokens = getValidationBannerTokens().states.needsRevalidated;
    const { root, banner } = mountBanner({
      state: 'needsRevalidated',
      message: tokens.label,
      anchor: 'left'
    });

    expect(root.dataset.anchor).toBe('left');
    expect(isValidationBannerVisible()).toBe(true);
    expect(banner.classList.contains('is-active')).toBe(true);
  });
});
