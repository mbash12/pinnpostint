import { useEffect, useState } from 'react';
import { LegalPageContent } from '@/components/shared/legal-page-content';
import { legalService, LegalDocument, PublicSettings } from '@/services/legal.service';

export default function TermsPage() {
  const [doc, setDoc] = useState<LegalDocument | null>(null);
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchContent();
  }, []);

  const fetchContent = async () => {
    try {
      setLoading(true);
      const [docResp, settingsResp] = await Promise.all([
        legalService.getDocumentBySlug('terms-of-service'),
        legalService.getPublicSettings(),
      ]);
      if (docResp.success && docResp.data) setDoc(docResp.data);
      if (settingsResp.success && settingsResp.data) setSettings(settingsResp.data);
    } finally {
      setLoading(false);
    }
  };

  const content = doc?.content || settings?.termsOfService || '';

  return (
    <LegalPageContent
      title="Terms and Conditions"
      content={content}
      loading={loading}
    />
  );
}
