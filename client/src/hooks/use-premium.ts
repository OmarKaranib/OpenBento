import { useQuery } from '@tanstack/react-query';
import { useAuth } from './use-auth';

interface PremiumStatus {
  isPremium: boolean;
  userId: string | null;
}

export function usePremium() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const { data, isLoading } = useQuery<PremiumStatus>({
    queryKey: ['/api/user/premium-status', user?.id],
    enabled: isAuthenticated && !!user?.id,
    staleTime: 60000,
    refetchOnWindowFocus: true,
  });

  return {
    isPremium: data?.isPremium ?? false,
    isLoading: authLoading || isLoading,
    userId: user?.id ?? null,
  };
}
