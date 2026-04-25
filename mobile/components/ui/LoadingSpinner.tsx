import { View, ActivityIndicator, StyleSheet } from 'react-native'
import { Colors } from '@/constants'

interface Props {
  size?: 'small' | 'large'
  color?: string
}

export function LoadingSpinner({ size = 'large', color = Colors.primary }: Props) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size={size} color={color} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
})
