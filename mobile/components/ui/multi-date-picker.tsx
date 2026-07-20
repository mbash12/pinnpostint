import React, { useState, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';

interface MultiDatePickerProps {
  selectedDates: string[];
  onDatesChange: (dates: string[]) => void;
  /** When true, the picker is read-only (no taps). */
  readOnly?: boolean;
  /** Max future days to show (default 90). */
  maxDays?: number;
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAY_HEADERS = ['Mo','Tu','We','Th','Fr','Sa','Su'];

function getMonthDays(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const days: (Date | null)[] = [];
  // Monday = 1, Sunday = 7; we want Mon-Sun grid
  let startDow = first.getDay(); // 0=Sun
  startDow = startDow === 0 ? 6 : startDow - 1; // convert to Mon=0
  for (let i = 0; i < startDow; i++) days.push(null);
  for (let d = 1; d <= last.getDate(); d++) {
    days.push(new Date(year, month, d));
  }
  return days;
}

export function MultiDatePicker({
  selectedDates,
  onDatesChange,
  readOnly = false,
  maxDays = 90,
}: MultiDatePickerProps) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const maxDate = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + maxDays);
    return d;
  }, [today, maxDays]);

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const days = useMemo(() => getMonthDays(viewYear, viewMonth), [viewYear, viewMonth]);

  const selectedSet = useMemo(() => new Set(selectedDates), [selectedDates]);

  const toggleDate = (date: Date) => {
    if (readOnly) return;
    if (date < today || date > maxDate) return;
    const key = toDateStr(date);
    if (selectedSet.has(key)) {
      onDatesChange(selectedDates.filter(d => d !== key));
    } else {
      onDatesChange([...selectedDates, key].sort());
    }
  };

  const isToday = (date: Date) => toDateStr(date) === toDateStr(today);

  const goNext = () => {
    if (viewMonth === 11) { setViewYear(viewYear + 1); setViewMonth(0); }
    else setViewMonth(viewMonth + 1);
  };
  const goPrev = () => {
    const prev = new Date(viewYear, viewMonth, 1);
    // don't go before current month
    if (prev <= today && viewMonth === today.getMonth() && viewYear === today.getFullYear()) return;
    if (viewMonth === 0) { setViewYear(viewYear - 1); setViewMonth(11); }
    else setViewMonth(viewMonth - 1);
  };

  return (
    <View style={styles.container}>
      {/* Month nav */}
      <View style={styles.nav}>
        <TouchableOpacity onPress={goPrev} hitSlop={8}>
          <MaterialIcons name="chevron-left" size={24} color={Colors.light.primary} />
        </TouchableOpacity>
        <ThemedText style={styles.monthLabel}>
          {MONTHS[viewMonth]} {viewYear}
        </ThemedText>
        <TouchableOpacity onPress={goNext} hitSlop={8}>
          <MaterialIcons name="chevron-right" size={24} color={Colors.light.primary} />
        </TouchableOpacity>
      </View>

      {/* Day headers */}
      <View style={styles.weekRow}>
        {DAY_HEADERS.map(h => (
          <View key={h} style={styles.dayCell}>
            <ThemedText style={styles.dayHeader}>{h}</ThemedText>
          </View>
        ))}
      </View>

      {/* Day grid */}
      <View style={styles.weekRow}>
        {days.map((d, i) => {
          if (!d) return <View key={`e${i}`} style={styles.dayCell} />;
          const key = toDateStr(d);
          const sel = selectedSet.has(key);
          const disabled = d < today || d > maxDate;
          return (
            <TouchableOpacity
              key={key}
              style={[
                styles.dayCell,
                styles.dayBtn,
                sel && styles.dayBtnSelected,
                isToday(d) && styles.dayBtnToday,
                disabled && styles.dayBtnDisabled,
              ]}
              onPress={() => toggleDate(d)}
              disabled={readOnly || disabled}
              activeOpacity={0.6}
            >
              <ThemedText style={[
                styles.dayText,
                sel && styles.dayTextSelected,
                disabled && styles.dayTextDisabled,
              ]}>
                {d.getDate()}
              </ThemedText>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Selected count */}
      {selectedDates.length > 0 && !readOnly && (
        <ThemedText style={styles.selectedHint}>
          {selectedDates.length} date{selectedDates.length > 1 ? 's' : ''} selected
        </ThemedText>
      )}
    </View>
  );
}

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FAFAFA',
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: '#EEE',
  },
  nav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  monthLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#333',
  },
  weekRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%` as any,
    aspectRatio: 1.15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayHeader: {
    fontSize: 10,
    color: '#999',
    fontWeight: '600',
  },
  dayBtn: {
    borderRadius: 6,
  },
  dayBtnSelected: {
    backgroundColor: Colors.light.primary,
  },
  dayBtnToday: {
    borderWidth: 1.5,
    borderColor: Colors.light.primary,
  },
  dayBtnDisabled: {
    opacity: 0.3,
  },
  dayText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#333',
  },
  dayTextSelected: {
    color: '#FFF',
    fontWeight: '700',
  },
  dayTextDisabled: {
    color: '#CCC',
  },
  selectedHint: {
    fontSize: 11,
    color: Colors.light.primary,
    marginTop: 6,
    fontWeight: '600',
  },
});
