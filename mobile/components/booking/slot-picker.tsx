import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';

interface Slot {
  id: string;
  date: string;       // YYYY-MM-DD
  startTime: string;
  endTime: string;
  maxBookings: number;
  bookedCount?: number;
}

interface SlotPickerProps {
  slots: Slot[];
  selectedDate: string;
  selectedSlotId: string;
  onDateChange: (date: string) => void;
  onSlotSelect: (slotId: string) => void;
}

function formatDisplayDate(iso: string) {
  // Normalize to YYYY-MM-DD (slots may store full ISO or just date)
  const dateStr = iso?.split('T')[0] || iso;
  const d = new Date(dateStr + 'T00:00:00');
  return {
    dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
    dayNum: d.getDate(),
    month: d.toLocaleDateString('en-US', { month: 'short' }),
  };
}

function isSlotFull(slot: Slot): boolean {
  const max = slot.maxBookings || 1;
  const booked = slot.bookedCount ?? 0;
  return booked >= max;
}

export function SlotPicker({
  slots,
  selectedDate,
  selectedSlotId,
  onDateChange,
  onSlotSelect,
}: SlotPickerProps) {
  // Extract unique dates from slots, sorted ascending, normalized to YYYY-MM-DD
  const [availableDates] = useState(() => {
    const dates = [...new Set(slots.map((s) => s.date?.split('T')[0] || s.date))].sort();
    return dates;
  });

  // Normalize selectedDate for comparison
  const normalizedSelected = selectedDate?.split('T')[0] || selectedDate;

  // Default select first date
  useEffect(() => {
    if (availableDates.length > 0) {
      const isCurrentValid = normalizedSelected && availableDates.includes(normalizedSelected);
      if (!normalizedSelected || !isCurrentValid) {
        onDateChange(availableDates[0]);
      }
    }
  }, [availableDates, normalizedSelected, onDateChange]);

  // Slots matching the selected date (normalize both sides)
  const dateSlots = slots.filter((s) => (s.date?.split('T')[0] || s.date) === normalizedSelected);

  return (
    <View style={styles.container}>
      <ThemedText style={styles.label}>Pick a Date</ThemedText>

      {availableDates.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialIcons name="event-busy" size={32} color="#AAA" />
          <ThemedText style={styles.emptyText}>No available dates</ThemedText>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateList}>
          {availableDates.map((date) => {
            const { dayName, dayNum, month } = formatDisplayDate(date);
            const isSelected = normalizedSelected === date;
            return (
              <TouchableOpacity
                key={date}
                style={[styles.dateCard, isSelected && styles.dateCardActive]}
                onPress={() => onDateChange(date)}
              >
                <ThemedText style={[styles.dayName, isSelected && styles.textActive]}>
                  {dayName}
                </ThemedText>
                <ThemedText style={[styles.dateNum, isSelected && styles.textActive]}>
                  {dayNum}
                </ThemedText>
                <ThemedText style={[styles.monthText, isSelected && styles.textActive]}>
                  {month}
                </ThemedText>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {availableDates.length > 0 && (
        <>
          <ThemedText style={styles.label}>
            Available Slots for {normalizedSelected ? formatDisplayDate(normalizedSelected).dayName + ', ' + normalizedSelected : ''}
          </ThemedText>

          {dateSlots.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="event-busy" size={32} color="#AAA" />
              <ThemedText style={styles.emptyText}>No slots on this date</ThemedText>
            </View>
          ) : (
            <View style={styles.slotGrid}>
              {dateSlots.map((slot) => {
                const isSelected = selectedSlotId === slot.id;
                const isFull = isSlotFull(slot);
                return (
                  <TouchableOpacity
                    key={slot.id}
                    style={[
                      styles.slotButton,
                      isSelected && styles.slotButtonActive,
                      isFull && styles.slotButtonFull
                    ]}
                    onPress={() => {
                      if (!isFull) {
                        onSlotSelect(slot.id);
                      }
                    }}
                    disabled={isFull}
                  >
                    <MaterialIcons
                      name={isFull ? 'block' : 'access-time'}
                      size={16}
                      color={isSelected ? '#FFF' : isFull ? '#CCC' : Colors.light.primary}
                    />
                    <ThemedText style={[
                      styles.slotText,
                      isSelected && styles.textActive,
                      isFull && styles.slotTextFull
                    ]}>
                      {slot.startTime} - {slot.endTime}
                      {isFull ? ' (Full)' : slot.bookedCount !== undefined ? ` (${slot.maxBookings - slot.bookedCount} left)` : ''}
                    </ThemedText>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: 10 },
  label: {
    fontSize: 15, fontWeight: '600', color: '#444', marginBottom: 12, marginTop: 8,
  },
  dateList: {
    flexDirection: 'row', marginBottom: 20, flexGrow: 0,
    minHeight: 78,
  },
  dateCard: {
    width: 64, height: 78, borderRadius: 12,
    backgroundColor: '#F5F5F5', alignItems: 'center',
    justifyContent: 'center', marginRight: 10,
    borderWidth: 1, borderColor: '#EEE',
  },
  dateCardActive: {
    backgroundColor: Colors.light.primary, borderColor: Colors.light.primary,
  },
  dayName: { fontSize: 11, color: '#777', marginBottom: 2 },
  dateNum: { fontSize: 18, fontWeight: '700', color: '#333' },
  monthText: { fontSize: 10, color: '#777', marginTop: 1 },
  textActive: { color: '#FFF' },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  slotButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8,
    borderWidth: 1, borderColor: Colors.light.primary,
    backgroundColor: '#FFF', minWidth: '45%',
  },
  slotButtonActive: { backgroundColor: Colors.light.primary },
  slotButtonFull: { backgroundColor: '#F0F0F0', borderColor: '#DDD' },
  slotText: { fontSize: 13, fontWeight: '600', color: Colors.light.primary },
  slotTextFull: { color: '#AAA' },
  emptyState: {
    alignItems: 'center', padding: 20,
    backgroundColor: '#F9F9F9', borderRadius: 12, gap: 8,
  },
  emptyText: { color: '#999', fontSize: 14 },
});
