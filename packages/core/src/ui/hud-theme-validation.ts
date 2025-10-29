/**
 * Validation banner design tokens for the HUD menu.
 *
 * Requirements alignment:
 * - 2.1: Validated state pulse animation, easing, drop shadow.
 * - 2.2: Needs re-validation warning animation, keyframes, icon reference.
 * - 2.3: Unknown state gradient flash, ARIA announcement tone, fallback color.
 *
 * Tokens remain declarative so the HUD renderer can consume them without mixing
 * workflow logic. Contrast ratios are documented to confirm WCAG 2.1 AA
 * compliance for each keyframe/background pairing.
 */

export type ValidationBannerState = 'validated' | 'needsRevalidated' | 'unknown';

export interface WCAGContrastToken {
  /** WCAG criterion satisfied by this color pairing. */
  criterion: 'AA';
  /** Text color hex used for evaluation. */
  textHex: string;
  /** Background color hex used for evaluation. */
  backgroundHex: string;
  /** Calculated contrast ratio (rounded to two decimals). */
  ratio: number;
  /** Optional notes to document context (e.g., animation stage). */
  notes?: string;
}

export interface ValidationBannerKeyframeToken {
  /** Normalized position within the animation timeline (0 to 1). */
  at: number;
  /** Background color or CSS variable expected at this keyframe. */
  background: string;
  /** Optional second color for gradient stops (unknown state flash). */
  secondaryBackground?: string;
  /** Text color applied at this point in the animation. */
  textColor: string;
  /** Contrast documentation for the keyframe. */
  contrast: WCAGContrastToken;
  /** Optional semantic description for implementers. */
  description?: string;
}

export interface ValidationBannerAnimationToken {
  /** Total animation duration in milliseconds. */
  durationMs: number;
  /** Timing function string applied to the animation. */
  easing: string;
  /** Number of iterations; `1` for run-once, `'infinite'` for repeating loops. */
  iterationCount: number | 'infinite';
  /** Keyframe timeline describing background/text transitions. */
  keyframes: ReadonlyArray<ValidationBannerKeyframeToken>;
  /**
   * Background color or gradient the banner should retain after the animation
   * completes. When omitted, consumers should fall back to the state base
   * background.
   */
  settlesInto?: string;
}

export interface ValidationBannerStateTokens {
  /** Programmatic identifier for the banner state. */
  state: ValidationBannerState;
  /** Human-readable description for tooling and logs. */
  label: string;
  /** Base background color once the animation settles. */
  baseBackground: string;
  /** Default text color while banner is in its resting state. */
  baseTextColor: string;
  /** Drop shadow token applied to the banner container. */
  dropShadow: string;
  /** Optional HUD icon identifier to render alongside text. */
  iconId?: string;
  /** Animation tokens controlling the visual transition. */
  animation: ValidationBannerAnimationToken;
  /** Default ARIA live region politeness + tone guidance. */
  aria: {
    politeness: 'polite' | 'assertive';
    tone: 'success' | 'warning' | 'critical';
  };
  /** WCAG documentation for the resting state. */
  wcag: WCAGContrastToken;
}

export interface ValidationBannerLayoutTokens {
  /** Maximum height the banner may consume relative to the viewport. */
  maxViewportHeightPct: number;
  /** Horizontal padding applied to the banner container. */
  horizontalPaddingPx: number;
  /** Vertical padding applied to the banner container. */
  verticalPaddingPx: number;
  /** Responsive typography range defining clamp min/max values. */
  fontSizeRangePx: { min: number; max: number };
  /** Corner radius to align with existing HUD surfaces. */
  borderRadiusPx: number;
}

export interface ValidationBannerTokenMap {
  states: {
    validated: ValidationBannerStateTokens;
    needsRevalidated: ValidationBannerStateTokens;
    unknown: ValidationBannerStateTokens;
  };
  layout: ValidationBannerLayoutTokens;
}

const VALIDATION_BANNER_TOKENS: Readonly<ValidationBannerTokenMap> = Object.freeze({
  states: {
    validated: {
      state: 'validated',
      label: 'Invoice validated',
      baseBackground: '#0f7a1f',
      baseTextColor: '#f5f7fb',
      dropShadow: '0 8px 24px rgba(5, 35, 12, 0.45)',
      animation: {
        durationMs: 1500,
        easing: 'cubic-bezier(0.45, 0, 0.55, 1)',
        iterationCount: 1,
        keyframes: [
          {
            at: 0,
            background: '#0f7a1f',
            textColor: '#f5f7fb',
            contrast: {
              criterion: 'AA',
              textHex: '#f5f7fb',
              backgroundHex: '#0f7a1f',
              ratio: 5.12,
              notes: 'Pulse origin and resting state'
            }
          },
          {
            at: 0.5,
            background: 'var(--cv-accent)',
            textColor: '#0b0c10',
            contrast: {
              criterion: 'AA',
              textHex: '#0b0c10',
              backgroundHex: '#ffbd59',
              ratio: 11.83,
              notes: 'Pulse peak using default HUD accent'
            }
          },
          {
            at: 1,
            background: '#0f7a1f',
            textColor: '#f5f7fb',
            contrast: {
              criterion: 'AA',
              textHex: '#f5f7fb',
              backgroundHex: '#0f7a1f',
              ratio: 5.12,
              notes: 'Settles to solid green'
            }
          }
        ],
        settlesInto: '#0f7a1f'
      },
      aria: {
        politeness: 'polite',
        tone: 'success'
      },
      wcag: {
        criterion: 'AA',
        textHex: '#f5f7fb',
        backgroundHex: '#0f7a1f',
        ratio: 5.12,
        notes: 'Resting banner contrast'
      }
    },
    needsRevalidated: {
      state: 'needsRevalidated',
      label: 'Invoice needs re-validation',
      baseBackground: '#c1121f',
      baseTextColor: '#f5f7fb',
      dropShadow: '0 12px 32px rgba(52, 5, 11, 0.55)',
      iconId: 'warning',
      animation: {
        durationMs: 3000,
        easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
        iterationCount: 1,
        keyframes: [
          {
            at: 0,
            background: '#ffbf00',
            textColor: '#0b0c10',
            contrast: {
              criterion: 'AA',
              textHex: '#0b0c10',
              backgroundHex: '#ffbf00',
              ratio: 11.83,
              notes: 'Warning yellow entry'
            }
          },
          {
            at: 0.4,
            background: '#f26a2c',
            textColor: '#0b0c10',
            contrast: {
              criterion: 'AA',
              textHex: '#0b0c10',
              backgroundHex: '#f26a2c',
              ratio: 6.40,
              notes: 'Mid-transition amber/orange'
            }
          },
          {
            at: 1,
            background: '#c1121f',
            textColor: '#f5f7fb',
            contrast: {
              criterion: 'AA',
              textHex: '#f5f7fb',
              backgroundHex: '#c1121f',
              ratio: 5.80,
              notes: 'Critical red resting color'
            }
          }
        ],
        settlesInto: '#c1121f'
      },
      aria: {
        politeness: 'assertive',
        tone: 'critical'
      },
      wcag: {
        criterion: 'AA',
        textHex: '#f5f7fb',
        backgroundHex: '#c1121f',
        ratio: 5.80,
        notes: 'Resting banner contrast'
      }
    },
    unknown: {
      state: 'unknown',
      label: 'Invoice status unknown',
      baseBackground: '#5a0b1a',
      baseTextColor: '#f5f7fb',
      dropShadow: '0 10px 28px rgba(11, 11, 13, 0.6)',
      animation: {
        durationMs: 2000,
        easing: 'linear',
        iterationCount: 1,
        keyframes: [
          {
            at: 0,
            background: '#6a0dad',
            secondaryBackground: '#0b0b0d',
            textColor: '#f5f7fb',
            contrast: {
              criterion: 'AA',
              textHex: '#f5f7fb',
              backgroundHex: '#6a0dad',
              ratio: 8.61,
              notes: 'Mystery gradient entry'
            },
            description: 'Flash gradient start'
          },
          {
            at: 1,
            background: '#0b0b0d',
            secondaryBackground: '#6a0dad',
            textColor: '#f5f7fb',
            contrast: {
              criterion: 'AA',
              textHex: '#f5f7fb',
              backgroundHex: '#0b0b0d',
              ratio: 18.33,
              notes: 'Gradient exit before fallback'
            },
            description: 'Flash gradient completion'
          }
        ],
        settlesInto: '#5a0b1a'
      },
      aria: {
        politeness: 'assertive',
        tone: 'warning'
      },
      wcag: {
        criterion: 'AA',
        textHex: '#f5f7fb',
        backgroundHex: '#5a0b1a',
        ratio: 13.07,
        notes: 'Fallback resting background'
      }
    }
  },
  layout: {
    maxViewportHeightPct: 15,
    horizontalPaddingPx: 16,
    verticalPaddingPx: 12,
    fontSizeRangePx: { min: 18, max: 24 },
    borderRadiusPx: 12
  }
} as const);

/**
 * Accessor for frozen validation banner tokens. Exported as a function to
 * discourage accidental mutation by consumers.
 */
export const getValidationBannerTokens = (): Readonly<ValidationBannerTokenMap> => VALIDATION_BANNER_TOKENS;

/** Re-export the readonly map for testing convenience. */
export const validationBannerTokens = VALIDATION_BANNER_TOKENS;
