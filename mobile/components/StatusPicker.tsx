import { Modal, View, Pressable, StyleSheet, Platform } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Text } from '@/components/ui/Text'
import { Colors, Spacing, Radius } from '@/constants'
import { STATUS_LABELS, STATUS_COLORS, type LibraryStatus } from '@/types'

const STATUSES: LibraryStatus[] = ['want_to_play', 'playing', 'done', 'did_not_finish']

const STATUS_ICONS: Record<LibraryStatus, keyof typeof Ionicons.glyphMap> = {
  want_to_play: 'bookmark-outline',
  playing: 'game-controller-outline',
  done: 'checkmark-circle-outline',
  did_not_finish: 'close-circle-outline',
}

interface Props {
  visible: boolean
  currentStatus: LibraryStatus | null
  onSelect: (status: LibraryStatus) => void
  onRemove: () => void
  onDismiss: () => void
}

export function StatusPicker({ visible, currentStatus, onSelect, onRemove, onDismiss }: Props) {
  const isWeb = Platform.OS === 'web'

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <View style={[styles.overlay, isWeb ? styles.overlayCenter : styles.overlayBottom]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
        <View
          style={isWeb ? styles.card : styles.sheet}
          onStartShouldSetResponder={(_e) => true}
        >
          {!isWeb && <View style={styles.handle} />}
          <Text variant="subheading" style={styles.title}>
            {currentStatus != null ? 'Update Status' : 'Add to Library'}
          </Text>
          {STATUSES.map(status => (
            <Pressable
              key={status}
              style={({ pressed }) => [
                styles.row,
                currentStatus === status && styles.rowSelected,
                pressed && styles.rowPressed,
              ]}
              onPress={() => onSelect(status)}
            >
              <Ionicons
                name={STATUS_ICONS[status]}
                size={22}
                color={currentStatus === status ? STATUS_COLORS[status] : Colors.textSecondary}
              />
              <Text
                variant="body"
                style={[
                  styles.rowLabel,
                  currentStatus === status && { color: STATUS_COLORS[status] },
                ]}
              >
                {STATUS_LABELS[status]}
              </Text>
              {currentStatus === status && (
                <Ionicons name="checkmark" size={18} color={STATUS_COLORS[status]} />
              )}
            </Pressable>
          ))}
          {currentStatus != null && (
            <>
              <View style={styles.divider} />
              <Pressable
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                onPress={onRemove}
              >
                <Ionicons name="trash-outline" size={22} color={Colors.error} />
                <Text variant="body" style={[styles.rowLabel, styles.removeText]}>
                  Remove from Library
                </Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  overlayBottom: {
    justifyContent: 'flex-end',
  },
  overlayCenter: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingBottom: Spacing.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: Colors.border,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    width: 360,
    paddingBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  title: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  rowSelected: {
    backgroundColor: Colors.surfaceRaised,
  },
  rowPressed: {
    backgroundColor: Colors.surfaceRaised,
  },
  rowLabel: {
    flex: 1,
  },
  removeText: {
    color: Colors.error,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderSoft,
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.xxs,
  },
})
