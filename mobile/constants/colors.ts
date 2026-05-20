export const Colors = {
  // Page surfaces: Coinbase dark canvas
  background:      '#0a0b0d',              // page floor (surfaceDark)
  surface:         '#16181c',              // cards (surfaceDarkElev)
  surfaceRaised:   '#1e2228',              // elevated chips, badge plates

  // Borders: semi-transparent white (dark-surface safe)
  border:          'rgba(255,255,255,0.07)',
  borderSoft:      'rgba(255,255,255,0.04)',

  // Brand: Coinbase Blue used scarcely (primary CTAs only)
  primary:         '#1ca7f3',
  primaryActive:   '#0d78b8',
  primaryDisabled: '#8bbbd3',
  // primary:         '#0052ff',
  // primaryActive:   '#003ecc',             // press state
  // primaryDisabled: '#a8b8cc',             // disabled CTA

  // Text
  textPrimary:     '#ffffff',             // ink / onDark
  textSecondary:   '#a8acb3',             // body / onDarkSoft
  textMuted:       '#6b7178',             // labels, placeholders
  textMutedSoft:   '#454b53',             // disabled, chevrons

  // Semantic: text color only, never background fills
  success:         '#05b169',             // price up / playing
  error:           '#cf202f',             // price down / danger
  warning:         '#f4b000',             // amber / done rating
  rawg:            '#c49aff',                // RAWG rating
  personal:        '#9ae7ff',            // personal user's main color
}
