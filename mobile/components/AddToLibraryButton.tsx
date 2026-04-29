import { Pressable, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Colors, Spacing } from '@/constants'
import type { RawgGame } from '@/types/rawg'

interface Props {
  game: Pick<RawgGame, 'id' | 'name' | 'background_image'>
}

// Stub — wired to library mutations in Phase 7
export function AddToLibraryButton({ game: _game }: Props) {
  return (
    <Pressable style={styles.button} hitSlop={8}>
      <Ionicons name="add-circle-outline" size={24} color={Colors.primary} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    padding: Spacing.xs,
    alignSelf: 'flex-start',
  },
})
