export const FontSize = {
  xs:   11,
  sm:   13,
  md:   16,
  lg:   19,
  xl:   23,
  xxl:  29,
  xxxl: 36,
}

// Loaded in app/_layout.tsx via expo-font
export const FontFamily = {
  display:  'Inter-Regular',       // weight 400, display headlines
  body:     'Inter-Regular',       // weight 400, body text
  medium:   'Inter-Medium',        // weight 500, nav, labels
  semibold: 'Inter-SemiBold',      // weight 600, buttons, titles
  bold:     'Inter-Bold',          // weight 700, emphasized body
  mono:     'JetBrainsMono-Medium',// weight 500, all numbers
}

// Keep app typography optically calm; labels are the only tracked text.
export const LetterSpacing = {
  display: 0,
  tight:   0,
  normal:  0,
  label:   0.6,   // small-caps labels
}
