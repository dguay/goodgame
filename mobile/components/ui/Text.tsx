import { Text as RNText, TextStyle, StyleProp } from 'react-native'
import { Colors, FontSize, FontFamily, LetterSpacing } from '@/constants'

type TextVariant = 'display' | 'heading' | 'subheading' | 'body' | 'caption' | 'label' | 'mono'

interface Props {
  variant?: TextVariant
  children: React.ReactNode
  color?: string
  style?: StyleProp<TextStyle>
  numberOfLines?: number
}

const variantStyles: Record<TextVariant, TextStyle> = {
  display: {
    fontFamily:    FontFamily.display,
    fontSize:      FontSize.xxxl,
    color:         Colors.textPrimary,
    lineHeight:    FontSize.xxxl * 1.2,
    letterSpacing: LetterSpacing.display,
  },
  heading: {
    fontFamily:    FontFamily.display,
    fontSize:      FontSize.xxl,
    color:         Colors.textPrimary,
    lineHeight:    FontSize.xxl * 1.2,
    letterSpacing: LetterSpacing.tight,
  },
  subheading: {
    fontFamily:    FontFamily.display,
    fontSize:      FontSize.xl,
    color:         Colors.textPrimary,
    lineHeight:    FontSize.xl * 1.11,
    letterSpacing: LetterSpacing.tight,
  },
  body: {
    fontFamily:    FontFamily.body,
    fontSize:      FontSize.md,
    color:         Colors.textPrimary,
    lineHeight:    FontSize.md * 1.5,
    letterSpacing: LetterSpacing.normal,
  },
  caption: {
    fontFamily:    FontFamily.body,
    fontSize:      FontSize.sm,
    color:         Colors.textSecondary,
    lineHeight:    FontSize.sm * 1.5,
    letterSpacing: LetterSpacing.normal,
  },
  label: {
    fontFamily:    FontFamily.medium,
    fontSize:      FontSize.xs,
    color:         Colors.textMuted,
    lineHeight:    FontSize.xs * 1.3,
    letterSpacing: LetterSpacing.label,
    textTransform: 'uppercase',
  },
  // Use for all numerical values; JetBrains Mono for tabular data
  mono: {
    fontFamily:    FontFamily.mono,
    fontSize:      FontSize.md,
    color:         Colors.textPrimary,
    lineHeight:    FontSize.md * 1.25,
    letterSpacing: LetterSpacing.normal,
  },
}

export function Text({ variant = 'body', children, color, style, numberOfLines }: Props) {
  return (
    <RNText
      style={[variantStyles[variant], color ? { color } : undefined, style]}
      numberOfLines={numberOfLines}
    >
      {children}
    </RNText>
  )
}
