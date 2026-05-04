export const FontSize = {
  xs:   11,
  sm:   13,
  md:   15,
  lg:   18,
  xl:   22,
  xxl:  28,
  xxxl: 36,
}

// Loaded in app/_layout.tsx via expo-font
export const FontFamily = {
  display:  'Inter-Regular',       // weight 400 — display headlines
  body:     'Inter-Regular',       // weight 400 — body text
  medium:   'Inter-Medium',        // weight 500 — nav, labels
  semibold: 'Inter-SemiBold',      // weight 600 — buttons, titles
  bold:     'Inter-Bold',          // weight 700 — emphasized body
  mono:     'JetBrainsMono-Medium',// weight 500 — all numbers
}

// Negative tracking on display text only; body stays at 0
export const LetterSpacing = {
  display: -1.5,
  tight:   -0.5,
  normal:  0,
  label:   0.6,   // small-caps labels
}
