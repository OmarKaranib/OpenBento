import { useQuery } from '@tanstack/react-query';
import { useAuth } from './use-auth';

// Admin emails that get automatic Pro access
const ADMIN_EMAILS = ['legionofoogabooga@gmail.com', 'omar.karanib@anculabs.com'];

interface PremiumStatus {
  isPremium: boolean;
  userId: string | null;
}

export function usePremium() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  // Check if current user is an admin (gets Pro access immediately)
  const isAdminUser = user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase());

  const { data, isLoading } = useQuery<PremiumStatus>({
    queryKey: ['/api/user/premium-status', user?.id],
    enabled: isAuthenticated && !!user?.id,
    staleTime: 60000,
    refetchOnWindowFocus: true,
  });

  return {
    // Admin users always get Pro access, otherwise check API response
    isPremium: isAdminUser || (data?.isPremium ?? false),
    isLoading: authLoading || isLoading,
    userId: user?.id ?? null,
  };
}
