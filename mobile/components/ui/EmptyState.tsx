import { View, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Text } from './Text'
import { Button } from './Button'
import { Colors, Spacing } from '@/constants'

interface Props {
  icon: keyof typeof Ionicons.glyphMap
  heading: string
  subtext: string
  ctaLabel?: string
  onCta?: () => void
}

export function EmptyState({ icon, heading, subtext, ctaLabel, onCta }: Props) {
  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={64} color={Colors.textMuted} />
      <Text variant="heading" style={styles.heading}>{heading}</Text>
      <Text variant="caption" style={styles.subtext}>{subtext}</Text>
      {ctaLabel && onCta && (
        <Button variant="primary" onPress={onCta} style={styles.cta}>
          {ctaLabel}
        </Button>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  heading: {
    textAlign: 'center',
  },
  subtext: {
    textAlign: 'center',
  },
  cta: {
    marginTop: Spacing.sm,
  },
})
