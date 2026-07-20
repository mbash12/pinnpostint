/**
 * ComplaintModals Component
 * Unified modal components for complaint interactions (Discussion, Response, Action).
 * Used by both buyer and seller booking detail pages.
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, TextInput, ActivityIndicator, Platform, ScrollView, RefreshControl } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { Complaint, ComplaintMessage } from './complaint-tracker';

interface ComplaintModalsProps {
  // Discussion Modal
  discussionVisible: boolean;
  onCloseDiscussion: () => void;
  selectedComplaint: Complaint | null;
  messages: ComplaintMessage[];
  messageText: string;
  onMessageTextChange: (text: string) => void;
  onSendMessage: () => void;
  onRefreshMessages?: () => void;
  isRefreshingMessages?: boolean;
  isDesktop?: boolean;

  // Response Modal (Seller only)
  responseVisible: boolean;
  onCloseResponse: () => void;
  responseText: string;
  onResponseTextChange: (text: string) => void;
  onSubmitResponse: () => void;
  isSubmittingResponse: boolean;

  // Action Modal (Seller only)
  actionVisible: boolean;
  onCloseAction: () => void;
  resolutionNote: string;
  onResolutionNoteChange: (text: string) => void;
  onResolveWithRefund: () => void;
  onCompleteWithoutRefund: () => void;
  isProcessingAction: boolean;

  // File Complaint Modal (Buyer only)
  fileComplaintVisible: boolean;
  onCloseFileComplaint: () => void;
  complaintDescription: string;
  onComplaintDescriptionChange: (text: string) => void;
  onSubmitComplaint: () => void;
  isSubmittingComplaint: boolean;
}

export function ComplaintModals({
  // Discussion
  discussionVisible,
  onCloseDiscussion,
  selectedComplaint,
  messages,
  messageText,
  onMessageTextChange,
  onSendMessage,
  onRefreshMessages,
  isRefreshingMessages = false,
  isDesktop = false,

  // Response
  responseVisible,
  onCloseResponse,
  responseText,
  onResponseTextChange,
  onSubmitResponse,
  isSubmittingResponse,

  // Action
  actionVisible,
  onCloseAction,
  resolutionNote,
  onResolutionNoteChange,
  onResolveWithRefund,
  onCompleteWithoutRefund,
  isProcessingAction,

  // File Complaint
  fileComplaintVisible,
  onCloseFileComplaint,
  complaintDescription,
  onComplaintDescriptionChange,
  onSubmitComplaint,
  isSubmittingComplaint,
}: ComplaintModalsProps) {
  const messagesScrollViewRef = useRef<ScrollView>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-poll for new messages when discussion modal is open
  useEffect(() => {
    if (discussionVisible && onRefreshMessages) {
      // Initial refresh
      onRefreshMessages();
      
      // Set up polling every 3 seconds
      pollingIntervalRef.current = setInterval(() => {
        onRefreshMessages();
      }, 3000);
    }

    // Cleanup on unmount or when modal closes
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [discussionVisible, onRefreshMessages]);

  const handleManualRefresh = () => {
    if (onRefreshMessages) {
      onRefreshMessages();
    }
  };

  return (
    <>
      {/* Discussion Modal */}
      <Modal
        visible={discussionVisible}
        transparent
        animationType="slide"
        onRequestClose={onCloseDiscussion}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.discussionModalContent, isDesktop && styles.desktopModalContent]}>
            <View style={styles.modalHeader}>
              <MaterialIcons name="forum" size={24} color={Colors.light.primary} />
              <ThemedText style={styles.modalTitle}>Complaint Discussion</ThemedText>
              <View style={styles.headerActions}>
                {onRefreshMessages && (
                  <TouchableOpacity onPress={handleManualRefresh} style={styles.refreshButton}>
                    <MaterialIcons 
                      name="refresh" 
                      size={22} 
                      color={Colors.light.primary} 
                    />
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={onCloseDiscussion} style={styles.closeButton}>
                  <MaterialIcons name="close" size={24} color={Colors.light.text} />
                </TouchableOpacity>
              </View>
            </View>

            {selectedComplaint && (
              <View style={styles.discussionModalBody}>
                {/* Original complaint */}
                <View style={styles.complaintPreview}>
                  <ThemedText style={styles.previewLabel}>Original Complaint:</ThemedText>
                  <ThemedText style={styles.previewText}>{selectedComplaint.description}</ThemedText>
                </View>

                {/* Messages thread */}
                <ScrollView
                  ref={messagesScrollViewRef}
                  style={styles.messagesScrollView}
                  contentContainerStyle={styles.messagesScrollContent}
                  refreshControl={
                    onRefreshMessages ? (
                      <RefreshControl
                        refreshing={isRefreshingMessages}
                        onRefresh={handleManualRefresh}
                        colors={[Colors.light.primary]}
                        tintColor={Colors.light.primary}
                      />
                    ) : undefined
                  }
                >
                  {messages.length > 0 ? (
                    messages.map((msg) => (
                      <View
                        key={msg.id}
                        style={[
                          styles.messageBubble,
                          msg.senderType === 'RESPONDENT' ? styles.sellerMessage :
                          msg.senderType === 'REPORTER' ? styles.buyerMessage :
                          styles.adminMessage
                        ]}
                      >
                        <View style={styles.messageHeader}>
                          <ThemedText style={styles.messageSender}>
                            {msg.senderType === 'RESPONDENT' ? 'Seller' :
                             msg.senderType === 'REPORTER' ? 'Buyer' : 'Admin'}: {msg.sender?.firstName} {msg.sender?.lastName}
                          </ThemedText>
                          <ThemedText style={styles.messageTime}>
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </ThemedText>
                        </View>
                        <ThemedText style={styles.messageText}>{msg.message}</ThemedText>
                      </View>
                    ))
                  ) : (
                    <ThemedText style={styles.noMessagesText}>No messages yet. Start the conversation!</ThemedText>
                  )}
                </ScrollView>

                {/* Message input */}
                <View style={styles.messageInputContainer}>
                  <TextInput
                    style={[styles.messageInput, isDesktop && styles.desktopResponseInput]}
                    multiline
                    numberOfLines={3}
                    value={messageText}
                    onChangeText={onMessageTextChange}
                    placeholder="Type your message here..."
                    placeholderTextColor="#999999"
                    tabIndex={0}
                  />
                  <TouchableOpacity
                    style={[styles.sendButton, !messageText.trim() && styles.sendButtonDisabled]}
                    onPress={onSendMessage}
                    disabled={!messageText.trim()}
                  >
                    <MaterialIcons name="send" size={20} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Response Modal */}
      <Modal
        visible={responseVisible}
        transparent
        animationType="fade"
        onRequestClose={onCloseResponse}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isDesktop && styles.desktopModalContent]}>
            <View style={styles.modalHeader}>
              <MaterialIcons name="reply" size={24} color={Colors.light.primary} />
              <ThemedText style={styles.modalTitle}>Respond to Complaint</ThemedText>
            </View>

            {selectedComplaint && (
              <View style={styles.modalBody}>
                <View style={styles.complaintPreview}>
                  <ThemedText style={styles.previewLabel}>Original Complaint:</ThemedText>
                  <ThemedText style={styles.previewText}>{selectedComplaint.description}</ThemedText>
                </View>

                <ThemedText style={styles.responseInputLabel}>Your Response:</ThemedText>
                <TextInput
                  style={[styles.responseInput, isDesktop && styles.desktopResponseInput]}
                  multiline
                  numberOfLines={6}
                  value={responseText}
                  onChangeText={onResponseTextChange}
                  placeholder="Provide your response to this complaint..."
                  placeholderTextColor="#999999"
                  tabIndex={0}
                />

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalButtonCancel]}
                    onPress={onCloseResponse}
                  >
                    <ThemedText style={styles.modalButtonTextCancel}>Cancel</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalButtonSubmit]}
                    onPress={onSubmitResponse}
                    disabled={isSubmittingResponse || !responseText.trim()}
                  >
                    {isSubmittingResponse ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <ThemedText style={styles.modalButtonTextSubmit}>Submit Response</ThemedText>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Action Modal - Complete/Cancel */}
      <Modal
        visible={actionVisible}
        transparent
        animationType="fade"
        onRequestClose={onCloseAction}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.actionModalContent, isDesktop && styles.desktopModalContent]}>
            <View style={styles.modalHeader}>
              <MaterialIcons name="done-all" size={24} color={Colors.light.primary} />
              <ThemedText style={styles.modalTitle}>Resolve Complaint</ThemedText>
            </View>

            {selectedComplaint && (
              <View style={styles.modalBody}>
                <ThemedText style={styles.previewLabel}>Original Complaint:</ThemedText>
                <ThemedText style={styles.previewText}>{selectedComplaint.description}</ThemedText>

                <ThemedText style={styles.responseInputLabel}>Resolution Note (optional):</ThemedText>
                <TextInput
                  style={[styles.responseInput, isDesktop && styles.desktopResponseInput]}
                  multiline
                  numberOfLines={4}
                  value={resolutionNote}
                  onChangeText={onResolutionNoteChange}
                  placeholder="Add a note about the resolution..."
                  placeholderTextColor="#999999"
                  tabIndex={0}
                />

                <View style={styles.actionModalActions}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.refundButton]}
                    onPress={onResolveWithRefund}
                    disabled={isProcessingAction}
                  >
                    {isProcessingAction ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <ThemedText style={styles.modalButtonTextSubmit}>Resolve with Refund</ThemedText>
                    )}
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.modalButton, styles.completeButton]}
                    onPress={onCompleteWithoutRefund}
                    disabled={isProcessingAction}
                  >
                    {isProcessingAction ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <ThemedText style={styles.modalButtonTextSubmit}>Complete Without Refund</ThemedText>
                    )}
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalButtonCancel]}
                    onPress={onCloseAction}
                  >
                    <ThemedText style={styles.modalButtonTextCancel}>Cancel</ThemedText>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* File Complaint Modal */}
      <Modal
        visible={fileComplaintVisible}
        transparent
        animationType="fade"
        onRequestClose={onCloseFileComplaint}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ThemedText style={styles.modalTitle}>File a Complaint</ThemedText>
            <ThemedText style={styles.modalSubtitle}>
              Please describe the issue with your booking
            </ThemedText>
            <TextInput
              style={styles.complaintInput}
              placeholder="Describe what happened..."
              placeholderTextColor={Colors.light.textSecondary}
              value={complaintDescription}
              onChangeText={onComplaintDescriptionChange}
              multiline
              numberOfLines={6}
              maxLength={2000}
              tabIndex={0}
            />
            <ThemedText style={styles.charCount}>{complaintDescription.length}/2000</ThemedText>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={onCloseFileComplaint}
              >
                <ThemedText style={styles.modalButtonCancelText}>Cancel</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={onSubmitComplaint}
                disabled={isSubmittingComplaint}
              >
                <ThemedText style={styles.modalButtonConfirmText}>Submit Complaint</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 9999,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  discussionModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '90%',
    maxWidth: 600,
    height: '70%',
    padding: 20,
  },
  actionModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '90%',
    maxWidth: 500,
    padding: 20,
  },
  desktopModalContent: {
    maxWidth: 500,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.light.text,
  },
  modalSubtitle: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginBottom: 16,
  },
  closeButton: {
    padding: 4,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 'auto',
  },
  refreshButton: {
    padding: 4,
  },
  modalBody: {
    gap: 16,
  },
  discussionModalBody: {
    flex: 1,
    gap: 16,
  },
  complaintPreview: {
    backgroundColor: '#FEF2F2',
    borderLeftWidth: 3,
    borderLeftColor: '#EF4444',
    borderRadius: 8,
    padding: 12,
  },
  previewLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EF4444',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  previewText: {
    fontSize: 14,
    color: Colors.light.text,
    lineHeight: 20,
  },
  messagesContainer: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
  },
  messagesScrollView: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
  },
  messagesScrollContent: {
    flexGrow: 1,
  },
  messageBubble: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    maxWidth: '80%',
  },
  sellerMessage: {
    backgroundColor: '#DBEAFE',
    alignSelf: 'flex-end',
    borderLeftWidth: 3,
    borderLeftColor: Colors.light.primary,
  },
  buyerMessage: {
    backgroundColor: '#F0FDF4',
    alignSelf: 'flex-start',
    borderLeftWidth: 3,
    borderLeftColor: '#22C55E',
  },
  adminMessage: {
    backgroundColor: '#FEF3C7',
    alignSelf: 'center',
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
    width: '90%',
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    gap: 12,
  },
  messageSender: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.text,
    flexShrink: 1,
  },
  messageTime: {
    fontSize: 11,
    color: '#6B7280',
    flexShrink: 0,
    marginLeft: 8,
  },
  messageText: {
    fontSize: 14,
    color: Colors.light.text,
    lineHeight: 18,
  },
  noMessagesText: {
    textAlign: 'center',
    color: '#6B7280',
    fontStyle: 'italic',
    paddingVertical: 20,
  },
  messageInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
  messageInput: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: Colors.light.text,
    borderWidth: 1,
    borderColor: Colors.light.border,
    textAlignVertical: 'top',
    minHeight: 60,
    outlineWidth: 0,
    outlineColor: 'transparent',
    outlineStyle: 'none',
  },
  sendButton: {
    backgroundColor: Colors.light.primary,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  responseInputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 6,
  },
  responseInput: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: Colors.light.text,
    borderWidth: 1,
    borderColor: Colors.light.border,
    textAlignVertical: 'top',
    minHeight: 120,
    outlineWidth: 0,
    outlineColor: 'transparent',
    outlineStyle: 'none',
  },
  desktopResponseInput: {
    fontSize: 15,
    padding: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  actionModalActions: {
    flexDirection: 'column',
    gap: 12,
    marginTop: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#F0F0F0',
  },
  modalButtonTextCancel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.text,
  },
  modalButtonCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
  },
  modalButtonSubmit: {
    backgroundColor: Colors.light.primary,
  },
  modalButtonTextSubmit: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalButtonConfirm: {
    backgroundColor: Colors.light.primary,
  },
  modalButtonConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  complaintInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    color: Colors.light.text,
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: 8,
    borderWidth: 0,
    outlineWidth: 0,
    outlineColor: 'transparent',
    outlineStyle: 'none',
  },
  charCount: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    textAlign: 'right',
    marginBottom: 16,
  },
  refundButton: {
    backgroundColor: '#EF4444',
  },
  completeButton: {
    backgroundColor: '#10B981',
  },
});

export default ComplaintModals;
