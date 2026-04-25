import { StyleSheet, StyleProp, ViewStyle } from 'react-native'
import { SafeAreaView, Edge } from 'react-native-safe-area-context'
import { Colors } from '@/constants'

interface Props {
  children: React.ReactNode
  edges?: Edge[]
  style?: StyleProp<ViewStyle>
}

export function SafeAreaWrapper({ children, edges = ['top', 'left', 'right'], style }: Props) {
  return (
    <SafeAreaView style={[styles.container, style]} edges={edges}>
      {children}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
})
