import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native'
import { Colors, Spacing, Radius } from '@/constants'

interface Props {
  children: React.ReactNode
  elevated?: boolean
  style?: StyleProp<ViewStyle>
}

export function Card({ children, elevated, style }: Props) {
  return (
    <View style={[styles.card, elevated && styles.elevated, style]}>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  elevated: {
    backgroundColor: Colors.surfaceRaised,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 4,
  },
})
