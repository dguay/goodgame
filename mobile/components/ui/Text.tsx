import { Text as RNText, TextStyle, StyleProp } from 'react-native'
import { Colors, FontSize } from '@/constants'

type TextVariant = 'display' | 'heading' | 'subheading' | 'body' | 'caption' | 'label'

interface Props {
  variant?: TextVariant
  children: React.ReactNode
  color?: string
  style?: StyleProp<TextStyle>
  numberOfLines?: number
}

const variantStyles: Record<TextVariant, TextStyle> = {
  display: {
    fontFamily: 'Syne-Bold',
    fontSize: FontSize.xxxl,
    color: Colors.textPrimary,
    lineHeight: FontSize.xxxl * 1.2,
  },
  heading: {
    fontFamily: 'Syne-Bold',
    fontSize: FontSize.xxl,
    color: Colors.textPrimary,
    lineHeight: FontSize.xxl * 1.2,
  },
  subheading: {
    fontFamily: 'Syne-Bold',
    fontSize: FontSize.xl,
    color: Colors.textPrimary,
    lineHeight: FontSize.xl * 1.3,
  },
  body: {
    fontFamily: 'DMSans-Regular',
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    lineHeight: FontSize.md * 1.5,
  },
  caption: {
    fontFamily: 'DMSans-Regular',
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: FontSize.sm * 1.5,
  },
  label: {
    fontFamily: 'DMSans-Medium',
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
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
