export interface NotificationTemplate {
  sms: {
    message: (params: any) => string;
    templateId?: string;
  };
  push: {
    title: (params: any) => string;
    body: (params: any) => string;
  };
  email: {
    subject: (params: any) => string;
    body: (params: any) => string;
  };
  db: {
    title: (params: any) => string;
    message: (params: any) => string;
  };
}

export const notificationTemplates = {
  otp: {
    pinnpost: {
      sms: {
        message: ({ otp }: { otp: string }) =>
          `Dear Customer, ${otp} is the OTP for verification and is valid for next 5mins. Thank you for your interest to join with us - Team Pin N Post`,
        templateId: '1107177312735739921'
      }
    },
    inaipro: {
      sms: {
        message: ({ otp }: { otp: string }) =>
          `Dear Customer, ${otp} is the OTP for verification and is valid for next 5mins. Thank you for your interest to join with us - Team INAIPRO.`,
        templateId: '1007252656934275551'
      }
    }
  },
  
  adApproved: {
    sms: {
      message: ({ adTitle, expiryDate }: { adTitle: string, expiryDate?: string }) =>
        `Ad Approved: Your ad ${adTitle} has been approved and will remain live until ${expiryDate || 'N/A'} - PIN N POST`,
      templateId: '1107177312764255571'
    },
    push: {
      title: (params: any) => 'Ad Approved Successfully',
      body: ({ adTitle }: { adTitle: string }) => `Your advertisement "${adTitle}" has been approved and is now live.`
    },
    email: {
      subject: ({ adTitle }: { adTitle: string }) => `Great news! Your advertisement "${adTitle}" is now live`,
      body: ({ adTitle, adId, expiryDate }: { adTitle: string, adId: string, expiryDate?: string }) => `
        <p>We are pleased to inform you that your advertisement <strong>"${adTitle}"</strong> has passed our moderation process and is now live on Pin N Post.</p>
        <p>Your listing is now visible to potential buyers in your area. You can track views, manage inquiries, and edit your ad details directly from your dashboard.</p>
        <p><strong>Ad Details:</strong><br/>
        ID: ${adId}<br/>
        Status: Active<br/>
        Expires On: ${expiryDate || 'N/A'}</p>
        <p>Thank you for being a valued member of the Pin N Post community. We wish you a successful sale!</p>
      `
    },
    db: {
      title: () => 'Advertisement Approved',
      message: ({ adTitle }: { adTitle: string }) => `Your advertisement "${adTitle}" has been approved and is now visible to potential buyers.`
    }
  },
  
  adRejected: {
    sms: {
      message: ({ adTitle }: { adTitle: string }) =>
        `Ad Rejected: Please edit the ad ${adTitle} and resubmit for approval-PIN N POST`,
      templateId: '1107177313025579557'
    },
    push: {
      title: (params: any) => 'Ad Review Update',
      body: ({ adTitle }: { adTitle: string }) => `Your ad "${adTitle}" requires revisions before it can be published.`
    },
    email: {
      subject: ({ adTitle }: { adTitle: string }) => `Action Required: Revisions needed for your ad "${adTitle}"`,
      body: ({ adTitle, rejectionReason }: { adTitle: string, rejectionReason?: string }) => `
        <p>Thank you for submitting your advertisement <strong>"${adTitle}"</strong>. Our moderation team has reviewed your listing and found that it requires a few adjustments before it can be published.</p>
        <div style="background-color: #fff4f4; border-left: 4px solid #d9534f; padding: 15px; margin: 20px 0;">
          <p style="margin: 0; color: #a94442;"><strong>Reason for rejection:</strong><br/>
          ${rejectionReason || 'The content does not align with our community safety guidelines or is missing critical information.'}</p>
        </div>
        <p>Don't worry—you can easily fix this. Simply log in to your account, navigate to "My Ads", and select "Edit" on the rejected listing. Once you've made the necessary changes, resubmit it and we will prioritize its re-review.</p>
        <p>If you have any questions regarding this decision, please feel free to contact our support team.</p>
      `
    },
    db: {
      title: () => 'Advertisement Requires Revision',
      message: ({ adTitle }: { adTitle: string }) => `Your advertisement "${adTitle}" requires revisions before it can be published. Please check your email for details.`
    }
  },
  
  adReview: {
    sms: {
      message: ({ adTitle }: { adTitle: string }) =>
        `Thank you for submitting your ad "${adTitle}". It is now under review. We will notify you as soon as the review process is complete - PIN N POST`,
      templateId: '1107177312753066678'
    },
    push: {
      title: (params: any) => 'Ad Received',
      body: ({ adTitle }: { adTitle: string }) => `Your ad "${adTitle}" has been received and is currently under review.`
    },
    email: {
      subject: ({ adTitle }: { adTitle: string }) => `We've received your ad "${adTitle}"`,
      body: ({ adTitle }: { adTitle: string }) => `
        <p>Thank you for posting on Pin N Post. Your advertisement <strong>"${adTitle}"</strong> has been successfully submitted and is currently being reviewed by our moderation team.</p>
        <p>We perform these reviews to maintain a safe and high-quality marketplace for everyone. This process typically takes between 1 to 4 hours during business periods.</p>
        <p>You will receive another notification as soon as your ad goes live or if we need any additional information from you. In the meantime, you can preview how your ad looks in your dashboard.</p>
      `
    },
    db: {
      title: () => 'Advertisement Under Review',
      message: ({ adTitle }: { adTitle: string }) => `Your advertisement "${adTitle}" has been submitted and is currently under review.`
    }
  },
  
  adExpired: {
    sms: {
      message: ({ adTitle }: { adTitle: string }) =>
        `The listing for ad ${adTitle} has reached the end of its active period. Visit PIN N POST to check its current status and available options.`,
      templateId: '1107178029098660566'
    },
    push: {
      title: (params: any) => 'Ad Expired',
      body: ({ adTitle }: { adTitle: string }) => `Your ad "${adTitle}" has expired. Renew it now to maintain its visibility.`
    },
    email: {
      subject: ({ adTitle }: { adTitle: string }) => `Important: Your ad "${adTitle}" has expired`,
      body: ({ adTitle }: { adTitle: string }) => `
        <p>This is a notification that your advertisement <strong>"${adTitle}"</strong> has reached its scheduled expiration date and has been automatically deactivated.</p>
        <p>If you haven't sold your item yet, we recommend renewing the listing to keep it visible to potential buyers. Renewing will bring your ad back to the top of the search results, increasing your chances of a successful transaction.</p>
        <p>Simply visit your "Expired Ads" section in the dashboard to reactivate it with a single click.</p>
      `
    },
    db: {
      title: () => 'Advertisement Expired',
      message: ({ adTitle }: { adTitle: string }) => `Your advertisement "${adTitle}" has expired. You can renew it to make it visible again.`
    }
  },
  
  adExtended: {
    sms: {
      message: ({ adTitle, days, expiryDate }: { adTitle: string, days: number, expiryDate: string }) =>
        `Your ad "${adTitle}" has been extended by ${days} days. It's now live until ${expiryDate} - PIN N POST`,
      templateId: '1107177313058630883'
    },
    push: {
      title: (params: any) => 'Ad Duration Extended',
      body: ({ adTitle, days }: { adTitle: string, days: number }) => `Your ad "${adTitle}" has been successfully extended for an additional ${days} days.`
    },
    email: {
      subject: ({ adTitle }: { adTitle: string }) => `Confirmation: Your ad "${adTitle}" has been extended`,
      body: ({ adTitle, days, expiryDate }: { adTitle: string, days: number, expiryDate: string }) => `
        <p>This email confirms that the visibility of your advertisement <strong>"${adTitle}"</strong> has been successfully extended.</p>
        <p><strong>Extension Details:</strong><br/>
        Duration Added: ${days} Days<br/>
        New Expiry Date: ${expiryDate}</p>
        <p>Your ad will continue to be shown to users looking for products or services like yours. Thank you for continuing to use Pin N Post to reach your customers.</p>
      `
    },
    db: {
      title: () => 'Advertisement Extended',
      message: ({ adTitle, days, expiryDate }: { adTitle: string, days: number, expiryDate: string }) => `Your advertisement "${adTitle}" has been extended by ${days} days and is now valid until ${expiryDate}.`
    }
  },
  
  adWillExpire: {
    sms: {
      message: ({ adTitle, expiryDate }: { adTitle: string, expiryDate: string }) =>
        `Your ad ${adTitle} is scheduled to expire on ${expiryDate}. Current status and ad details are available in your PIN N POST account.`,
      templateId: '1107178029115236717'
    },
    push: {
      title: (params: any) => 'Ad Expiring Soon',
      body: ({ adTitle, days }: { adTitle: string, days?: number }) =>
        days ? `Your ad "${adTitle}" will expire in ${days} days. Renew it now to stay live.` : `Your ad "${adTitle}" is set to expire soon. Renew it now to stay live.`
    },
    email: {
      subject: ({ adTitle, days }: { adTitle: string, days?: number }) =>
        days ? `Reminder: Your ad "${adTitle}" expires in ${days} days` : `Reminder: Your advertisement "${adTitle}" is expiring soon`,
      body: ({ adTitle, expiryDate, days }: { adTitle: string, expiryDate: string, days?: number }) => `
        <p>We wanted to send you a quick reminder that your advertisement <strong>"${adTitle}"</strong> is scheduled to expire on <strong>${expiryDate}</strong>${days ? ` (in ${days} days)` : ''}.</p>
        <p>To ensure that you don't miss out on potential inquiries, we recommend renewing your listing before it deactivates. Keeping your ad live ensures continuous exposure to our growing community of buyers.</p>
        <p>Log in to your dashboard now to extend your listing's duration and maintain your market presence.</p>
      `
    },
    db: {
      title: ({ days }: { days?: number }) => days ? `Advertisement Expires in ${days} Days` : 'Advertisement Expiring Soon',
      message: ({ adTitle, expiryDate, days }: { adTitle: string, expiryDate: string, days?: number }) =>
        days ? `Your advertisement "${adTitle}" will expire in ${days} days (${expiryDate}). Renew it to maintain visibility.` : `Your advertisement "${adTitle}" will expire on ${expiryDate}. Renew it to maintain visibility.`
    }
  }
};
