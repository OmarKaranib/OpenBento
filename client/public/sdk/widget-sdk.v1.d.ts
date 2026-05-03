// TypeScript ambient declarations for the OpenBento Widget SDK v1.
// Pair with the JS file at /sdk/widget-sdk.v1.js.

export interface OpenBentoThemeBundle {
  dark: boolean;
  accent: string;
  customColor: string | null;
  bg: string | null;
}

export interface OpenBentoResizeEvent {
  w: number;
  h: number;
}

export interface OpenBentoMeta {
  name?: string;
  version?: string;
}

export interface OpenBentoSDK {
  readonly PROTOCOL_VERSION: 1;
  ready(meta?: OpenBentoMeta): void;
  getState<T extends Record<string, unknown> = Record<string, unknown>>(): Promise<T>;
  setState<T extends Record<string, unknown> = Record<string, unknown>>(patch: T): Promise<T>;
  onResize(cb: (ev: OpenBentoResizeEvent) => void): void;
  onTheme(cb: (theme: OpenBentoThemeBundle) => void): void;
  onRefresh(cb: () => void): void;
  requestRefresh(): void;
}

declare global {
  interface Window {
    OpenBento: OpenBentoSDK;
  }
}

export {};
