import { z } from 'zod';

export const streamHealRequestSchema = z.object({
  channelId: z.string().trim().min(1).max(200),
  channelName: z.string().trim().min(1).max(200),
  currentVideoId: z.string().trim().min(1).max(128).optional(),
}).strict();

export type StreamHealRequest = z.infer<typeof streamHealRequestSchema>;
