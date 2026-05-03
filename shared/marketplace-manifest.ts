// Widget Marketplace manifest schema.
//
// Loaded from /marketplace/widgets.json at runtime by the public catalog
// page at /widgets. Each entry is validated individually with safeParse so
// one malformed entry does not nuke the entire catalog — invalid entries
// are dropped and surfaced via parseMarketplaceManifest().invalidCount.
//
// Catalog entries point at sandboxed widget URLs that the existing Custom
// Widget host (client/src/widgets/custom-widget.tsx) already knows how to
// run via the Widget SDK postMessage protocol. The marketplace adds no new
// permission surface — it is a discovery layer only.

import { z } from 'zod';
import { isAllowedCustomWidgetUrl } from './widget-sdk-protocol';

export const MARKETPLACE_CATEGORIES = [
  'productivity',
  'fun',
  'utility',
  'data',
  'social',
] as const;
export type MarketplaceCategory = (typeof MARKETPLACE_CATEGORIES)[number];

export const MarketplaceWidgetSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(80),
  author: z.string().min(1).max(80),
  description: z.string().min(1).max(280),
  category: z.enum(MARKETPLACE_CATEGORIES),
  version: z.string().min(1).max(32),
  url: z.string().refine((u) => isAllowedCustomWidgetUrl(u), {
    message: 'URL must pass the custom widget allow-list',
  }),
  iconUrl: z.string().optional(),
  tags: z.array(z.string().max(32)).max(12).optional(),
  homepage: z.string().url().optional(),
});
export type MarketplaceWidget = z.infer<typeof MarketplaceWidgetSchema>;

export const MarketplaceManifestSchema = z.object({
  version: z.literal(1),
  widgets: z.array(z.unknown()),
});

export interface ParsedMarketplaceManifest {
  widgets: MarketplaceWidget[];
  invalidCount: number;
}

/**
 * Parse a raw JSON manifest into a typed widget list.
 * Skips invalid entries individually so one bad row cannot blank the page.
 */
export function parseMarketplaceManifest(raw: unknown): ParsedMarketplaceManifest {
  const outer = MarketplaceManifestSchema.safeParse(raw);
  if (!outer.success) return { widgets: [], invalidCount: 0 };

  const widgets: MarketplaceWidget[] = [];
  let invalidCount = 0;
  const seenIds = new Set<string>();
  for (const entry of outer.data.widgets) {
    const parsed = MarketplaceWidgetSchema.safeParse(entry);
    if (!parsed.success) { invalidCount += 1; continue; }
    if (seenIds.has(parsed.data.id)) { invalidCount += 1; continue; }
    seenIds.add(parsed.data.id);
    widgets.push(parsed.data);
  }
  return { widgets, invalidCount };
}
