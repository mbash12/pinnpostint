/**
 * ComplaintTracker Component
 * A unified complaint tracking component used by both buyer and seller booking detail pages.
 *
 * Props:
 * - complaints: Array of complaints from the booking
 * - userRole: 'BUYER' | 'SELLER' - determines which actions are available
 * - onOpenDiscussion: callback to open discussion modal
 * - onOpenAction: callback to open resolve action modal
 * - onFileComplaint: callback to file a new complaint (buyer only)
 * - canFileComplaint: boolean - whether buyer can file a complaint
 * - isLoading: boolean
 */

import React from 'react';
import { View, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';

export interface ComplaintMessage {
  id: string;
  complaintId: string;
  senderId: string;
  senderType: 'REPORTER' | 'RESPONDENT' | 'ADMIN';
  message: string;
  createdAt: string;
  sender?: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export interface Complaint {
  id: string;
  bookingId: string;
  reporterId: string;
  respondentId: string;
  description: string;
  status: 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'REJECTED';
  resolutionNote?: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    messages: number;
  };
  respondent?: {
    id: string;
    firstName: string;
    lastName: string;
    phone?: string;
    email?: string;
  };
  adminResolver?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  messages?: ComplaintMessage[];
}

interface ComplaintTrackerProps {
  complaints: Complaint[];
  userRole: 'BUYER' | 'SELLER';
  onOpenDiscussion: (complaint: Complaint) => void;
  onOpenAction?: (complaint: Complaint) => void;
  onFileComplaint?: () => void;
  canFileComplaint?: boolean;
  isLoading?: boolean;
  /** When true, removes outer container styles (margin, border, padding) for embedding in parent card */
  embedded?: boolean;
  /** Buyer complaint management actions */
  onCancelComplaint?: (complaint: Complaint) => void;
  onResolveComplaint?: (complaint: Complaint) => void;
}

const complaintStatusColors: Record<string, string> = {
  OPEN: '#FF9500',
  INVESTIGATING: '#007AFF',
  RESOLVED: '#34C759',
  REJECTED: '#FF3B30',
};

const complaintStatusIcons: Record<string, any> = {
  OPEN: 'schedule',
  INVESTIGATING: 'search',
  RESOLVED: 'check-circle',
  REJECTED: 'cancel',
};

/**
 * Format status from UPPER_CASE/SNAKE_CASE to Title Case
 * e.g., "OPEN" -> "Open"
 */
const formatStatus = (status: string): string => {
  return status
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export function ComplaintTracker({
  complaints,
  userRole,
  onOpenDiscussion,
  onOpenAction,
  onFileComplaint,
  canFileComplaint = false,
  isLoading = false,
  embedded = false,
  onCancelComplaint,
  onResolveComplaint,
}: ComplaintTrackerProps) {
  const containerStyle = embedded ? styles.containerEmbedded : styles.container;

  if (!complaints || complaints.length === 0) {
    // Show file complaint button for buyer if no complaints exist
    if (userRole === 'BUYER' && canFileComplaint && onFileComplaint) {
      return (
        <View style={containerStyle}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="report-problem" size={24} color={Colors.light.primary} />
            <ThemedText style={styles.cardTitle}>Complaint</ThemedText>
          </View>
          <TouchableOpacity
            style={styles.fileComplaintButton}
            onPress={onFileComplaint}
            disabled={isLoading}
          >
            <MaterialIcons name="report-problem" size={20} color="#FFFFFF" />
            <ThemedText style={styles.fileComplaintButtonText}>File Complaint</ThemedText>
          </TouchableOpacity>
        </View>
      );
    }
    return null;
  }

  const isSeller = userRole === 'SELLER';
  const isBuyer = userRole === 'BUYER';

  const getComplaintLabel = () => {
    if (isSeller) return 'Customer Complaint:';
    return 'Your Complaint:';
  };

  return (
    <View style={containerStyle}>
      <View style={styles.cardHeader}>
        <MaterialIcons name="report-problem" size={24} color={Colors.light.primary} />
        <ThemedText style={styles.cardTitle}>Complaint Tracker</ThemedText>
      </View>

      {complaints.map((complaint) => {
        const canTakeAction =
          complaint.status === 'OPEN' ||
          complaint.status === 'INVESTIGATING';

        const hasMessages = (complaint._count?.messages ?? 0) > 0;

        return (
          <View key={complaint.id} style={styles.complaintCard}>
            {/* Header with status and date */}
            <View style={styles.complaintHeader}>
              <View style={styles.complaintStatusRow}>
                <View style={[
                  styles.complaintStatusBadge,
                  { backgroundColor: complaintStatusColors[complaint.status] || '#999' }
                ]}>
                  <MaterialIcons
                    name={complaintStatusIcons[complaint.status] || 'info'}
                    size={16}
                    color="#FFFFFF"
                  />
                  <ThemedText style={styles.complaintStatusText}>
                    {formatStatus(complaint.status)}
                  </ThemedText>
                </View>
                <ThemedText style={styles.complaintDate}>
                  Filed {new Date(complaint.createdAt).toLocaleDateString()}
                </ThemedText>
              </View>
            </View>

            {/* Original Complaint */}
            <View style={styles.complaintSection}>
              <ThemedText style={styles.complaintSectionLabel}>{getComplaintLabel()}</ThemedText>
              <ThemedText style={styles.complaintDescription}>{complaint.description}</ThemedText>
            </View>

            {/* Admin Resolution (if exists) */}
            {complaint.resolutionNote && (
              <View style={styles.complaintSection}>
                <ThemedText style={styles.complaintSectionLabel}>Admin Resolution:</ThemedText>
                <View style={styles.complaintResolutionBox}>
                  <ThemedText style={styles.complaintResolutionText}>
                    {complaint.resolutionNote}
                  </ThemedText>
                  {complaint.adminResolver && (
                    <ThemedText style={styles.resolverInfo}>
                      Resolved by: {complaint.adminResolver.firstName} {complaint.adminResolver.lastName}
                    </ThemedText>
                  )}
                </View>
              </View>
            )}

            {/* Status notices */}
            {complaint.status === 'OPEN' && (
              <View style={styles.complaintPendingNotice}>
                <MaterialIcons name="info" size={16} color={Colors.light.primary} />
                <ThemedText style={styles.complaintPendingText}>
                  {isSeller
                    ? "Complaint is being reviewed. We'll notify you when there's an update."
                    : "Your complaint is being reviewed. We'll notify you when there's an update."
                  }
                </ThemedText>
              </View>
            )}

            {complaint.status === 'INVESTIGATING' && (
              <View style={styles.complaintPendingNotice}>
                <MaterialIcons name="search" size={16} color={Colors.light.primary} />
                <ThemedText style={styles.complaintPendingText}>
                  Our team is actively investigating this complaint.
                </ThemedText>
              </View>
            )}

            {/* Action buttons - discussion for both buyer and seller */}
            {canTakeAction && (
              <View style={styles.complaintActions}>
                <TouchableOpacity
                  style={styles.discussButton}
                  onPress={() => onOpenDiscussion(complaint)}
                >
                  <MaterialIcons name="forum" size={16} color="#FFFFFF" />
                  <ThemedText style={styles.discussButtonText}>
                    Discuss {hasMessages && `(${complaint._count?.messages})`}
                  </ThemedText>
                </TouchableOpacity>
              </View>
            )}

            {/* Buyer complaint management actions - only show when complaint is active */}
            {isBuyer && canTakeAction && (
              <View style={styles.buyerActionButtons}>
                {onCancelComplaint && (
                  <TouchableOpacity
                    style={styles.cancelComplaintButton}
                    onPress={() => onCancelComplaint(complaint)}
                    disabled={isLoading}
                  >
                    <MaterialIcons name="close" size={16} color="#FF3B30" />
                    <ThemedText style={styles.cancelComplaintButtonText}>Cancel Complaint</ThemedText>
                  </TouchableOpacity>
                )}
                {onResolveComplaint && (
                  <TouchableOpacity
                    style={styles.resolveComplaintButton}
                    onPress={() => onResolveComplaint(complaint)}
                    disabled={isLoading}
                  >
                    <MaterialIcons name="check-circle" size={16} color="#34C759" />
                    <ThemedText style={styles.resolveComplaintButtonText}>Resolve Complaint</ThemedText>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  containerEmbedded: {
    // No outer container styles when embedded in parent card
    // Parent handles padding, margin, border, etc.
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.text,
  },
  fileComplaintButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#8B4513',
    paddingVertical: 16,
    borderRadius: 12,
  },
  fileComplaintButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  complaintCard: {
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  complaintHeader: {
    marginBottom: 12,
  },
  complaintStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  complaintStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  complaintStatusText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    textTransform: 'capitalize',
  },
  complaintDate: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  complaintSection: {
    marginBottom: 12,
  },
  complaintSectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  complaintDescription: {
    fontSize: 14,
    color: Colors.light.text,
    lineHeight: 20,
  },
  complaintResolutionBox: {
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#4CAF50',
  },
  complaintResolutionText: {
    fontSize: 14,
    color: Colors.light.text,
    lineHeight: 20,
    marginBottom: 4,
  },
  resolverInfo: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '500',
  },
  complaintPendingNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    borderRadius: 8,
    padding: 10,
  },
  complaintPendingText: {
    fontSize: 13,
    color: Colors.light.text,
    flex: 1,
  },
  complaintActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  discussButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.primary,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  discussButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  buyerActionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E9ECEF',
    paddingTop: 12,
  },
  cancelComplaintButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#FF3B30',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  cancelComplaintButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FF3B30',
  },
  resolveComplaintButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F5E9',
    borderWidth: 1,
    borderColor: '#34C759',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  resolveComplaintButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#34C759',
  },
});

export default ComplaintTracker;
