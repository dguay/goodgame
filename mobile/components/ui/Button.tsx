import { Pressable, StyleSheet, ActivityIndicator, StyleProp, ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Text } from './Text'
import { Colors, Spacing, FontSize, FontFamily, Radius } from '@/constants'

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
      ? Colors.textPrimary
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
          style={styles.label}
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
    borderRadius: Radius.pill,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    height: 44,
    gap: Spacing.xxs,
  },
  primary: {
    backgroundColor: Colors.primary,
  },
  secondary: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
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
  label: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.semibold,
    letterSpacing: 0,
    textTransform: 'none',
  },
})
