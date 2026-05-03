// Auto-generated registry: maps Widget.type → renderer component.
// Each renderer is a pure function from a normalized props bag to JSX.
//
// Returning `false` means "this widget type needs closure-bound state
// from the dashboard (iframe refs, seek-mode, inline-input state) and
// is therefore rendered inline by pages/dashboard.tsx". `video` is the
// only such type — every other widget renders fully through this map.
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
import { NoteWidget } from './note-widget';
import { SpacerWidget } from './spacer-widget';
import { ImageWidget } from './image-widget';
import { FocusSoundscapeWidget } from './focus-soundscape-widget';
import { WaterTrackerWidget } from './water-tracker-widget';
import { MoodCheckinWidget } from './mood-checkin-widget';
import { StandupRollerWidget } from './standup-roller-widget';
import { LavaLampWidget } from './lava-lamp-widget';
import { SunSkyWidget } from './sun-sky-widget';
import { EarthNightWidget } from './earth-night-widget';
import { IssTrackerWidget } from './iss-tracker-widget';
import { OnThisDayWidget } from './on-this-day-widget';
import { QuoteWidget } from './quote-widget';
import { WordleWidget } from './wordle-widget';
import { TriviaWidget } from './trivia-widget';

export interface WidgetRendererArgs {
  widget: Widget;
  onToggle24Hour: (widgetId: string) => void;
  onColorChange?: (widgetId: string, color: string) => void;
  onUpdate?: (widgetId: string, patch: Partial<Widget>) => void;
  // Surface-level UI state needed by the note widget (dark mode + the
  // dashboard's edit/lock toggle). Optional so other call sites can
  // omit them; the note renderer falls back to safe defaults.
  isDarkMode?: boolean;
  isEditMode?: boolean;
}

// Renderer registry keyed by widget type. Returning `false` means
// "rendered inline by pages/dashboard.tsx" (video — needs iframe refs).
type Renderer = (args: WidgetRendererArgs) => React.ReactElement | null | false;

export const WIDGET_RENDERERS: Record<WidgetType, Renderer> = {
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
  note: ({ widget, onUpdate, isDarkMode, isEditMode }) => (
    <NoteWidget
      key={widget.id}
      widget={widget}
      isDarkMode={isDarkMode ?? false}
      isEditMode={isEditMode ?? false}
      onUpdate={onUpdate ?? (() => {})}
    />
  ),
  spacer: () => <SpacerWidget />,
  image: ({ widget }) => <ImageWidget widget={widget} />,
  focus_soundscape: ({ widget, onUpdate }) => (
    <FocusSoundscapeWidget key={widget.id} widget={widget} onUpdate={onUpdate} />
  ),
  water_tracker: ({ widget, onUpdate }) => (
    <WaterTrackerWidget key={widget.id} widget={widget} onUpdate={onUpdate} />
  ),
  mood_checkin: ({ widget, onUpdate }) => (
    <MoodCheckinWidget key={widget.id} widget={widget} onUpdate={onUpdate} />
  ),
  standup_roller: ({ widget, onUpdate }) => (
    <StandupRollerWidget key={widget.id} widget={widget} onUpdate={onUpdate} />
  ),
  lava_lamp: ({ widget, onUpdate }) => (
    <LavaLampWidget key={widget.id} widget={widget} onUpdate={onUpdate} />
  ),
  sun_sky: ({ widget, onUpdate }) => (
    <SunSkyWidget key={widget.id} widget={widget} onUpdate={onUpdate} />
  ),
  earth_night: ({ widget, onUpdate }) => (
    <EarthNightWidget key={widget.id} widget={widget} onUpdate={onUpdate} />
  ),
  iss_tracker: ({ widget, onUpdate }) => (
    <IssTrackerWidget key={widget.id} widget={widget} onUpdate={onUpdate} />
  ),
  on_this_day: ({ widget, onUpdate }) => (
    <OnThisDayWidget key={widget.id} widget={widget} onUpdate={onUpdate} />
  ),
  quote: ({ widget, onUpdate }) => (
    <QuoteWidget key={widget.id} widget={widget} onUpdate={onUpdate} />
  ),
  wordle: ({ widget, onUpdate }) => (
    <WordleWidget key={widget.id} widget={widget} onUpdate={onUpdate} />
  ),
  trivia: ({ widget, onUpdate }) => (
    <TriviaWidget key={widget.id} widget={widget} onUpdate={onUpdate} />
  ),
  // Closure-bound on dashboard state (iframe refs / seek mode / inline
  // input). Rendered inline by pages/dashboard.tsx via <VideoWidget />.
  video: () => false,
};
