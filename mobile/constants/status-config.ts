/**
 * Standardized status colors for consistent UI across ads and bookings
 */

export const StatusColors = {
  // Success/Active states
  success: {
    backgroundColor: '#10B981', // green-500 solid
    textColor: '#FFFFFF', // white text for contrast
    icon: 'check-circle' as const,
  },

  // Warning/Pending states
  warning: {
    backgroundColor: '#F59E0B', // orange-500 solid
    textColor: '#FFFFFF', // white text for contrast
    icon: 'schedule' as const,
  },

  // Info/Neutral states
  info: {
    backgroundColor: '#3B82F6', // blue-500 solid
    textColor: '#FFFFFF', // white text for contrast
    icon: 'info' as const,
  },

  // Danger/Error states
  danger: {
    backgroundColor: '#EF4444', // red-500 solid
    textColor: '#FFFFFF', // white text for contrast
    icon: 'cancel' as const,
  },

  // Completed states
  completed: {
    backgroundColor: '#3B82F6', // blue-500 solid
    textColor: '#FFFFFF', // white text for contrast
    icon: 'done-all' as const,
  },
};

/**
 * Get booking status configuration
 */
export const getBookingStatusConfig = (status: string) => {
  switch (status) {
    case 'CONFIRMED':
    case 'Confirmed':
      return { ...StatusColors.success, label: 'Confirmed' };

    case 'COMPLETED':
    case 'Completed':
      return { ...StatusColors.completed, label: 'Completed' };

    case 'CANCELLED':
    case 'Cancelled':
    case 'Cancelled By Owner':
      return { ...StatusColors.danger, label: 'Cancelled' };

    case 'REJECTED':
    case 'Rejected':
      return { ...StatusColors.danger, label: 'Rejected' };

    case 'CANCELLATION_REQUESTED':
      return { ...StatusColors.warning, label: 'Cancellation Requested' };

    case 'SUBMITTED':
    case 'Pending':
    default:
      return { ...StatusColors.warning, label: 'Pending' };
  }
};

/**
 * Get ad status configuration
 */
export const getAdStatusConfig = (status: string) => {
  switch (status) {
    case 'APPROVED':
      return StatusColors.success;

    case 'REVIEW':
      return StatusColors.warning;

    case 'EXPIRED':
    case 'REJECTED':
      return StatusColors.danger;

    case 'UNPUBLISHED':
      return StatusColors.info;

    default:
      return StatusColors.info;
  }
};

/**
 * Get complaint status configuration
 */
export const getComplaintStatusConfig = (status: string) => {
  switch (status) {
    case 'OPEN':
      return StatusColors.danger;
    case 'INVESTIGATING':
      return StatusColors.warning;
    case 'RESOLVED':
      return StatusColors.success;
    case 'REJECTED':
      return StatusColors.info;
    default:
      return StatusColors.info;
  }
};
