import { useCallback, useEffect, useRef, useState } from 'react';
import { 
  fetchGlobalStreamStatus, 
  requestStreamHeal, 
  getCachedStreamStatus,
  registerStreamChannel 
} from '@/lib/stream-api';

interface HealingState {
  isHealing: boolean;
  lastHealedVideoId?: string;
  healAttempts: number;
  lastError?: string;
}

const HEAL_COOLDOWN_MS = 60000;
const MAX_HEAL_ATTEMPTS = 3;

export function useStreamHealing() {
  const [healingStates, setHealingStates] = useState<Record<string, HealingState>>({});
  const healingCooldowns = useRef<Record<string, number>>({});

  useEffect(() => {
    fetchGlobalStreamStatus();
    
    const interval = setInterval(() => {
      fetchGlobalStreamStatus();
    }, 60000);
    
    return () => clearInterval(interval);
  }, []);

  const getStreamHealth = useCallback((channelId: string) => {
    return getCachedStreamStatus(channelId);
  }, []);

  const triggerHeal = useCallback(async (
    widgetId: string,
    channelId: string,
    channelName: string,
    currentVideoId?: string,
    onHealed?: (newVideoId: string) => void
  ) => {
    const now = Date.now();
    const lastHealTime = healingCooldowns.current[widgetId] || 0;
    
    if (now - lastHealTime < HEAL_COOLDOWN_MS) {
      console.log(`[Healing] Cooldown active for widget ${widgetId}`);
      return false;
    }
    
    const currentState = healingStates[widgetId] || { isHealing: false, healAttempts: 0 };
    
    if (currentState.isHealing) {
      console.log(`[Healing] Already healing widget ${widgetId}`);
      return false;
    }
    
    if (currentState.healAttempts >= MAX_HEAL_ATTEMPTS) {
      console.log(`[Healing] Max attempts reached for widget ${widgetId}`);
      return false;
    }
    
    setHealingStates(prev => ({
      ...prev,
      [widgetId]: { ...currentState, isHealing: true }
    }));
    
    healingCooldowns.current[widgetId] = now;
    
    console.log(`[Healing] Attempting to heal ${channelName} (${channelId})`);
    
    try {
      const result = await requestStreamHeal(channelId, channelName, currentVideoId);
      
      if (result.success && result.newVideoId) {
        console.log(`[Healing] Successfully healed ${channelName} with videoId: ${result.newVideoId}`);
        
        setHealingStates(prev => ({
          ...prev,
          [widgetId]: {
            isHealing: false,
            lastHealedVideoId: result.newVideoId,
            healAttempts: 0,
          }
        }));
        
        onHealed?.(result.newVideoId);
        return true;
      } else {
        console.log(`[Healing] Failed to heal ${channelName}: ${result.reason}`);
        
        setHealingStates(prev => ({
          ...prev,
          [widgetId]: {
            isHealing: false,
            healAttempts: (prev[widgetId]?.healAttempts || 0) + 1,
            lastError: result.reason,
          }
        }));
        
        return false;
      }
    } catch (error) {
      console.error(`[Healing] Error healing ${channelName}:`, error);
      
      setHealingStates(prev => ({
        ...prev,
        [widgetId]: {
          isHealing: false,
          healAttempts: (prev[widgetId]?.healAttempts || 0) + 1,
          lastError: String(error),
        }
      }));
      
      return false;
    }
  }, [healingStates]);

  const registerChannel = useCallback(async (
    channelId: string,
    channelName: string,
    platform: string,
    videoId?: string
  ) => {
    await registerStreamChannel(channelId, channelName, platform, videoId);
  }, []);

  const resetHealAttempts = useCallback((widgetId: string) => {
    setHealingStates(prev => ({
      ...prev,
      [widgetId]: { isHealing: false, healAttempts: 0 }
    }));
    delete healingCooldowns.current[widgetId];
  }, []);

  const getHealingState = useCallback((widgetId: string): HealingState => {
    return healingStates[widgetId] || { isHealing: false, healAttempts: 0 };
  }, [healingStates]);

  return {
    getStreamHealth,
    triggerHeal,
    registerChannel,
    resetHealAttempts,
    getHealingState,
  };
}
