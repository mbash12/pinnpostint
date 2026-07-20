import { userService } from '@/services';
import { useAuthGuard } from '@/utils/auth-guard';

export function useFavoriteToggle() {
  const { checkAuthAndRedirect } = useAuthGuard();

  const toggleFavorite = async (adId: string, isCurrentlyFavorite: boolean): Promise<boolean> => {
    if (!checkAuthAndRedirect()) return false;

    try {
      if (isCurrentlyFavorite) {
        await userService.removeFromWishlist(adId);
      } else {
        await userService.addToWishlist(adId);
      }
      return true;
    } catch {
      return false;
    }
  };

  return { toggleFavorite };
}
