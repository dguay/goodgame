import { Pressable, StyleSheet, ActivityIndicator, StyleProp, ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Text } from './Text'
import { Colors, Spacing, FontSize } from '@/constants'

interface Props {
  variant?: 'primary' | 'secondary' | 'ghost' | 'icon'
  onPress?: () => void
  children?: React.ReactNode
  disabled?: boolean
  loading?: boolean
  icon?: keyof typeof Ionicons.glyphMap
  style?: StyleProp<ViewStyle>
}

export function Button({ variant = 'primary', onPress, children, disabled, loading, icon, style }: Props) {
  const textColor =
    variant === 'primary'
      ? Colors.background
      : variant === 'secondary'
      ? Colors.primary
      : Colors.textPrimary

  return (
    <Pressable
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'ghost' && styles.ghost,
        variant === 'icon' && styles.iconButton,
        disabled && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : variant === 'icon' && icon ? (
        <Ionicons name={icon} size={22} color={Colors.textPrimary} />
      ) : (
        <Text
          variant="label"
          color={textColor}
          style={{ fontSize: FontSize.sm, fontFamily: 'DMSans-Medium' }}
        >
          {children}
        </Text>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    gap: Spacing.xs,
  },
  primary: {
    backgroundColor: Colors.primary,
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surfaceRaised,
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.75,
  },
})
