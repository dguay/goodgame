import React, { useEffect, useMemo, useState } from 'react'
import { Modal, Pressable, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

import { Text } from '@/components/ui/Text'
import { Colors, Radius, Spacing } from '@/constants'

const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

interface CalendarDay {
  date: Date
  key: string
  isCurrentMonth: boolean
}

function padDatePart(value: number): string {
  return value.toString().padStart(2, '0')
}

function formatDateValue(date: Date): string {
  return [
    date.getFullYear(),
    padDatePart(date.getMonth() + 1),
    padDatePart(date.getDate()),
  ].join('-')
}

function parseDateValue(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (match == null) return null

  const year = Number(match[1])
  const month = Number(match[2]) - 1
  const day = Number(match[3])
  const date = new Date(year, month, day)

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null
  }

  return date
}

function getMonthDate(value: string): Date {
  const parsed = parseDateValue(value)
  const base = parsed ?? new Date()
  return new Date(base.getFullYear(), base.getMonth(), 1)
}

function addMonths(date: Date, offset: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1)
}

function formatDisplayDate(value: string): string {
  const date = parseDateValue(value)
  if (date == null) return ''

  return `${MONTH_LABELS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`
}

function getCalendarDays(monthDate: Date): CalendarDay[] {
  const year = monthDate.getFullYear()
  const month = monthDate.getMonth()
  const firstDay = new Date(year, month, 1)
  const gridStart = new Date(year, month, 1 - firstDay.getDay())

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart)
    date.setDate(gridStart.getDate() + index)

    return {
      date,
      key: formatDateValue(date),
      isCurrentMonth: date.getMonth() === month,
    }
  })
}

export function DateField({ value, onChange, placeholder = 'Select date' }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [visibleMonth, setVisibleMonth] = useState(() => getMonthDate(value))
  const calendarDays = useMemo(() => getCalendarDays(visibleMonth), [visibleMonth])
  const selectedValue = parseDateValue(value) != null ? value : ''
  const todayValue = formatDateValue(new Date())
  const displayValue = formatDisplayDate(value)

  useEffect(() => {
    if (!isOpen) {
      setVisibleMonth(getMonthDate(value))
    }
  }, [isOpen, value])

  function handleSelect(date: Date) {
    onChange(formatDateValue(date))
    setIsOpen(false)
  }

  function handleClear() {
    onChange('')
    setIsOpen(false)
  }

  function handleToday() {
    const today = new Date()
    const todayDateValue = formatDateValue(today)
    onChange(todayDateValue)
    setVisibleMonth(getMonthDate(todayDateValue))
    setIsOpen(false)
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        onPress={() => setIsOpen(true)}
        style={styles.inputButton}
      >
        <Text
          variant="body"
          numberOfLines={1}
          style={[styles.inputText, displayValue === '' && styles.placeholderText]}
        >
          {displayValue === '' ? placeholder : displayValue}
        </Text>
        <Ionicons name="calendar-outline" size={17} color={Colors.textSecondary} />
      </Pressable>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setIsOpen(false)} />
          <View style={styles.pickerCard}>
            <View style={styles.pickerHeader}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setVisibleMonth(month => addMonths(month, -1))}
                hitSlop={8}
                style={styles.iconButton}
              >
                <Ionicons name="chevron-back" size={18} color={Colors.textPrimary} />
              </Pressable>
              <Text variant="subheading" style={styles.pickerTitle}>
                {MONTH_LABELS[visibleMonth.getMonth()]} {visibleMonth.getFullYear()}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setVisibleMonth(month => addMonths(month, 1))}
                hitSlop={8}
                style={styles.iconButton}
              >
                <Ionicons name="chevron-forward" size={18} color={Colors.textPrimary} />
              </Pressable>
            </View>

            <View style={styles.weekdayRow}>
              {WEEKDAY_LABELS.map((weekday, index) => (
                <Text key={`${weekday}-${index}`} variant="label" style={styles.weekdayLabel}>
                  {weekday}
                </Text>
              ))}
            </View>

            <View style={styles.calendarGrid}>
              {calendarDays.map(day => {
                const dayValue = formatDateValue(day.date)
                const isSelected = dayValue === selectedValue
                const isToday = dayValue === todayValue

                return (
                  <Pressable
                    accessibilityRole="button"
                    key={day.key}
                    onPress={() => handleSelect(day.date)}
                    style={[
                      styles.calendarDay,
                      !day.isCurrentMonth && styles.calendarDayMuted,
                      isToday && styles.calendarDayToday,
                      isSelected && styles.calendarDaySelected,
                    ]}
                  >
                    <Text
                      variant="label"
                      style={[
                        styles.calendarDayText,
                        !day.isCurrentMonth && styles.calendarDayTextMuted,
                        isSelected && styles.calendarDayTextSelected,
                      ]}
                    >
                      {day.date.getDate()}
                    </Text>
                  </Pressable>
                )
              })}
            </View>

            <View style={styles.pickerActions}>
              <Pressable accessibilityRole="button" onPress={handleClear} style={styles.actionButton}>
                <Text variant="label" color={Colors.textSecondary}>Clear</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={handleToday} style={styles.actionButton}>
                <Text variant="label" color={Colors.primary}>Today</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  inputButton: {
    minHeight: 44,
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.xs,
  },
  inputText: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  placeholderText: {
    color: Colors.textMuted,
  },
  modalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: Spacing.md,
  },
  pickerCard: {
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  pickerHeader: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  pickerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceRaised,
  },
  weekdayRow: {
    flexDirection: 'row',
  },
  weekdayLabel: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    color: Colors.textMuted,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDay: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  calendarDayMuted: {
    opacity: 0.42,
  },
  calendarDayToday: {
    borderColor: Colors.primary,
  },
  calendarDaySelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  calendarDayText: {
    color: Colors.textPrimary,
  },
  calendarDayTextMuted: {
    color: Colors.textMuted,
  },
  calendarDayTextSelected: {
    color: Colors.textPrimary,
  },
  pickerActions: {
    minHeight: 40,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  actionButton: {
    minHeight: 36,
    justifyContent: 'center',
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
  },
})
