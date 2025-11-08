import { getValidationBannerTokens, type ValidationBannerState, type ValidationBannerTokenMap, type ValidationBannerStateTokens } from './hud-theme-validation';

export type ValidationBannerAnchor =
  | 'top-left'
  | 'top-right'
  | 'middle-left'
  | 'middle-right'
  | 'bottom-left'
  | 'bottom-right';

export type ValidationBannerSize = 'compact' | 'cozy' | 'roomy';

export interface ValidationBannerPayload {
  state: ValidationBannerState;
  /** Primary text rendered inside the banner. */
  message: string;
  /** Optional secondary line that provides short operator guidance. */
  detail?: string;
  /** Override for the dismiss button label (defaults to "Dismiss validation banner"). */
  dismissLabel?: string;
  /** Optional override for ARIA politeness when the default token is unsuitable. */
  ariaLiveMode?: 'polite' | 'assertive';
  /** Preferred fixed position on the viewport. Defaults to top-right. */
  anchor?: ValidationBannerAnchor;
  /** Preferred banner density preset. Defaults to compact. */
  size?: ValidationBannerSize;
}

const HOST_ID = 'cv-menu-host';
const BANNER_ROOT_ID = 'cv-validation-banner-root';
const BANNER_STYLE_ID = 'cv-validation-banner-style';
const BANNER_ELEMENT_ID = 'cv-validation-banner';
const LIVE_REGION_ID = 'cv-validation-banner-live';

let currentTokens: Readonly<ValidationBannerTokenMap> = getValidationBannerTokens();
let currentPayload: ValidationBannerPayload | null = null;
let cachedHost: HTMLElement | null = null;
let bannerRoot: HTMLDivElement | null = null;
let bannerEl: HTMLDivElement | null = null;
let messageEl: HTMLParagraphElement | null = null;
let detailEl: HTMLParagraphElement | null = null;
let iconEl: HTMLSpanElement | null = null;
let dismissBtn: HTMLButtonElement | null = null;
let liveRegionEl: HTMLDivElement | null = null;
let styleEl: HTMLStyleElement | null = null;

const DEFAULT_ANCHOR: ValidationBannerAnchor = 'top-right';
const DEFAULT_SIZE: ValidationBannerSize = 'compact';

const resolveAnchor = (anchor?: ValidationBannerAnchor): ValidationBannerAnchor => {
  switch (anchor) {
    case 'top-left':
    case 'top-right':
    case 'middle-left':
    case 'middle-right':
    case 'bottom-left':
    case 'bottom-right':
      return anchor;
    default:
      return DEFAULT_ANCHOR;
  }
};

const resolveSize = (size?: ValidationBannerSize): ValidationBannerSize => {
  switch (size) {
    case 'compact':
    case 'cozy':
    case 'roomy':
      return size;
    default:
      return DEFAULT_SIZE;
  }
};

const reduceMotionQuery = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
  ? window.matchMedia('(prefers-reduced-motion: reduce)')
  : null;

export const syncValidationBannerTheme = (tokens?: ValidationBannerTokenMap): boolean => {
  currentTokens = tokens ?? getValidationBannerTokens();
  const shadow = ensureShadowRoot();
  if (!shadow) return false;
  renderStyle(shadow);
  if (currentPayload) {
    applyPayload(currentPayload);
  }
  return true;
};

export const showValidationBanner = (payload: ValidationBannerPayload): boolean => {
  const anchor = resolveAnchor(payload.anchor ?? currentPayload?.anchor);
  const size = resolveSize(payload.size ?? currentPayload?.size);
  currentPayload = { ...payload, anchor, size };
  const shadow = ensureShadowRoot();
  if (!shadow) return false;
  renderStyle(shadow);
  ensureStructure(shadow);
  if (!bannerEl || !messageEl || !liveRegionEl || !currentPayload) return false;
  applyPayload(currentPayload);
  return true;
};

export const clearValidationBanner = (): boolean => {
  currentPayload = null;
  if (!bannerRoot || !bannerEl) return false;
  bannerRoot.setAttribute('hidden', 'true');
  bannerEl.classList.remove('is-active');
  bannerEl.style.removeProperty('animation');
  bannerEl.style.removeProperty('--cv-validation-iteration');
  bannerEl.style.removeProperty('--cv-validation-duration');
  bannerEl.style.removeProperty('--cv-validation-easing');
  if (liveRegionEl) {
    liveRegionEl.textContent = '';
  }
  return true;
};

export const isValidationBannerVisible = (): boolean => {
  if (!bannerRoot || !bannerEl) return false;
  if (bannerRoot.hasAttribute('hidden')) return false;
  return bannerEl.classList.contains('is-active');
};

const ensureShadowRoot = (): ShadowRoot | null => {
  const host = document.getElementById(HOST_ID) as HTMLElement | null;
  if (!host || !host.shadowRoot) {
    cachedHost = null;
    bannerRoot = null;
    bannerEl = null;
    styleEl = null;
    return null;
  }
  if (cachedHost !== host) {
    cachedHost = host;
    bannerRoot = null;
    bannerEl = null;
    messageEl = null;
    detailEl = null;
    iconEl = null;
    dismissBtn = null;
    liveRegionEl = null;
    styleEl = null;
  }
  return host.shadowRoot;
};

const renderStyle = (shadow: ShadowRoot): void => {
  if (!styleEl) {
    styleEl = shadow.getElementById(BANNER_STYLE_ID) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = BANNER_STYLE_ID;
      shadow.appendChild(styleEl);
    }
  }
  if (!styleEl) return;
  styleEl.textContent = buildStyleSheet(currentTokens);
};

const ensureStructure = (shadow: ShadowRoot): void => {
  if (!bannerRoot) {
    bannerRoot = shadow.getElementById(BANNER_ROOT_ID) as HTMLDivElement | null;
    if (!bannerRoot) {
      bannerRoot = document.createElement('div');
      bannerRoot.id = BANNER_ROOT_ID;
      bannerRoot.setAttribute('hidden', 'true');
      bannerRoot.dataset.anchor = resolveAnchor(currentPayload?.anchor);
      bannerRoot.dataset.size = resolveSize(currentPayload?.size);
      shadow.appendChild(bannerRoot);
    }
  }
  if (!bannerRoot) return;
  if (!bannerEl) {
    bannerEl = bannerRoot.querySelector(`#${BANNER_ELEMENT_ID}`) as HTMLDivElement | null;
    if (!bannerEl) {
      bannerEl = document.createElement('div');
      bannerEl.id = BANNER_ELEMENT_ID;
      bannerEl.className = 'cv-validation-banner';
      bannerEl.setAttribute('role', 'status');
      bannerEl.setAttribute('aria-atomic', 'true');

      iconEl = document.createElement('span');
      iconEl.className = 'cv-validation-icon';
      iconEl.setAttribute('aria-hidden', 'true');

      const body = document.createElement('div');
      body.className = 'cv-validation-body';

      messageEl = document.createElement('p');
      messageEl.className = 'cv-validation-message';

      detailEl = document.createElement('p');
      detailEl.className = 'cv-validation-detail';

      body.appendChild(messageEl);
      body.appendChild(detailEl);

      dismissBtn = document.createElement('button');
      dismissBtn.type = 'button';
      dismissBtn.className = 'cv-validation-dismiss';
      dismissBtn.addEventListener('click', () => {
        clearValidationBanner();
      });

      liveRegionEl = document.createElement('div');
      liveRegionEl.id = LIVE_REGION_ID;
      liveRegionEl.className = 'cv-validation-sr-only';
      liveRegionEl.setAttribute('aria-atomic', 'true');

      bannerEl.appendChild(iconEl);
      bannerEl.appendChild(body);
      bannerEl.appendChild(dismissBtn);
      bannerRoot.appendChild(bannerEl);
      bannerRoot.appendChild(liveRegionEl);
    }
  }

  if (!iconEl) iconEl = bannerEl?.querySelector('.cv-validation-icon') as HTMLSpanElement | null;
  if (!messageEl) messageEl = bannerEl?.querySelector('.cv-validation-message') as HTMLParagraphElement | null;
  if (!detailEl) detailEl = bannerEl?.querySelector('.cv-validation-detail') as HTMLParagraphElement | null;
  if (!dismissBtn) dismissBtn = bannerEl?.querySelector('.cv-validation-dismiss') as HTMLButtonElement | null;
  if (!liveRegionEl) liveRegionEl = bannerRoot?.querySelector(`#${LIVE_REGION_ID}`) as HTMLDivElement | null;
};

const applyPayload = (payload: ValidationBannerPayload): void => {
  if (!bannerRoot || !bannerEl || !messageEl || !dismissBtn || !liveRegionEl) return;
  const anchor = resolveAnchor(payload.anchor ?? currentPayload?.anchor);
  const size = resolveSize(payload.size ?? currentPayload?.size);
  bannerRoot.dataset.anchor = anchor;
  bannerRoot.dataset.size = size;
  const tokens = currentTokens.states[payload.state];
  if (!tokens) return;

  bannerRoot.removeAttribute('hidden');
  const politeness = payload.ariaLiveMode ?? tokens.aria.politeness;
  bannerEl.dataset.state = tokens.state;
  bannerEl.dataset.tone = tokens.aria.tone;
  messageEl.textContent = payload.message;
  bannerEl.setAttribute('aria-live', politeness);
  bannerEl.setAttribute('role', politeness === 'assertive' ? 'alert' : 'status');

  if (detailEl) {
    if (payload.detail) {
      detailEl.hidden = false;
      detailEl.textContent = payload.detail;
    } else {
      detailEl.hidden = true;
      detailEl.textContent = '';
    }
  }

  if (iconEl) {
    const iconId = tokens.iconId ?? '';
    if (iconId) {
      iconEl.textContent = resolveIconGlyph(iconId);
      iconEl.dataset.iconId = iconId;
      iconEl.hidden = false;
    } else {
      iconEl.textContent = '';
      delete iconEl.dataset.iconId;
      iconEl.hidden = true;
    }
  }

  dismissBtn.textContent = payload.dismissLabel ?? 'Dismiss';
  dismissBtn.setAttribute('aria-label', payload.dismissLabel ?? 'Dismiss validation banner');

  applyVisualState(tokens);

  const livePrefix = tokens.aria.tone === 'success'
    ? 'Success'
    : tokens.aria.tone === 'critical'
      ? 'Critical'
      : 'Warning';
  liveRegionEl.setAttribute('aria-live', politeness);
  liveRegionEl.textContent = `${livePrefix}: ${payload.message}`;
};

const applyVisualState = (tokens: ValidationBannerStateTokens): void => {
  if (!bannerEl) return;
  bannerEl.classList.add('is-active');
  bannerEl.style.setProperty('--cv-validation-bg-base', tokens.baseBackground);
  bannerEl.style.setProperty('--cv-validation-text-base', tokens.baseTextColor);
  bannerEl.style.setProperty('--cv-validation-shadow', tokens.dropShadow);

  const animationName = animationKeyframeName(tokens.state);
  const reduceMotion = reduceMotionQuery?.matches ?? false;

  if (reduceMotion || !tokens.animation.keyframes.length) {
    bannerEl.style.removeProperty('animation');
    setRestingVisual(tokens);
    return;
  }

  bannerEl.style.setProperty('--cv-validation-iteration', String(tokens.animation.iterationCount));
  bannerEl.style.setProperty('--cv-validation-duration', `${tokens.animation.durationMs}ms`);
  bannerEl.style.setProperty('--cv-validation-easing', tokens.animation.easing);

  bannerEl.style.animation = 'none';
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  void bannerEl.offsetWidth;
  bannerEl.style.animation = `${animationName} ${tokens.animation.durationMs}ms ${tokens.animation.easing} ${tokens.animation.iterationCount}`;
  bannerEl.style.animationFillMode = 'forwards';

  const finalize = () => {
    bannerEl?.removeEventListener('animationend', finalize);
    setRestingVisual(tokens);
    bannerEl?.style.removeProperty('animation');
  };
  bannerEl.addEventListener('animationend', finalize);
};

const setRestingVisual = (tokens: ValidationBannerStateTokens): void => {
  if (!bannerEl) return;
  const background = tokens.animation.settlesInto ?? tokens.baseBackground;
  bannerEl.style.background = background;
  bannerEl.style.color = tokens.baseTextColor;
  bannerEl.style.boxShadow = tokens.dropShadow;
};

const resolveIconGlyph = (iconId: string): string => {
  switch (iconId) {
    case 'warning':
      return '\u26A0';
    case 'info':
      return '\u2139';
    case 'success':
      return '\u2714';
    default:
      return iconId;
  }
};

const animationKeyframeName = (state: ValidationBannerState): string => `cv-validation-${state}-animation`;

const buildStyleSheet = (tokens: ValidationBannerTokenMap): string => {
  const keyframes = Object.values(tokens.states)
    .map(state => buildKeyframes(state))
    .join('\n\n');

  return `:host{position:relative;}
#${BANNER_ROOT_ID}{
  position:fixed;
  top:16px;
  right:16px;
  z-index:2147483647;
  display:inline-flex;
  flex-direction:column;
  align-items:flex-end;
  gap:12px;
  inline-size:max-content;
  max-inline-size:min(420px, calc(100vw - 32px));
  pointer-events:none;
  transform:translateY(0);
  --cv-validation-padding-y: 10px;
  --cv-validation-padding-x: 14px;
  --cv-validation-font-min: 16px;
  --cv-validation-font-max: 20px;
  --cv-validation-max-inline: min(360px, calc(100vw - 40px));
  --cv-validation-gap: 10px;
}
#${BANNER_ROOT_ID}[hidden]{display:none;}
#${BANNER_ROOT_ID}[data-anchor$="left"]{
  left:16px;
  right:auto;
  align-items:flex-start;
}
#${BANNER_ROOT_ID}[data-anchor$="right"]{
  right:16px;
  left:auto;
  align-items:flex-end;
}
#${BANNER_ROOT_ID}[data-anchor^="top"]{
  top:16px;
  bottom:auto;
  transform:translateY(0);
}
#${BANNER_ROOT_ID}[data-anchor^="bottom"]{
  bottom:16px;
  top:auto;
  transform:translateY(0);
}
#${BANNER_ROOT_ID}[data-anchor^="middle"]{
  top:50%;
  bottom:auto;
  transform:translateY(-50%);
}
#${BANNER_ROOT_ID}[data-size="cozy"]{
  --cv-validation-padding-y: ${tokens.layout.verticalPaddingPx}px;
  --cv-validation-padding-x: ${tokens.layout.horizontalPaddingPx}px;
  --cv-validation-font-min: ${tokens.layout.fontSizeRangePx.min}px;
  --cv-validation-font-max: ${tokens.layout.fontSizeRangePx.max}px;
  --cv-validation-max-inline: min(420px, calc(100vw - 40px));
  --cv-validation-gap: 12px;
}
#${BANNER_ROOT_ID}[data-size="roomy"]{
  --cv-validation-padding-y: ${tokens.layout.verticalPaddingPx + 4}px;
  --cv-validation-padding-x: ${tokens.layout.horizontalPaddingPx + 6}px;
  --cv-validation-font-min: ${tokens.layout.fontSizeRangePx.min + 2}px;
  --cv-validation-font-max: ${tokens.layout.fontSizeRangePx.max + 4}px;
  --cv-validation-max-inline: min(460px, calc(100vw - 32px));
  --cv-validation-gap: 14px;
}
.cv-validation-banner{
  pointer-events:auto;
  display:flex;
  align-items:center;
  gap:var(--cv-validation-gap);
  padding:var(--cv-validation-padding-y) var(--cv-validation-padding-x);
  border-radius:${tokens.layout.borderRadiusPx}px;
  font-family:ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Ubuntu, Cantarell, 'Helvetica Neue', Arial, sans-serif;
  font-weight:600;
  line-height:1.2;
  letter-spacing:0.2px;
  font-size:clamp(var(--cv-validation-font-min), 2.2vw, var(--cv-validation-font-max));
  max-height:${tokens.layout.maxViewportHeightPct}vh;
  max-inline-size:var(--cv-validation-max-inline);
  inline-size:max-content;
  color:var(--cv-validation-text-base, ${tokens.states.validated.baseTextColor});
  background:var(--cv-validation-bg-base, ${tokens.states.validated.baseBackground});
  box-shadow:var(--cv-validation-shadow, ${tokens.states.validated.dropShadow});
  transition:background 160ms ease-out, color 160ms ease-out, box-shadow 160ms ease-out;
  position:relative;
}
.cv-validation-banner.is-active{opacity:1;}
.cv-validation-banner .cv-validation-body{display:flex; flex-direction:column; gap:6px;}
.cv-validation-message{margin:0;}
.cv-validation-detail{margin:0; font-size:0.78em; font-weight:400; opacity:0.85;}
.cv-validation-detail[hidden]{display:none;}
.cv-validation-icon{font-size:1.25em; line-height:1;}
.cv-validation-icon{font-size:1.25em; line-height:1; min-width:1.25em; text-align:center;}
.cv-validation-icon[hidden]{display:none;}
.cv-validation-dismiss{
  background:rgba(0,0,0,0.28);
  color:inherit;
  border:1px solid rgba(255,255,255,0.3);
  border-radius:999px;
  padding:6px 12px;
  font-size:0.7em;
  font-weight:500;
  cursor:pointer;
}
.cv-validation-dismiss:hover{background:rgba(0,0,0,0.4);}
.cv-validation-dismiss:focus-visible{outline:2px solid var(--cv-focus-outline, #ffbd59); outline-offset:2px;}
.cv-validation-sr-only{position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); border:0;}
@media (prefers-reduced-motion: reduce){
  .cv-validation-banner{transition-duration:0ms !important; animation-duration:1ms !important;}
}
${keyframes}`;
};

const buildKeyframes = (tokens: ValidationBannerStateTokens): string => {
  const name = animationKeyframeName(tokens.state);
  if (!tokens.animation.keyframes.length) return `@keyframes ${name}{}`;
  const frames = tokens.animation.keyframes
    .map(frame => {
      const pct = Math.round(frame.at * 100);
      const background = frame.secondaryBackground
        ? `linear-gradient(135deg, ${frame.background}, ${frame.secondaryBackground})`
        : frame.background;
      return `${pct}% { background: ${background}; color: ${frame.textColor}; }`;
    })
    .join('\n');
  return `@keyframes ${name}{\n${frames}\n}`;
};
