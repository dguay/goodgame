import { View, StyleSheet, Pressable, Linking } from 'react-native'
import { Text } from '@/components/ui/Text'
import { Colors, Spacing, FontSize } from '@/constants'

export function RawgFooter() {
  return (
    <View style={styles.container}>
      <Text variant="caption" style={styles.text}>Game data provided by </Text>
      <Pressable onPress={() => Linking.openURL('http://rawg.io/')}>
        <Text variant="caption" style={styles.link}>RAWG</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  text: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
  },
  link: {
    color: Colors.primaryLight,
    fontSize: FontSize.xs,
    textDecorationLine: 'underline',
  },
})
