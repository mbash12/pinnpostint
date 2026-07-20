import { Alert, Share as RNShare } from 'react-native';
import { Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';

export interface ShareContent {
  title: string;
  message?: string;
  url: string;
}

export class ShareService {
  /**
   * Share content using native share on mobile or web share API
   */
  static async share(content: ShareContent): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        // Web platform
        const shareContent = {
          title: content.title,
          text: content.message || content.title,
          url: content.url,
        };

        // Check if Web Share API is available
        if (navigator.share) {
          await navigator.share(shareContent);
        } else {
          // Fallback: copy to clipboard
          await this.copyToClipboard(content.url);
          this.showSuccessMessage('Link copied to clipboard!');
        }
      } else {
        // Native mobile platform
        await RNShare.share({
          title: content.title,
          message: `${content.message || content.title}\n\n${content.url}`,
          url: Platform.OS === 'ios' ? content.url : undefined,
        });
      }
    } catch (error: any) {
      // Handle user cancellation gracefully
      if (error?.message?.includes('cancel') || error?.message?.includes('dismissed')) {
        return;
      }
      
      
      // Fallback for web if copy fails
      if (Platform.OS === 'web') {
        try {
          await this.copyToClipboard(content.url);
          this.showSuccessMessage('Link copied to clipboard!');
        } catch (copyError) {
          this.showErrorMessage('Unable to share. Please copy the link manually.');
        }
      } else {
        this.showErrorMessage('Unable to share at this time.');
      }
    }
  }

  /**
   * Share via email
   */
  static async shareViaEmail(content: ShareContent): Promise<void> {
    const subject = encodeURIComponent(content.title);
    const body = encodeURIComponent(`Check out this article: ${content.title}\n\n${content.url}`);
    
    const emailUrl = `mailto:?subject=${subject}&body=${body}`;
    
    try {
      if (Platform.OS === 'web') {
        window.location.href = emailUrl;
      } else {
        // For mobile, we'll open the mail app using Linking
        const canOpen = await Linking.canOpenURL(emailUrl);
        
        if (canOpen) {
          await Linking.openURL(emailUrl);
        } else {
          this.showErrorMessage('Email app not available');
        }
      }
    } catch (error) {
      this.showErrorMessage('Unable to open email app');
    }
  }

  /**
   * Share via WhatsApp
   */
  static async shareViaWhatsApp(content: ShareContent, phoneNumber?: string): Promise<void> {
    let whatsappUrl = '';
    
    if (phoneNumber) {
      // Clean phone number and add India country code (91) if not present
      const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
      const phoneWithCountryCode = cleanPhone.startsWith('91') 
        ? cleanPhone 
        : `91${cleanPhone.replace(/^0/, '')}`;
      
      const message = encodeURIComponent(`${content.message || content.title}\n\n${content.url}`);
      whatsappUrl = Platform.OS === 'web'
        ? `https://wa.me/${phoneWithCountryCode}?text=${message}`
        : `whatsapp://send?phone=${phoneWithCountryCode}&text=${message}`;
    } else {
      // Share without phone number (user selects contact)
      const message = encodeURIComponent(`${content.message || content.title}\n\n${content.url}`);
      whatsappUrl = Platform.OS === 'web'
        ? `https://wa.me/?text=${message}`
        : `whatsapp://send?text=${message}`;
    }

    try {
      if (Platform.OS === 'web') {
        window.open(whatsappUrl, '_blank');
      } else {
        // Try direct app deep link first
        const canOpen = await Linking.canOpenURL(whatsappUrl);
        if (canOpen) {
          await Linking.openURL(whatsappUrl);
        } else {
          // Fallback to wa.me browser link
          const webUrl = phoneNumber 
            ? whatsappUrl.replace('whatsapp://', 'https://wa.me/')
            : whatsappUrl.replace('whatsapp://', 'https://wa.me/?text=');
          await Linking.openURL(webUrl);
        }
      }
    } catch (error) {
      this.showErrorMessage('Unable to share via WhatsApp');
    }
  }

  /**
   * Copy URL to clipboard
   */
  private static async copyToClipboard(text: string): Promise<void> {
    if (Platform.OS === 'web') {
      await navigator.clipboard.writeText(text);
    } else {
      await Clipboard.setStringAsync(text);
    }
  }

  /**
   * Show success message
   */
  private static showSuccessMessage(message: string): void {
    if (Platform.OS === 'web') {
      // Show a simple notification or toast on web
      const toast = document.createElement('div');
      toast.textContent = message;
      toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background-color: #4CAF50;
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        z-index: 1000;
        font-family: system-ui;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      `;
      
      document.body.appendChild(toast);
      
      setTimeout(() => {
        document.body.removeChild(toast);
      }, 3000);
    } else {
      Alert.alert('Success', message);
    }
  }

  /**
   * Show error message
   */
  private static showErrorMessage(message: string): void {
    if (Platform.OS === 'web') {
      const toast = document.createElement('div');
      toast.textContent = message;
      toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background-color: #F44336;
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        z-index: 1000;
        font-family: system-ui;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      `;
      
      document.body.appendChild(toast);
      
      setTimeout(() => {
        document.body.removeChild(toast);
      }, 3000);
    } else {
      Alert.alert('Error', message);
    }
  }
}