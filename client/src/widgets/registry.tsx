// Auto-generated registry: maps Widget.type → renderer component.
  // Each widget renderer accepts at minimum { widget }, and optionally
  // onToggle24Hour / onUpdate.
  import React from 'react';
  import type { Widget, WidgetType } from './shared';
  import { ClockWidget } from './clock-widget';
  import { WorldClocksWidget } from './world-clocks-widget';
  import { CountdownWidget } from './countdown-widget';
  import { CrisisTickerWidget } from './crisis-ticker-widget';
  import { MarketsTickerWidget } from './markets-ticker-widget';
  import { WeatherWidget } from './weather-widget';
  import { DictionaryWidget } from './dictionary-widget';
  import { QRGeneratorWidget } from './qr-generator-widget';
  import { GitHubPulseWidget } from './github-pulse-widget';
  import { RSSHeadlinesWidget } from './rss-headlines-widget';
  import { HabitTrackerWidget } from './habit-tracker-widget';
  import { QuickLaunchWidget } from './quick-launch-widget';
  import { BigTextMarqueeWidget } from './big-text-marquee-widget';
  import { NetworkLightWidget } from './network-light-widget';
  import { PhotoLoopWidget } from './photo-loop-widget';

  export interface WidgetRendererArgs {
    widget: Widget;
    onToggle24Hour: (widgetId: string) => void;
    onColorChange?: (widgetId: string, color: string) => void;
    onUpdate?: (widgetId: string, patch: Partial<Widget>) => void;
  }

  // Renderer registry keyed by widget type. Returning null/false means
  // "this widget type is rendered elsewhere" (e.g. video / note / spacer
  // / image are still handled inline by dashboard.tsx).
  type Renderer = (args: WidgetRendererArgs) => React.ReactElement | null | false;

  export const WIDGET_RENDERERS: Partial<Record<WidgetType, Renderer>> = {
    clock: ({ widget, onToggle24Hour, onUpdate }) => (
      <ClockWidget key={widget.id} widget={widget} onToggle24Hour={onToggle24Hour} onUpdate={onUpdate} />
    ),
    world_clocks: ({ widget, onUpdate }) => (
      <WorldClocksWidget key={widget.id} widget={widget} onUpdate={onUpdate} />
    ),
    countdown: ({ widget, onUpdate }) => (
      <CountdownWidget key={widget.id} widget={widget} onUpdate={onUpdate} />
    ),
    crisis_ticker: ({ widget, onUpdate }) => (
      <CrisisTickerWidget key={widget.id} widget={widget} onUpdate={onUpdate} />
    ),
    markets_ticker: ({ widget, onUpdate }) => (
      <MarketsTickerWidget key={widget.id} widget={widget} onUpdate={onUpdate} />
    ),
    weather: ({ widget }) => <WeatherWidget key={widget.id} widget={widget} />,
    dictionary: ({ widget, onUpdate }) => (
      <DictionaryWidget key={widget.id} widget={widget} onUpdate={onUpdate} />
    ),
    qr_generator: ({ widget, onUpdate }) => (
      <QRGeneratorWidget key={widget.id} widget={widget} onUpdate={onUpdate} />
    ),
    github_pulse: ({ widget, onUpdate }) => (
      <GitHubPulseWidget key={widget.id} widget={widget} onUpdate={onUpdate} />
    ),
    rss_headlines: ({ widget, onUpdate }) => (
      <RSSHeadlinesWidget key={widget.id} widget={widget} onUpdate={onUpdate} />
    ),
    habit_tracker: ({ widget, onUpdate }) => (
      <HabitTrackerWidget key={widget.id} widget={widget} onUpdate={onUpdate} />
    ),
    quick_launch: ({ widget, onUpdate }) => (
      <QuickLaunchWidget key={widget.id} widget={widget} onUpdate={onUpdate} />
    ),
    big_text_marquee: ({ widget, onUpdate }) => (
      <BigTextMarqueeWidget key={widget.id} widget={widget} onUpdate={onUpdate} />
    ),
    network_light: ({ widget, onUpdate }) => (
      <NetworkLightWidget key={widget.id} widget={widget} onUpdate={onUpdate} />
    ),
    photo_loop: ({ widget, onUpdate }) => (
      <PhotoLoopWidget key={widget.id} widget={widget} onUpdate={onUpdate} />
    ),
    // Inline-rendered by dashboard.tsx (kept here so the registry stays
    // exhaustive against WidgetType for compile-time safety):
    video: () => false,
    note: () => false,
    spacer: () => false,
    image: () => false,
  };
  