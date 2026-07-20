import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Modal,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { Colors, Shadows } from '@/constants/theme';
import { HEADER_HEIGHT } from '@/constants/layout';
import { CompactAdCard } from '@/components/compact-ad-card';
import { formatPrice, shouldHidePrice } from '@/utils/price-formatter';
import { formatChatDateTime } from '@/utils/format-chat-datetime';
import { Footer } from '@/components/footer';
import { PageLayout } from '@/components/page-layout';
import { MobilePlatformBanners } from '@/components/mobile-platform-banners';
import { SideBanners } from '@/components/home/side-banners';
import { useAuth } from '@/contexts/auth-context';
import { useResponsive } from '@/hooks/use-responsive';
import { chatService, Conversation, Message } from '@/services/chat.service';
import { adsService, Ad } from '@/services/ads.service';
import { platformAdsService } from '@/services/platform-ads.service';
import socketService from '@/services/socket.service';
import type { PlatformAd } from '@/types/api.types';
import { PlatformAdPosition } from '@/types/api.types';

// Local-only message shape that augments the server Message with send state for
// optimistic UI. A `tempId` + `status: 'sending' | 'failed'` is used until the
// server confirms the message, at which point we swap in the real id.
type MessageStatus = 'sending' | 'sent' | 'failed';
interface ChatMessage extends Message {
  tempId?: string;
  status?: MessageStatus;
}
const MESSAGES_PAGE_SIZE = 50;

export default function ChatPage() {
  const { isDesktop, screenWidth } = useResponsive();
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ recipientId?: string; adId?: string; adTitle?: string; adSlug?: string }>();
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isRefreshingConversations, setIsRefreshingConversations] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [pendingAd, setPendingAd] = useState<any>(null);
  const [platformAds, setPlatformAds] = useState<PlatformAd[]>([]);
  const [isLoadingPlatformAds, setIsLoadingPlatformAds] = useState(true);
  const inputRef = useRef<TextInput>(null);
  const flatListRef = useRef<FlatList>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Track the ad slug that initiated this chat context for validation on first send
  const [originAdSlug, setOriginAdSlug] = useState<string | null>(null);
  // Track processed ad slug to prevent re-processing
  const processedAdSlugRef = useRef<string | null>(null);

  // Pagination for messages (cursor-based: oldest message's id loaded so far)
  const [oldestMessageCursor, setOldestMessageCursor] = useState<string | null>(null);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [isLoadingMoreMessages, setIsLoadingMoreMessages] = useState(false);

  // Search for conversations
  const [conversationSearchQuery, setConversationSearchQuery] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Ad search for sharing
  const [showAdModal, setShowAdModal] = useState(false);
  const [adSearchQuery, setAdSearchQuery] = useState('');
  const [debouncedAdSearchQuery, setDebouncedAdSearchQuery] = useState('');
  const [myAds, setMyAds] = useState<Ad[]>([]);
  const [isLoadingAds, setIsLoadingAds] = useState(false);
  const adSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Scroll to bottom function
  const scrollToBottom = useCallback((animated = true) => {
    requestAnimationFrame(() => {
      setTimeout(() => {
        if (flatListRef.current && messages.length > 0) {
          flatListRef.current.scrollToEnd({ animated });
        }
      }, animated ? 50 : 10);
    });
  }, [messages]);

  // Use refs to track current conversation and prevent stale closures
  const selectedConversationRef = useRef(selectedConversation);
  useEffect(() => {
    selectedConversationRef.current = selectedConversation;
  }, [selectedConversation]);

  // Inbox list: `conversation_updated` is emitted to the per-user room on connect.
  useEffect(() => {
    if (!isAuthenticated) return;

    const unsubscribe = socketService.on('conversation_updated', (data: {
      id?: string;
      lastMessage?: string | null;
      lastMessageAt?: string;
      unreadDelta?: number;
    }) => {
      if (!data?.id) return;

      setConversations(prev => {
        const idx = prev.findIndex(c => c.id === data.id);
        if (idx < 0) {
          // New conversation - we'll let the next full refresh handle it
          return prev;
        }
        const open = selectedConversationRef.current?.id === data.id;
        return prev.map(conv => {
          if (conv.id !== data.id) return conv;
          return {
            ...conv,
            lastMessage: data.lastMessage ?? conv.lastMessage,
            lastMessageAt: data.lastMessageAt ?? conv.lastMessageAt,
            unreadCount: open
              ? 0
              : (conv.unreadCount || 0) + (typeof data.unreadDelta === 'number' ? data.unreadDelta : 0),
          };
        });
      });
    });

    return unsubscribe;
  }, [isAuthenticated]);

  // Auto-scroll to bottom when conversation changes or messages load
  useEffect(() => {
    if (selectedConversation && selectedConversation.id !== 'new' && messages.length > 0) {
      // Reduced delay for faster scroll when conversation changes
      const timer = setTimeout(() => {
        scrollToBottom(true);
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [selectedConversation?.id, messages.length, scrollToBottom]);

  useEffect(() => {
    if (isAuthenticated) {
      loadConversations();
      fetchPlatformAds();
    } else {
      setIsLoadingConversations(false);
    }
  }, [isAuthenticated]);

  const fetchPlatformAds = async () => {
    try {
      setIsLoadingPlatformAds(true);
      const response = await platformAdsService.getPlatformAds();
      if (response.success && response.data) {
        setPlatformAds(response.data);
      }
    } catch (error) {
    } finally {
      setIsLoadingPlatformAds(false);
    }
  };

  // Handle incoming params to start a chat
  useEffect(() => {
    // Only process if we have a new adSlug or recipientId that hasn't been processed yet
    const currentAdSlug = params.adSlug as string | undefined;
    const currentRecipientId = params.recipientId as string | undefined;
    
    // Skip if we've already processed this exact adSlug
    if (currentAdSlug && processedAdSlugRef.current === currentAdSlug) {
      return;
    }
    
    if (isAuthenticated && (currentRecipientId || currentAdSlug)) {
      handleIncomingChatRequest();
    }
    
    // Cleanup: reset processed ad slug on unmount
    return () => {
      processedAdSlugRef.current = null;
    };
  }, [isAuthenticated, params.recipientId, params.adSlug]);

  const handleIncomingChatRequest = async () => {
    // Mark this adSlug as processed
    const currentAdSlug = params.adSlug as string | undefined;
    if (currentAdSlug) {
      processedAdSlugRef.current = currentAdSlug;
      setOriginAdSlug(currentAdSlug);
    }

    if (params.recipientId || params.adSlug) {
      // Start a new conversation (or focus an existing one)
      try {
        setIsLoadingConversations(true);
        const response = await chatService.initiateChat({
          recipientId: params.recipientId,
          adSlug: params.adSlug,
        });

        if (response.success && response.data) {
          if (response.data.conversation) {
            // Existing conversation
            const conv = response.data.conversation as any;
            setSelectedConversation(conv);
          } else if (response.data.recipient) {
            // New conversation context
            const mockConv: any = {
              id: 'new',
              otherUser: response.data.recipient,
              lastMessage: null,
              lastMessageAt: new Date().toISOString(),
              unreadCount: 0,
            };
            setSelectedConversation(mockConv);
          }

          if (response.data.ad) {
            setPendingAd(response.data.ad);
          }
        }
      } catch (error: any) {
        console.error('Failed to initiate chat:', error);
        const errorMessage = error?.response?.data?.message || error?.message || 'Failed to start chat. Please try again.';
        Alert.alert('Chat Error', errorMessage);
      } finally {
        setIsLoadingConversations(false);
      }
    }
  };

  // Poll for messages when a conversation is selected
  // Socket.IO: Join/leave conversation rooms and listen for new messages
  useEffect(() => {
    const conversation = selectedConversationRef.current;
    if (conversation && conversation.id !== 'new') {
      // Join the conversation room
      socketService.joinConversation(conversation.id);

      // Load initial messages
      loadMessages(conversation.id);

      // Listen for new messages
      const unsubscribeNewMessage = socketService.on('new_message', (data: Message) => {
        // Use the ref to get the current conversation instead of the closure value
        const currentConversation = selectedConversationRef.current;
        if (currentConversation && data.conversationId === currentConversation.id) {
          setMessages(prev => {
            // 1) Real id already present — no-op (avoid duplicates).
            if (prev.some(m => m.id === data.id)) return prev;

            // 2) This is the confirmation of a message we sent optimistically.
            //    Replace the matching pending/failed temp entry by content.
            const tempIdx = prev.findIndex(
              m =>
                m.tempId &&
                m.senderId === data.senderId &&
                (m.text ?? null) === (data.text ?? null) &&
                (m.adId ?? null) === (data.adId ?? null)
            );
            if (tempIdx >= 0) {
              const next = [...prev];
              next[tempIdx] = { ...data, status: 'sent' };
              return next;
            }

            // 3) Genuinely new incoming message.
            setTimeout(() => scrollToBottom(true), 50);
            return [...prev, { ...data, status: 'sent' }];
          });

          // Mark as read when received (only for messages we didn't send)
          if (data.senderId !== user?.id) {
            void chatService.markAsRead(currentConversation.id);
          }
        }
      });

      // Listen for read receipts
      const unsubscribeRead = socketService.on('messages_read', (data) => {
        const currentConversation = selectedConversationRef.current;
        if (currentConversation && data.conversationId === currentConversation.id) {
          setMessages(prev => prev.map(msg => {
            if (data.messageIds.includes(msg.id)) {
              return { ...msg, isRead: true };
            }
            return msg;
          }));
        }
      });

      // Cleanup: Leave room and unsubscribe
      return () => {
        socketService.leaveConversation(conversation.id);
        unsubscribeNewMessage();
        unsubscribeRead();
      };
    } else {
      setMessages([]);
    }
  }, [selectedConversation?.id]); // Remove scrollToBottom from dependencies
  // Keyboard height tracking for input visibility on both platforms
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setKeyboardHeight(e.endCoordinates.height)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Scroll to bottom when keyboard opens so latest message stays visible
  useEffect(() => {
    if (keyboardHeight > 0 && flatListRef.current && messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [keyboardHeight, messages.length]);


  const loadConversations = async (page: number = 1, append: boolean = false, isRefresh: boolean = false) => {
    try {
      if (isRefresh) {
        setIsRefreshingConversations(true);
      } else if (append) {
        setIsLoadingMore(true);
      } else {
        setIsLoadingConversations(true);
      }

      const response = await chatService.getConversations({
        page,
        limit: 20,
      });

      if (response.success && response.data) {
        if (append && page > 1) {
          setConversations(prev => [...prev, ...response.data!]);
        } else {
          setConversations(response.data!);
        }

        if (response.pagination) {
          setTotalPages(response.pagination.totalPages);
          setHasMore(page < response.pagination.totalPages);
          setCurrentPage(page);
        }
      }
    } catch (error: any) {
      console.error('Failed to load conversations:', error);
      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to load conversations. Please check your connection and try again.';
      Alert.alert('Error Loading Conversations', errorMessage);
    } finally {
      setIsLoadingConversations(false);
      setIsRefreshingConversations(false);
      setIsLoadingMore(false);
    }
  };

  const loadMoreConversations = () => {
    if (!isLoadingMore && hasMore) {
      loadConversations(currentPage + 1, true);
    }
  };

  const loadMessages = async (id: string) => {
    try {
      setIsLoadingMessages(true);

      const response = await chatService.getMessages(id, { limit: MESSAGES_PAGE_SIZE });
      if (response.success && response.data) {
        const { messages: loadedMessages, hasMore } = response.data;
        const annotated: ChatMessage[] = loadedMessages.map(m => ({ ...m, status: 'sent' }));
        setMessages(annotated);
        setHasMoreMessages(hasMore);
        setOldestMessageCursor(annotated.length > 0 ? annotated[0].id : null);

        // Mark as read only if conversation has unread messages
        const conversation = selectedConversationRef.current;
        if (conversation && conversation.unreadCount > 0) {
          const result = await chatService.markAsRead(id);
          if (result.success) {
            setMessages(prev => prev.map(msg => ({ ...msg, isRead: true })));
            setConversations(prev =>
              prev.map(conv => (conv.id === id ? { ...conv, unreadCount: 0 } : conv))
            );
          }
        }

        if (annotated.length > 0) {
          setTimeout(() => scrollToBottom(true), 100);
        }
      }
    } catch (error: any) {
      console.error('Failed to load messages:', error);
      const msg =
        error?.response?.data?.message || error?.message || 'Failed to load messages.';
      Alert.alert('Error', msg);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const loadMoreMessages = async () => {
    if (
      !selectedConversation ||
      selectedConversation.id === 'new' ||
      isLoadingMoreMessages ||
      !hasMoreMessages ||
      !oldestMessageCursor
    ) {
      return;
    }

    try {
      setIsLoadingMoreMessages(true);
      const response = await chatService.getMessages(selectedConversation.id, {
        before: oldestMessageCursor,
        limit: MESSAGES_PAGE_SIZE,
      });
      if (response.success && response.data) {
        const { messages: older, hasMore } = response.data;
        if (older.length > 0) {
          const annotated: ChatMessage[] = older.map(m => ({ ...m, status: 'sent' }));
          setMessages(prev => [...annotated, ...prev]);
          setOldestMessageCursor(annotated[0].id);
        }
        setHasMoreMessages(hasMore);
      }
    } catch (error) {
      console.error('Failed to load more messages:', error);
    } finally {
      setIsLoadingMoreMessages(false);
    }
  };

  const loadMyAds = async (search?: string) => {
    try {
      setIsLoadingAds(true);
      const response = await adsService.getMyAds({
        limit: 50,
        status: 'ACTIVE',
        search,
      });
      if (response.success && response.data) {
        setMyAds(response.data);
      }
    } catch (error) {
      console.error('Failed to load my ads:', error);
    } finally {
      setIsLoadingAds(false);
    }
  };

  // Debounce ad search query
  useEffect(() => {
    // Clear existing timeout
    if (adSearchTimeoutRef.current) {
      clearTimeout(adSearchTimeoutRef.current);
    }

    // Set new timeout for debounce
    adSearchTimeoutRef.current = setTimeout(() => {
      setDebouncedAdSearchQuery(adSearchQuery);
    }, 500); // 500ms debounce

    // Cleanup on unmount
    return () => {
      if (adSearchTimeoutRef.current) {
        clearTimeout(adSearchTimeoutRef.current);
      }
    };
  }, [adSearchQuery]);

  useEffect(() => {
    if (showAdModal) {
      loadMyAds(debouncedAdSearchQuery || undefined);
    }
  }, [showAdModal, debouncedAdSearchQuery]);


  const filteredConversations = conversations;

  // API handles filtering for active, non-expired ads
  const filteredAds = myAds;

  const performSend = useCallback(
    async (
      tempId: string,
      payload: { text?: string; adId?: string; adSlug?: string },
      conversationForSend: Conversation
    ) => {
      try {
        const response = await chatService.sendMessage({
          recipientId: conversationForSend.otherUser.id,
          text: payload.text,
          adId: payload.adId,
          adSlug: payload.adSlug,
        });

        if (!response.success || !response.data) {
          throw new Error(response.error?.message || 'Failed to send message');
        }

        const serverMsg = response.data;

        // When starting a brand-new conversation, swap the placeholder id for
        // the real conversation id so subsequent sends hit the right room.
        if (conversationForSend.id === 'new') {
          try {
            socketService.joinConversation(serverMsg.conversationId);
          } catch {}
          // Refresh conversations to pick up the new thread.
          const convResponse = await chatService.getConversations({
            page: 1,
            limit: 20
          });
          if (convResponse.success && convResponse.data) {
            setConversations(convResponse.data);
            const newConv = convResponse.data.find(c => c.id === serverMsg.conversationId);
            if (newConv) setSelectedConversation(newConv);
          }
        }

        // Replace the optimistic bubble with the confirmed server message.
        setMessages(prev => {
          const idx = prev.findIndex(m => m.tempId === tempId);
          if (idx === -1) {
            // Socket beat us to it — nothing to do.
            return prev;
          }
          const next = [...prev];
          next[idx] = { ...serverMsg, status: 'sent' };
          return next;
        });

        setConversations(prev =>
          prev.map(conv =>
            conv.id === serverMsg.conversationId
              ? {
                  ...conv,
                  lastMessage: serverMsg.text || 'Shared an ad',
                  lastMessageAt: serverMsg.createdAt,
                }
              : conv
          )
        );
      } catch (error: any) {
        console.error('Failed to send message:', error);
        setMessages(prev =>
          prev.map(m => (m.tempId === tempId ? { ...m, status: 'failed' } : m))
        );
        const errorMessage =
          error?.response?.data?.error?.message ||
          error?.response?.data?.message ||
          error?.message ||
          'Failed to send message. Tap the message to retry.';
        Alert.alert('Message Not Sent', errorMessage);
      }
    },
    []
  );

  const sendMessage = async (text?: string, adId?: string) => {
    if (!selectedConversation) return;
    if (isSending) return;

    const trimmedText = text?.trim() || undefined;
    const effectiveAdId = adId || pendingAd?.id;
    if (!trimmedText && !effectiveAdId) return;

    setIsSending(true);
    const conversationForSend = selectedConversation;
    const tempId = `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Optimistically append the bubble so the user sees feedback immediately.
    const optimistic: ChatMessage = {
      id: tempId,
      tempId,
      status: 'sending',
      conversationId:
        conversationForSend.id === 'new' ? tempId : conversationForSend.id,
      senderId: user?.id || '',
      text: trimmedText || null,
      adId: effectiveAdId || null,
      ad: pendingAd && effectiveAdId === pendingAd.id
        ? {
            id: pendingAd.id,
            slug: pendingAd.slug,
            title: pendingAd.title,
            price: pendingAd.price,
            images: pendingAd.images || [],
            locationCity: pendingAd.locationCity,
            locationState: pendingAd.locationState,
            locationFormatted: pendingAd.locationFormatted,
            category: pendingAd.category,
            subcategory: pendingAd.subcategory,
          }
        : null,
      isRead: false,
      createdAt: new Date().toISOString(),
    };

    setMessages(prev => [...prev, optimistic]);
    setTimeout(() => scrollToBottom(true), 50);

    // Clear input state up-front so the user can keep typing.
    setInputText('');
    setPendingAd(null);
    if (adId) setShowAdModal(false);
    setTimeout(() => inputRef.current?.focus(), 100);

    // Include adSlug on the first message from an ad context so the backend
    // can validate that the recipient matches the ad owner.
    // For existing conversations, the backend already knows the participants.
    const adSlugForSend = conversationForSend.id === 'new' ? originAdSlug : undefined;

    try {
      await performSend(
        tempId,
        { text: trimmedText, adId: effectiveAdId, adSlug: adSlugForSend || undefined },
        conversationForSend
      );
      // Once the first message is sent successfully, clear the origin slug
      // so subsequent messages in this conversation don't re-validate.
      if (adSlugForSend) {
        setOriginAdSlug(null);
      }
    } finally {
      setIsSending(false);
    }
  };

  const retrySend = useCallback(
    async (msg: ChatMessage) => {
      if (!selectedConversation || !msg.tempId) return;
      setMessages(prev =>
        prev.map(m => (m.tempId === msg.tempId ? { ...m, status: 'sending' } : m))
      );
      await performSend(
        msg.tempId,
        { text: msg.text || undefined, adId: msg.adId || undefined },
        selectedConversation
      );
    },
    [selectedConversation, performSend]
  );

  const handleBack = () => {
    setSelectedConversation(null);
    setOriginAdSlug(null);
    setPendingAd(null);
  };

  const renderChatItem = ({ item }: { item: Conversation }) => (
    <Pressable
      style={[
        styles.chatItem,
        selectedConversation?.id === item.id && styles.selectedChatItem,
      ]}
      onPress={() => {
        setSelectedConversation(item);
        // Clear any ad context from a previous ad-initiated chat so we
        // don't accidentally validate against the wrong ad.
        setOriginAdSlug(null);
        setPendingAd(null);
      }}
    >
      <View style={styles.avatar}>
        <ThemedText style={styles.avatarText}>{item.otherUser.name[0]}</ThemedText>
      </View>
      <View style={styles.chatInfo}>
        <View style={styles.chatHeader}>
          <View style={styles.chatItemTitle}>
            <ThemedText style={styles.userName} numberOfLines={1}>{item.otherUser.name}</ThemedText>
          </View>
          <ThemedText style={styles.timestamp} numberOfLines={2}>
            {formatChatDateTime(item.lastMessageAt)}
          </ThemedText>
        </View>
        <ThemedText style={styles.lastMessage} numberOfLines={1}>
          {item.lastMessage || 'No messages yet'}
        </ThemedText>
      </View>
      {item.unreadCount > 0 && (
        <View style={styles.unreadBadge}>
          <ThemedText style={styles.unreadBadgeText}>{item.unreadCount}</ThemedText>
        </View>
      )}
    </Pressable>
  );

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isMe = item.senderId === user?.id;
    const isFailed = item.status === 'failed';
    const isSending = item.status === 'sending';

    const handleAdPress = () => {
      if (item.ad) {
        const adIdentifier = item.ad.slug || item.ad.id;
        router.push(`/detail/${adIdentifier}`);
      }
    };

    const handleBubblePress = () => {
      if (isFailed) {
        Alert.alert(
          'Message failed to send',
          'Would you like to retry sending this message?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Retry', onPress: () => retrySend(item) },
          ]
        );
      }
    };

    const StatusIcon = () => {
      if (!isMe) return null;
      if (isSending) {
        return (
          <ActivityIndicator
            size="small"
            color="rgba(255,255,255,0.7)"
            style={{ marginLeft: 4 }}
          />
        );
      }
      if (isFailed) {
        return (
          <MaterialIcons
            name="error-outline"
            size={14}
            color="#FFD6D6"
            style={{ marginLeft: 4 }}
          />
        );
      }
      return (
        <MaterialIcons
          name={item.isRead ? 'done-all' : 'done'}
          size={12}
          color="rgba(255,255,255,0.7)"
          style={{ marginLeft: 4 }}
        />
      );
    };

    return (
      <View style={[styles.messageRow, isMe ? styles.myMessageRow : styles.otherMessageRow]}>
        <Pressable
          onPress={handleBubblePress}
          disabled={!isFailed}
          style={[
            styles.messageBubble,
            isMe ? styles.myBubble : styles.otherBubble,
            isFailed && styles.failedBubble,
            isSending && { opacity: 0.7 },
          ]}
        >
          {item.ad && (
            <View style={styles.messageAd}>
              <CompactAdCard
                id={item.ad.id}
                title={item.ad.title}
                price={!shouldHidePrice(item.ad.price) ? formatPrice(item.ad.price) : ''}
                image={item.ad.images[0]}
                category={item.ad.category?.name}
                subcategory={item.ad.subcategory?.name}
                categoryPlaceholder={item.ad.category?.adPlaceholder}
                location={item.ad.locationFormatted || item.ad.locationCity || 'Location'}
                onPress={handleAdPress}
                style={styles.messageAdCard}
              />
            </View>
          )}
          {item.text && (
            <ThemedText style={[styles.messageText, isMe ? styles.myMessageText : styles.otherMessageText]}>
              {item.text}
            </ThemedText>
          )}
          <View style={styles.messageFooter}>
            <ThemedText style={[styles.messageTimestamp, isMe && { color: 'rgba(255,255,255,0.7)' }]}>
              {isFailed ? 'Tap to retry' : formatChatDateTime(item.createdAt)}
            </ThemedText>
            <StatusIcon />
          </View>
        </Pressable>
      </View>
    );
  };

  const ChatList = (
    <View style={[styles.listContainer, isDesktop && styles.desktopList]}>
      {isLoadingConversations ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.light.primary} />
        </View>
      ) : (
        <>
          {/* Search */}
          {conversations.length > 0 && (
            <View style={styles.searchContainer}>
              <View style={styles.searchInputWrapper}>
                <MaterialIcons name="search" size={20} color={Colors.light.textSecondary} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search conversations..."
                  placeholderTextColor={Colors.light.textSecondary}
                  value={conversationSearchQuery}
                  onChangeText={setConversationSearchQuery}
                />
                {conversationSearchQuery.length > 0 && (
                  <Pressable onPress={() => setConversationSearchQuery('')} style={styles.clearSearchButton}>
                    <MaterialIcons name="cancel" size={18} color={Colors.light.textSecondary} />
                  </Pressable>
                )}
              </View>
            </View>
          )}

          {/* Conversations */}
          {conversations.filter(conv =>
            conversationSearchQuery === '' ||
            conv.otherUser.name.toLowerCase().includes(conversationSearchQuery.toLowerCase())
          ).length === 0 ? (
            <View style={styles.emptyList}>
              <MaterialIcons name="search-off" size={48} color={Colors.light.border} />
              <ThemedText style={styles.emptyListText}>
                {conversationSearchQuery ? 'No conversations found' : 'No conversations'}
              </ThemedText>
            </View>
          ) : (
            conversations.filter(conv =>
              conversationSearchQuery === '' ||
              conv.otherUser.name.toLowerCase().includes(conversationSearchQuery.toLowerCase())
            ).map(item => (
              <React.Fragment key={item.id}>
                {renderChatItem({ item })}
              </React.Fragment>
            ))
          )}

          {hasMore && conversations.length > 0 && (
            <View style={styles.loadMoreContainer}>
              {isLoadingMore ? (
                <ActivityIndicator size="small" color={Colors.light.primary} />
              ) : (
                <Pressable
                  style={styles.loadMoreButton}
                  onPress={loadMoreConversations}
                >
                  <ThemedText style={styles.loadMoreText}>Load More Conversations</ThemedText>
                </Pressable>
              )}
            </View>
          )}
        </>
      )}
    </View>
  );

  const AdMentionModal = (
    <Modal
      visible={showAdModal}
      transparent
      animationType="fade"
      onRequestClose={() => setShowAdModal(false)}
    >
      <Pressable style={styles.modalOverlay} onPress={() => setShowAdModal(false)}>
        <Pressable style={styles.modalContent} onPress={e => e.stopPropagation()}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderLeft}>
              <MaterialIcons name="add-circle-outline" size={24} color={Colors.light.primary} />
              <ThemedText style={styles.modalTitle}>Share an Ad</ThemedText>
            </View>
            <Pressable onPress={() => setShowAdModal(false)} style={styles.modalCloseButton}>
              <MaterialIcons name="close" size={24} color={Colors.light.text} />
            </Pressable>
          </View>

          <View style={styles.modalSearchContainer}>
            <View style={styles.modalSearchWrapper}>
              <MaterialIcons name="search" size={20} color={Colors.light.textSecondary} />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search your ads..."
                placeholderTextColor={Colors.light.textSecondary}
                value={adSearchQuery}
                onChangeText={setAdSearchQuery}
                autoFocus
              />
              {adSearchQuery.length > 0 && (
                <Pressable onPress={() => setAdSearchQuery('')} style={styles.clearButton}>
                  <MaterialIcons name="cancel" size={18} color={Colors.light.textSecondary} />
                </Pressable>
              )}
            </View>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {isLoadingAds ? (
              <ActivityIndicator size="small" color={Colors.light.primary} />
            ) : filteredAds.length > 0 ? (
              filteredAds.map(ad => (
                <View key={ad.id} style={styles.modalAdItem}>
                  <CompactAdCard
                    id={ad.id}
                    title={ad.title}
                    price={!shouldHidePrice(ad.price) ? formatPrice(ad.price) : ''}
                    image={ad.images[0]}
                    category={ad.category?.name}
                    subcategory={ad.subcategory?.name}
                    categoryPlaceholder={ad.category?.adPlaceholder}
                    location={ad.locationFormatted || ad.locationCity || 'Location'}
                    onPress={() => {
                      setPendingAd(ad);
                      setShowAdModal(false);
                    }}
                    containerStyle={styles.modalAdCard}
                  />
                </View>
              ))
            ) : (
              <View style={styles.modalEmpty}>
                <MaterialIcons name="search-off" size={48} color={Colors.light.border} />
                <ThemedText style={styles.modalEmptyText}>No ads found matching "{adSearchQuery}"</ThemedText>
              </View>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );

  const ChatDetail = (
    <View style={styles.detailContainer}>
      {selectedConversation ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + HEADER_HEIGHT : 0}
          style={{ flex: 1, paddingBottom: Platform.OS === 'android' ? keyboardHeight : 0 }}
        >
          <View style={[styles.detailHeader, !isDesktop && styles.detailHeaderMobile]}>
            {!isDesktop && (
              <Pressable
                onPress={handleBack}
                style={styles.backButton}
                hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
              >
                <MaterialIcons name="arrow-back" size={24} color={Colors.light.primary} />
              </Pressable>
            )}
            <View style={styles.headerUser}>
              <View style={styles.smallAvatar}>
                <ThemedText style={styles.smallAvatarText}>{selectedConversation.otherUser.name[0]}</ThemedText>
              </View>
              <View>
                <ThemedText style={styles.headerUserName} numberOfLines={1} ellipsizeMode="tail">
                  {selectedConversation.otherUser.name}
                </ThemedText>
              </View>
            </View>
          </View>
          {isLoadingMessages ? (
            <View style={styles.loadingMessagesContainer}>
              <ActivityIndicator size="large" color={Colors.light.primary} />
            </View>
          ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={item => item.tempId || item.id}
            style={{ flex: 1 }}
            contentContainerStyle={[
              styles.messageList,
              { paddingBottom: 16 + keyboardHeight },
            ]}
            initialNumToRender={20}
            scrollEnabled={true}
            bounces={false}
            ListHeaderComponent={
              hasMoreMessages ? (
                <View style={styles.loadMoreMessagesContainer}>
                  {isLoadingMoreMessages ? (
                    <ActivityIndicator size="small" color={Colors.light.primary} />
                  ) : (
                    <Pressable
                      style={styles.loadMoreMessagesButton}
                      onPress={loadMoreMessages}
                    >
                      <ThemedText style={styles.loadMoreMessagesText}>Load older messages</ThemedText>
                    </Pressable>
                  )}
                </View>
              ) : null
            }
            ListFooterComponent={
              <View style={{ height: 20 }} />
            }
            extraData={messages.length} // Force re-render when messages length changes
          />
          )}

          {pendingAd && (
            <View style={styles.pendingAdContainer}>
              <View style={styles.pendingAdWrapper}>
                <Pressable style={styles.pendingAdPressable} onPress={() => router.push(`/detail/${pendingAd.slug || pendingAd.id}`)}>
                  <CompactAdCard
                    id={pendingAd.id}
                    title={pendingAd.title}
                    price={!shouldHidePrice(pendingAd.price) ? formatPrice(pendingAd.price) : ''}
                    image={pendingAd.images?.[0]}
                    category={pendingAd.category?.name}
                    subcategory={pendingAd.subcategory?.name}
                    categoryPlaceholder={pendingAd.category?.adPlaceholder}
                    location={pendingAd.locationFormatted || pendingAd.locationCity || 'Location'}
                    style={styles.pendingAdCard}
                    imageStyle={styles.pendingAdImage}
                  />
                </Pressable>
                <Pressable
                  style={styles.removeAdButton}
                  onPress={() => {
                    setPendingAd(null);
                    processedAdSlugRef.current = null;
                    router.setParams({ adSlug: undefined });
                  }}
                >
                  <MaterialIcons name="close" size={18} color="#FFF" />
                </Pressable>
              </View>
            </View>
          )}

          <View style={styles.inputContainer}>
            <View style={styles.inputWrapper}>
              <View style={styles.textInputWrapper}>
                <TextInput
                  ref={inputRef}
                  style={styles.input}
                  placeholder="Type a message..."
                  placeholderTextColor={Colors.light.textSecondary}
                  value={inputText}
                  onChangeText={setInputText}
                  multiline
                  onSubmitEditing={() => {
                    if (inputText.trim()) {
                      sendMessage(inputText);
                    }
                  }}
                  blurOnSubmit={false}
                  returnKeyType="send"
                  onKeyPress={({ nativeEvent }) => {
                    // Handle Enter key for sending, Shift+Enter for new line
                    if (nativeEvent.key === 'Enter' && !nativeEvent.shiftKey) {
                      // Prevent default behavior (new line) and send message
                      if (inputText.trim()) {
                        sendMessage(inputText);
                      }
                    }
                  }}
                />
              </View>

              <Pressable
                style={[styles.sendButton, (!inputText.trim() || isSending) && styles.sendButtonDisabled]}
                onPress={() => sendMessage(inputText)}
                disabled={!inputText.trim() || isSending}
              >
                {isSending ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <MaterialIcons name="send" size={24} color="#FFF" />
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      ) : (
        <View style={styles.emptyContainer}>
          <MaterialIcons name="chat-bubble-outline" size={64} color={Colors.light.border} />
          <ThemedText style={styles.emptyText}>Select a conversation to start chatting</ThemedText>
        </View>
      )}
      {AdMentionModal}
    </View>
  );

  if (isAuthLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.light.primary} />
        <ThemedText style={styles.loadingText}>Loading chat...</ThemedText>
      </View>
    );
  }

  if (!isAuthenticated) {
    return (
      <View style={styles.centered}>
        <ThemedText>Please login to use chat</ThemedText>
        <Pressable
          style={styles.loginButton}
          onPress={() => router.push('/(auth)/login')}
        >
          <ThemedText style={styles.loginButtonText}>Go to Login</ThemedText>
        </Pressable>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Chat',
          headerShown: false,
        }}
      />

      {isDesktop ? (
        <ScrollView style={styles.desktopScroll} contentContainerStyle={styles.desktopScrollContent} scrollEnabled={true}>
          <View style={styles.desktopHomeWrapper}>
            {screenWidth >= 1300 && (
              <SideBanners
                ads={platformAds.filter(ad => ad.position === PlatformAdPosition.LEFT)}
                position={PlatformAdPosition.LEFT}
              />
            )}

            <View style={styles.desktopMainContent}>
              <View style={styles.desktopMaxWidth}>
                <View style={styles.desktopLayout}>
                  {ChatList}
                  {ChatDetail}
                </View>
              </View>
            </View>

            {screenWidth >= 1300 && (
              <SideBanners
                ads={platformAds.filter(ad => ad.position === PlatformAdPosition.RIGHT)}
                position={PlatformAdPosition.RIGHT}
              />
            )}
          </View>
          <View style={styles.desktopFooterContainer}>
            <Footer />
          </View>
        </ScrollView>
      ) : (
        selectedConversation ? (
          <View style={[styles.container, styles.mobileContainer]}>
            <View style={styles.mobileChatDetailWrapper}>
              {ChatDetail}
            </View>
          </View>
        ) : (
          <PageLayout
            refreshing={isRefreshingConversations}
            onRefresh={() => loadConversations(1, false, true)}
          >
            {ChatList}
          </PageLayout>
        )
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
    overflow: 'hidden',
    width: '100%',
  },
  mobileContainer: {
    paddingTop: HEADER_HEIGHT,
  },
  mobileChatDetailWrapper: {
    flex: 1,
    overflow: 'hidden',
    width: '100%',
  },
  desktopScroll: {
    backgroundColor: Colors.light.background,
    height: '100vh',
  },
  desktopScrollContent: {
    backgroundColor: Colors.light.background,
  },
  desktopHomeWrapper: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    width: '100%',
    alignSelf: 'center',
    position: 'relative',
  },
  desktopMainContent: {
    width: '100%',
    maxWidth: 1000,
    position: 'relative',
  },
  desktopMaxWidth: {
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    ...Shadows.medium,
    overflow: 'hidden',
    height: 'calc(100vh - 120px)',
    marginTop: 20,
    marginBottom: 20,
  },
  desktopFooterContainer: {
    backgroundColor: Colors.light.background,
  },
  desktopLayout: {
    flex: 1,
    flexDirection: 'row',
  },
  listContainer: {
    flex: 1,
    borderRightWidth: 1,
    borderRightColor: Colors.light.border,
    backgroundColor: '#FFF',
    overflow: 'hidden',
  },
  desktopList: {
    maxWidth: 350,
  },
  listHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: Colors.light.background,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F3F5',
    borderRadius: 12,
    padding: 4,
  },
  deleteAllButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 44,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.light.text,
    ...Platform.select({
      web: { outlineStyle: 'none' }
    }),
  },
  clearSearchButton: {
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#FFFFFF',
    ...Shadows.subtle,
  },
  tabText: {
    fontSize: 15,
    color: Colors.light.textSecondary,
    fontWeight: '500',
  },
  activeTabText: {
    color: Colors.light.primary,
    fontWeight: '600',
  },
  tabLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  tabUnreadBadge: {
    backgroundColor: Colors.light.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabUnreadBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyList: {
    padding: 40,
    alignItems: 'center',
  },
  emptyListText: {
    color: Colors.light.textSecondary,
  },
  chatItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    alignItems: 'center',
    gap: 12,
  },
  selectedChatItem: {
    backgroundColor: Colors.light.primaryLight,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.light.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.light.primary,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.light.primary,
  },
  chatInfo: {
    flex: 1,
    gap: 2,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  chatItemTitle: {
    flex: 1,
    minWidth: 0,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
  },
  conversationAdTitle: {
    fontSize: 12,
    color: Colors.light.primary,
    marginTop: 2,
  },
  timestamp: {
    flexShrink: 0,
    maxWidth: '46%',
    fontSize: 11,
    lineHeight: 14,
    textAlign: 'right',
    color: Colors.light.textSecondary,
  },
  lastMessage: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  unreadBadge: {
    backgroundColor: Colors.light.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  detailContainer: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    width: '100%',
  },
  detailHeaderMobile: {
    paddingTop: 0,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: Colors.light.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    gap: 12,
    ...Shadows.subtle,
  },
  backButton: {
    padding: 14,
    marginLeft: 4,
  },
  headerUser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  smallAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.light.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  smallAvatarText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.light.primary,
  },
  headerUserName: {
    fontSize: 15,
    fontWeight: '600',
    maxWidth: 200,
  },
  headerRole: {
    fontSize: 11,
    color: Colors.light.textSecondary,
  },
  messageList: {
    padding: 16,
    gap: 12,
    flexGrow: 1,
  },
  messageRow: {
    flexDirection: 'row',
    width: '100%',
    marginBottom: 4,
  },
  myMessageRow: {
    justifyContent: 'flex-end',
  },
  otherMessageRow: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    ...Shadows.subtle,
  },
  myBubble: {
    backgroundColor: Colors.light.primary,
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: Colors.light.background,
    borderBottomLeftRadius: 4,
  },
  failedBubble: {
    borderWidth: 1,
    borderColor: '#E53935',
  },
  messageAd: {
    marginBottom: 8,
  },
  messageAdCard: {
    maxWidth: '100%',
    width: '100%',
    minWidth: 250,
  },
  messageText: {
    fontSize: 15,
  },
  myMessageText: {
    color: '#FFFFFF',
  },
  otherMessageText: {
    color: Colors.light.text,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  messageTimestamp: {
    fontSize: 10,
    lineHeight: 13,
    opacity: 0.85,
    maxWidth: '100%',
    flexShrink: 1,
    textAlign: 'right',
    color: Colors.light.textSecondary,
  },
  inputContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.light.background,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  attachButton: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  textInputWrapper: {
    flex: 1,
    backgroundColor: '#F1F3F5',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
  },
  input: {
    fontSize: 15,
    maxHeight: 100,
    ...Platform.select({
      web: { outlineStyle: 'none' }
    }),
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.light.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.subtle,
  },
  sendButtonDisabled: {
    backgroundColor: Colors.light.border,
    opacity: 0.6,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    padding: 40,
  },
  emptyText: {
    textAlign: 'center',
    color: Colors.light.textSecondary,
    fontSize: 16,
  },
  loadingMessagesContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    width: '100%',
    maxWidth: 500,
    height: 600,
    overflow: 'hidden',
    ...Shadows.prominent,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F3F5',
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.light.text,
  },
  modalCloseButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  modalSearchContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: '#FFF',
  },
  modalSearchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    gap: 12,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.light.text,
    ...Platform.select({
      web: { outlineStyle: 'none' }
    }),
  },
  clearButton: {
    padding: 4,
  },
  modalBody: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    flex: 1,
  },
  modalAdItem: {
    marginBottom: 12,
  },
  modalAdCard: {
    maxWidth: '100%',
  },
  modalEmpty: {
    padding: 48,
    alignItems: 'center',
    gap: 12,
  },
  modalEmptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  loginButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: Colors.light.primary,
    borderRadius: 8,
  },
  loginButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  pendingAdContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F0F4F8',
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  pendingAdWrapper: {
    flexDirection: 'row',
    alignItems: 'stretch',
    position: 'relative',
    minHeight: 70,
  },
  pendingAdPressable: {
    flex: 1,
  },
  pendingAdCard: {
    flex: 1,
    marginRight: 40,
    maxWidth: 'none',
    width: '100%',
    minHeight: 70,
    padding: 8,
    gap: 10,
  },
  pendingAdImage: {
    width: 50,
    height: 50,
    borderRadius: 6,
  },
  removeAdButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: Colors.light.primary,
    borderRadius: 16,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.subtle,
  },
  loadMoreContainer: {
    padding: 16,
    alignItems: 'center',
  },
  loadMoreButton: {
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    ...Shadows.subtle,
  },
  loadMoreText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  loadMoreMessagesContainer: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadMoreMessagesButton: {
    backgroundColor: Colors.light.background,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    ...Shadows.subtle,
  },
  loadMoreMessagesText: {
    color: Colors.light.primary,
    fontSize: 14,
    fontWeight: '600',
  },
});
