import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, Modal } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { CustomDropdown } from '@/components/shared/custom-dropdown';
import { FloatingLabelInput } from '@/components/ui/floating-label-input';
import { GradientButton } from '@/components/ui/gradient-button';
import { MultiDatePicker } from '@/components/ui/multi-date-picker';
import { categoriesService } from '@/services/categories.service';

// ---- Types ----

interface Slot {
  id: string;
  date: string;          // YYYY-MM-DD
  startTime: string;     // HH:mm
  endTime: string;       // HH:mm
  maxBookings: number;
}

interface BookingConfigSectionProps {
  formData: {
    enableBooking: boolean;
    bookingType: 'DEFAULT' | 'SLOTS';
    slots: Slot[];
    categoryId?: string;
    subcategoryId?: string;
  };
  onInputChange: (field: string, value: any) => void;
  categoryName?: string;
  /** When true dates are locked (read-only), only time can be edited. */
  isEditing?: boolean;
}

// ---- Constants ----

const TIME_SLOTS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = (i % 2) * 30;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
});

// ---- Component ----

export function BookingConfigSection({
  formData,
  onInputChange,
  categoryName,
  isEditing = false,
}: BookingConfigSectionProps) {
  const [subcategorySupportsBooking, setSubcategorySupportsBooking] = useState(false);

  // Slot add/edit modal
  const [showSlotModal, setShowSlotModal] = useState(false);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);

  // Multi-date selection (for add mode)
  const [selectedDates, setSelectedDates] = useState<string[]>([]);

  // Slot form fields
  const [newStartTime, setNewStartTime] = useState('09:00');
  const [newEndTime, setNewEndTime] = useState('10:00');
  const [newMaxBookings, setNewMaxBookings] = useState('1');

  // Dropdown toggles
  const [showStartTimeDropdown, setShowStartTimeDropdown] = useState(false);
  const [showEndTimeDropdown, setShowEndTimeDropdown] = useState(false);

  // Validation messages
  const [timeError, setTimeError] = useState('');
  const [maxBookingsError, setMaxBookingsError] = useState('');

  // ---- effects ----
  useEffect(() => {
    checkSubcategoryBookingSupport();
  }, [formData.categoryId, formData.subcategoryId]);

  const checkSubcategoryBookingSupport = async () => {
    if (!formData.categoryId || !formData.subcategoryId) {
      setSubcategorySupportsBooking(false);
      onInputChange('enableBooking', false);
      return;
    }
    try {
      const response = await categoriesService.getCategorySubcategories(formData.categoryId);
      const selected = response?.data?.find((s: any) => s.id === formData.subcategoryId);
      const supports = selected?.supportsBooking || false;
      setSubcategorySupportsBooking(supports);
      if (!supports && formData.enableBooking) {
        onInputChange('enableBooking', false);
      }
    } catch {
      setSubcategorySupportsBooking(false);
    }
  };

  // ---- helpers ----
  const isCreate = !isEditing;

  const validateTimes = (start: string, end: string): boolean => {
    if (!start || !end) { setTimeError('Please select both start and end times'); return false; }
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    if (sh * 60 + sm >= eh * 60 + em) { setTimeError('Start time must be earlier than end time'); return false; }
    setTimeError('');
    return true;
  };

  // ---- modal openers ----
  const openAddModal = useCallback(() => {
    setEditingSlotId(null);
    setTimeError('');
    setMaxBookingsError('');
    setNewStartTime('09:00');
    setNewEndTime('10:00');
    setNewMaxBookings('1');
    setSelectedDates([]);
    setShowSlotModal(true);
  }, []);

  const openEditModal = useCallback((slot: Slot) => {
    setEditingSlotId(slot.id);
    setTimeError('');
    setMaxBookingsError('');
    setNewStartTime(slot.startTime);
    setNewEndTime(slot.endTime);
    setNewMaxBookings(String(slot.maxBookings));
    setSelectedDates([slot.date]); // show the existing date (read-only in edit)
    setShowSlotModal(true);
  }, []);

  // ---- save slot ----
  const handleSaveSlot = () => {
    if (!validateTimes(newStartTime, newEndTime)) return;

    const maxVal = parseInt(newMaxBookings);
    if (isNaN(maxVal) || maxVal < 1) { setMaxBookingsError('Minimum value is 1'); return; }
    if (maxVal > 999) { setMaxBookingsError('Maximum value is 999'); return; }
    setMaxBookingsError('');

    if (editingSlotId) {
      // Edit: only update time/max — date stays the same
      onInputChange('slots', formData.slots.map(s =>
        s.id === editingSlotId
          ? { ...s, startTime: newStartTime, endTime: newEndTime, maxBookings: maxVal }
          : s
      ));
    } else {
      // Create: generate a slot for each selected date
      if (selectedDates.length === 0) return;
      const newSlots: Slot[] = selectedDates.map(date => ({
        id: `${date}_${newStartTime}_${Math.random().toString(36).substr(2, 6)}`,
        date,
        startTime: newStartTime,
        endTime: newEndTime,
        maxBookings: maxVal,
      }));
      onInputChange('slots', [...(formData.slots || []), ...newSlots]);
    }
    setShowSlotModal(false);
  };

  const handleRemoveSlot = (id: string) => {
    onInputChange('slots', formData.slots.filter(s => s.id !== id));
  };

  // ---- don't render if booking not supported ----
  if (!subcategorySupportsBooking) return null;

  // Derive unique dates from existing slots (for display only)
  const existingDates = [...new Set(formData.slots.map(s => s.date))];

  return (
    <View style={styles.section}>
      <ThemedText style={styles.sectionTitle}>Booking Configuration</ThemedText>

      {/* Enable toggle */}
      <TouchableOpacity
        style={styles.toggle}
        onPress={() => onInputChange('enableBooking', !formData.enableBooking)}
      >
        <MaterialIcons
          name={formData.enableBooking ? 'check-box' : 'check-box-outline-blank'}
          size={24}
          color={Colors.light.primary}
        />
        <ThemedText style={styles.toggleText}>Enable Appointments/Bookings</ThemedText>
      </TouchableOpacity>

      {formData.enableBooking && (
        <>
          {/* ---- EDIT: read-only date chips ---- */}
          {!isCreate && existingDates.length > 0 && (
            <View style={styles.chipSection}>
              <View style={styles.sectionHeader}>
                <MaterialIcons name="event" size={18} color={Colors.light.textSecondary} />
                <ThemedText style={styles.sectionSubtitle}>Scheduled Dates (read‑only)</ThemedText>
              </View>
              <View style={styles.dateChips}>
                {existingDates.map(d => (
                  <View key={d} style={styles.dateChip}>
                    <ThemedText style={styles.dateChipText}>{d}</ThemedText>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ---- Slot list ---- */}
          <View style={styles.slotsContainer}>
            <View style={styles.slotsHeader}>
              <ThemedText style={styles.slotsTitle}>Time Slots</ThemedText>
              {isCreate && (
                <TouchableOpacity style={styles.addButton} onPress={openAddModal}>
                  <MaterialIcons name="add-circle" size={20} color={Colors.light.primary} />
                  <ThemedText style={styles.addButtonText}>Add Slot</ThemedText>
                </TouchableOpacity>
              )}
            </View>

            {formData.slots.length === 0 ? (
              <View style={styles.emptySlots}>
                <MaterialIcons name="event-busy" size={40} color="#CCC" />
                <ThemedText style={styles.emptyText}>
                  {isCreate ? 'Tap "Add Slot" to define availability' : 'No slots defined'}
                </ThemedText>
              </View>
            ) : (
              <ScrollView style={styles.slotsList} nestedScrollEnabled>
                {formData.slots.map((slot: Slot) => (
                  <View key={slot.id} style={styles.slotItem}>
                    <View style={styles.slotInfo}>
                      <ThemedText style={styles.slotDate}>{slot.date}</ThemedText>
                      <ThemedText style={styles.slotTime}>{slot.startTime} – {slot.endTime}</ThemedText>
                      <ThemedText style={styles.slotMax}>Max: {slot.maxBookings}</ThemedText>
                    </View>
                    <View style={styles.slotActions}>
                      <TouchableOpacity onPress={() => openEditModal(slot)} style={styles.actionIcon}>
                        <MaterialIcons name="edit" size={20} color={Colors.light.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleRemoveSlot(slot.id)} style={styles.actionIcon}>
                        <MaterialIcons name="delete-outline" size={22} color="#FF5252" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </>
      )}

      {/* ---- Add / Edit Slot Modal ---- */}
      <Modal visible={showSlotModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>
                {editingSlotId ? 'Edit Time Slot' : 'Add Time Slot'}
              </ThemedText>
              <TouchableOpacity onPress={() => setShowSlotModal(false)}>
                <MaterialIcons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalForm} keyboardShouldPersistTaps="handled">
              {/* ---- Multi-date picker ---- */}
              <View style={styles.inputGroup}>
                <ThemedText style={styles.inputLabel}>
                  {editingSlotId ? 'Date (read‑only)' : 'Select Dates'}
                </ThemedText>
                <MultiDatePicker
                  selectedDates={selectedDates}
                  onDatesChange={setSelectedDates}
                  readOnly={!!editingSlotId}
                  maxDays={90}
                />
                {!editingSlotId && selectedDates.length === 0 && (
                  <ThemedText style={styles.hintText}>Tap dates to select, tap again to deselect.</ThemedText>
                )}
              </View>

              {/* Start & End time side-by-side */}
              <View style={styles.timeRow}>
                <View style={styles.timeCol}>
                  <CustomDropdown
                    label="Start Time"
                    options={TIME_SLOTS}
                    value={newStartTime}
                    isOpen={showStartTimeDropdown}
                    onToggle={() => { setShowStartTimeDropdown(!showStartTimeDropdown); setShowEndTimeDropdown(false); }}
                    onSelect={(val) => {
                      setNewStartTime(val);
                      setShowStartTimeDropdown(false);
                      if (newEndTime) validateTimes(val, newEndTime);
                    }}
                  />
                </View>
                <View style={styles.timeCol}>
                  <CustomDropdown
                    label="End Time"
                    options={TIME_SLOTS}
                    value={newEndTime}
                    isOpen={showEndTimeDropdown}
                    onToggle={() => { setShowEndTimeDropdown(!showEndTimeDropdown); setShowStartTimeDropdown(false); }}
                    onSelect={(val) => {
                      setNewEndTime(val);
                      setShowEndTimeDropdown(false);
                      if (newStartTime) validateTimes(newStartTime, val);
                    }}
                  />
                </View>
              </View>

              {timeError ? (
                <View style={styles.timeErrorContainer}>
                  <MaterialIcons name="error-outline" size={16} color="#FF3B30" />
                  <ThemedText style={styles.timeErrorText}>{timeError}</ThemedText>
                </View>
              ) : null}

              {/* Max bookings */}
              <View style={styles.inputGroup}>
                <ThemedText style={styles.inputLabel}>Max Bookings per Slot</ThemedText>
                <FloatingLabelInput
                  label=""
                  value={newMaxBookings}
                  onChangeText={(val) => { setMaxBookingsError(''); setNewMaxBookings(val); }}
                  keyboardType="numeric"
                />
                {maxBookingsError ? <ThemedText style={styles.errorText}>{maxBookingsError}</ThemedText> : null}
              </View>

              <GradientButton
                title={editingSlotId ? 'Update Slot' : 'Add Slot'}
                onPress={handleSaveSlot}
                style={styles.modalSubmit}
                disabled={!editingSlotId && selectedDates.length === 0}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ---- Styles ----

const styles = StyleSheet.create({
  section: { paddingHorizontal: 20, marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#333', marginBottom: 16 },
  toggle: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 4, marginBottom: 16,
  },
  toggleText: { fontSize: 16, color: '#333', flex: 1 },

  // Date chips (edit mode)
  chipSection: {
    backgroundColor: '#F9F9F9', borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: '#EEE', marginBottom: 16,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  sectionSubtitle: { fontSize: 14, fontWeight: '600', color: '#444' },
  dateChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dateChip: {
    backgroundColor: '#F0F0F0', borderRadius: 16,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  dateChipText: { fontSize: 13, color: '#666', fontWeight: '500' },

  // Slots
  slotsContainer: {
    backgroundColor: '#F9F9F9', borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: '#EEE',
  },
  slotsHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12,
  },
  slotsTitle: { fontSize: 15, fontWeight: '600', color: '#444' },
  addButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addButtonText: { fontSize: 14, fontWeight: '600', color: Colors.light.primary },

  emptySlots: { alignItems: 'center', paddingVertical: 20, gap: 8 },
  emptyText: { color: '#999', fontSize: 14 },

  slotsList: { maxHeight: 280 },
  slotItem: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFF', padding: 12, borderRadius: 8,
    borderWidth: 1, borderColor: '#EEE', marginBottom: 8,
  },
  slotInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
  slotDate: { fontSize: 13, fontWeight: '700', color: Colors.light.primary, minWidth: 90 },
  slotTime: { fontSize: 14, color: '#333', fontWeight: '500' },
  slotMax: { fontSize: 12, color: '#999' },
  slotActions: { flexDirection: 'row', gap: 6 },
  actionIcon: { padding: 4 },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFF', borderRadius: 14,
    maxHeight: '88%', maxWidth: 420, width: '100%', overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', padding: 14,
    borderBottomWidth: 1, borderBottomColor: '#EEE',
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#333' },
  modalForm: { padding: 14 },

  inputGroup: { marginBottom: 14 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#666', marginBottom: 5 },
  timeRow: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  timeCol: { flex: 1 },
  hintText: { fontSize: 12, color: '#999', marginTop: 6 },

  timeErrorContainer: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: -8, marginBottom: 16, paddingHorizontal: 4,
  },
  timeErrorText: { fontSize: 12, color: '#FF3B30', flex: 1 },
  errorText: { fontSize: 12, color: '#FF3B30', marginTop: 4 },

  modalSubmit: { marginTop: 0, marginBottom: 10 },
});
