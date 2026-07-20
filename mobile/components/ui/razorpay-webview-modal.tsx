import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

interface RazorpayWebViewModalProps {
  visible: boolean;
  options: {
    key: string;
    amount: number;
    currency: string;
    name: string;
    description: string;
    order_id: string;
    prefill?: {
      name?: string;
      email?: string;
      contact?: string;
    };
  };
  onSuccess: (data: any) => void;
  onError: (error: string) => void;
  onClose: () => void;
}

export const RazorpayWebViewModal: React.FC<RazorpayWebViewModalProps> = ({
  visible,
  options,
  onSuccess,
  onError,
  onClose,
}) => {
  const webViewRef = useRef<WebView>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Generate HTML content for Razorpay checkout
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
      <style>
        body { margin: 0; padding: 0; background: #fff; }
      </style>
    </head>
    <body>
      <script>
        const options = {
          key: '${options.key}',
          amount: ${options.amount},
          currency: '${options.currency}',
          name: '${options.name}',
          description: '${options.description}',
          order_id: '${options.order_id}',
          prefill: {
            name: '${options.prefill?.name || ''}',
            email: '${options.prefill?.email || ''}',
            contact: '${options.prefill?.contact || ''}'
          },
          theme: { color: '#3399cc' },
          handler: function(response) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'success',
              data: response
            }));
          },
          modal: {
            ondismiss: function() {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'cancelled'
              }));
            }
          }
        };

        const rzp = new Razorpay(options);
        rzp.open();
      </script>
    </body>
    </html>
  `;

  const handleMessage = (event: any) => {
    try {
      const result = JSON.parse(event.nativeEvent.data);

      if (result.type === 'success') {
        onSuccess(result.data);
      } else if (result.type === 'cancelled') {
        onError('Payment cancelled by user');
      }
    } catch (e) {
      // Handle error
    }
  };

  const handleLoad = () => {
    setIsLoading(false);
  };

  const handleError = () => {
    setIsLoading(false);
    onError('Failed to load payment gateway');
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Payment</Text>
          <View style={styles.headerRight} />
        </View>

        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3399cc" />
            <Text style={styles.loadingText}>Loading payment gateway...</Text>
          </View>
        )}

        <WebView
          ref={webViewRef}
          source={{ html: htmlContent }}
          onMessage={handleMessage}
          onLoad={handleLoad}
          onError={handleError}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          style={styles.webView}
        />
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fff',
    zIndex: 10,
  },
  closeButton: {
    padding: 8,
    minWidth: 40,
  },
  closeButtonText: {
    fontSize: 24,
    color: '#333',
    fontWeight: '300',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  headerRight: {
    minWidth: 40,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    zIndex: 5,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  webView: {
    flex: 1,
  },
});
