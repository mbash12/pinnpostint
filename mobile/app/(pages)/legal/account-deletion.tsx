import { useEffect, useState } from 'react';
import { LegalPageContent } from '@/components/shared/legal-page-content';
import { legalService, LegalDocument } from '@/services/legal.service';

export default function AccountDeletionPage() {
  const [doc, setDoc] = useState<LegalDocument | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchContent();
  }, []);

  const fetchContent = async () => {
    try {
      setLoading(true);
      const docResp = await legalService.getDocumentBySlug('account-deletion');
      if (docResp.success && docResp.data) setDoc(docResp.data);
    } finally {
      setLoading(false);
    }
  };

  const content = doc?.content || '';

  return (
    <LegalPageContent
      title="Account Deletion Policy"
      content={content}
      loading={loading}
    />
  );
}
