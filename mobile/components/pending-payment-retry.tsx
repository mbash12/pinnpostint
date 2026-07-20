import { useEffect, useRef } from 'react';
import { retryPendingVerifications } from '@/hooks/use-razorpay';

/**
 * On mount, retries any pending payment verifications that were
 * persisted before a crash or network failure.
 *
 * Renders nothing — purely a side-effect component.
 */
export function PendingPaymentRetry() {
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    retryPendingVerifications().then((count) => {
      if (count > 0) {
        console.log(`[PendingPaymentRetry] Retried ${count} pending verifications`);
      }
    }).catch(() => {
      // Silent — next app start will retry again
    });
  }, []);

  return null;
}
