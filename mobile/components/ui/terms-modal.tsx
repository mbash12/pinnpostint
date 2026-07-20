import { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, TouchableOpacity, View, Dimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { RenderHTML, defaultSystemFonts } from 'react-native-render-html';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { legalService, LegalDocument, PublicSettings } from '@/services/legal.service';

// Custom renderers for better list styling
const renderUl = (props: any) => {
  const { TDefaultRenderer, ...defaultProps } = props;
  return (
    <View style={styles.customUl}>
      <TDefaultRenderer {...defaultProps} />
    </View>
  );
};

const renderOl = (props: any) => {
  const { TDefaultRenderer, ...defaultProps } = props;
  return (
    <View style={styles.customOl}>
      <TDefaultRenderer {...defaultProps} />
    </View>
  );
};

const renderLi = (props: any) => {
  const { TDefaultRenderer, ...defaultProps } = props;
  const tnode = props.tnode;
  const parentTag = tnode.parent?.tagName;
  const isOrdered = parentTag === 'ol';

  let index = 1;
  if (isOrdered && tnode.parent) {
    const siblings = tnode.parent.children;
    const liSiblings = siblings.filter((c: any) => c.tagName === 'li');
    index = liSiblings.indexOf(tnode) + 1;
  }

  return (
    <View style={styles.customLi}>
      <View style={styles.markerContainer}>
        {isOrdered ? (
          <ThemedText style={styles.number}>{index}.</ThemedText>
        ) : (
          <ThemedText style={styles.bullet}>•</ThemedText>
        )}
      </View>
      <View style={styles.liContent}>
        <TDefaultRenderer {...defaultProps} />
      </View>
    </View>
  );
};

interface TermsModalProps {
  visible: boolean;
  onClose: () => void;
  type?: 'terms' | 'privacy';
}

export function TermsModal({ visible, onClose, type = 'terms' }: TermsModalProps) {
  const [doc, setDoc] = useState<LegalDocument | null>(null);
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const title = type === 'terms' ? 'Terms and Conditions' : 'Privacy Policy';

  useEffect(() => {
    if (visible) {
      fetchContent();
    }
  }, [visible]);

  const fetchContent = async () => {
    try {
      setLoading(true);
      const slug = type === 'terms' ? 'terms-of-service' : 'privacy-policy';
      const [docResp, settingsResp] = await Promise.all([
        legalService.getDocumentBySlug(slug),
        legalService.getPublicSettings(),
      ]);
      if (docResp.success && docResp.data) setDoc(docResp.data);
      if (settingsResp.success && settingsResp.data) setSettings(settingsResp.data);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const content = doc?.content || settings?.[type === 'terms' ? 'termsOfService' : 'privacyPolicy'] || '';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <ThemedView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <MaterialIcons name="close" size={24} color={Colors.light.text} />
          </TouchableOpacity>
          <ThemedText style={styles.title}>{title}</ThemedText>
          <View style={styles.placeholder} />
        </View>

        {/* Content */}
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.contentContainer}
        >
          {loading ? (
            <ThemedText style={styles.body}>Loading...</ThemedText>
          ) : content ? (
            <RenderHTML
              contentWidth={Dimensions.get('window').width - 80}
              source={{ html: content }}
              baseStyle={styles.htmlContent}
              tagsStyles={tagsStyles}
              systemFonts={defaultSystemFonts}
              renderers={{
                ul: renderUl,
                ol: renderOl,
                li: renderLi,
              }}
              defaultTextProps={{
                selectable: true,
              }}
            />
          ) : (
            <ThemedText style={styles.body}>Document not available.</ThemedText>
          )}
        </ScrollView>
      </ThemedView>
    </Modal>
  );
}

const tagsStyles = {
  body: {
    color: Colors.light.text,
    fontSize: 16,
    lineHeight: 26,
  },
  p: {
    fontSize: 16,
    lineHeight: 26,
    color: Colors.light.text,
    marginBottom: 12,
    marginTop: 0,
    textAlign: 'left',
  },
  h1: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.light.text,
    marginBottom: 12,
    marginTop: 8,
    letterSpacing: -0.5,
  },
  h2: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 16,
    marginTop: 28,
    letterSpacing: -0.3,
  },
  h3: {
    fontSize: 19,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 12,
    marginTop: 20,
    letterSpacing: -0.2,
  },
  h4: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 10,
    marginTop: 16,
  },
  li: {
    fontSize: 16,
    lineHeight: 26,
    color: Colors.light.text,
    marginBottom: 0,
    marginTop: 0,
  },
  ul: {
    marginBottom: 8,
    marginTop: 0,
  },
  ol: {
    marginBottom: 8,
    marginTop: 0,
  },
  strong: {
    fontWeight: '700',
    color: Colors.light.text,
  },
  b: {
    fontWeight: '700',
    color: Colors.light.text,
  },
  em: {
    fontStyle: 'italic',
    color: Colors.light.text,
  },
  i: {
    fontStyle: 'italic',
    color: Colors.light.text,
  },
  a: {
    color: Colors.light.primary,
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
  hr: {
    backgroundColor: Colors.light.border,
    height: 1,
    marginVertical: 24,
  },
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.backgroundSecondary,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.light.text,
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  body: {
    fontSize: 14,
    color: Colors.light.text,
    lineHeight: 22,
  },
  htmlContent: {
    fontSize: 14,
    color: Colors.light.text,
    lineHeight: 22,
  },
  customUl: {
    marginBottom: 12,
    marginTop: 4,
  },
  customOl: {
    marginBottom: 12,
    marginTop: 4,
  },
  customLi: {
    flexDirection: 'row',
    marginBottom: 8,
    marginTop: 0,
    alignItems: 'flex-start',
  },
  markerContainer: {
    width: 24,
    alignItems: 'flex-start',
    paddingTop: 2,
  },
  bullet: {
    color: Colors.light.primary,
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 22,
  },
  number: {
    color: Colors.light.primary,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 24,
  },
  liContent: {
    flex: 1,
  },
});