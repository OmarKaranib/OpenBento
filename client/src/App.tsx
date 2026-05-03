// App.tsx — top-level provider shell.
  //
  // Heavy lifting lives elsewhere after the widget-modularization refactor:
  //   - Per-widget components: client/src/widgets/<widget>.tsx
  //   - Widget data model + shared helpers: client/src/widgets/shared.tsx
  //   - Renderer dispatch + registry: client/src/widgets/widget-renderer.tsx
  //     and client/src/widgets/registry.tsx
  //   - Cloud-sync hook: client/src/dashboard/use-cloud-sync.ts
  //   - Auth/DnD/routing shell + add/edit/move callbacks:
  //     client/src/dashboard/dashboard-shell.tsx
  //
  // Widget, WidgetType, and WidgetRenderer are re-exported below so existing
  // callers (pages/dashboard.tsx, pages/cast.tsx, data/starter-packs.ts,
  // components/widget-sidebar.tsx, components/onboarding-flow.tsx,
  // components/ad-block.tsx) keep working without import-path churn.

  import React, { useEffect } from 'react';
  import { QueryClientProvider } from '@tanstack/react-query';
  import { queryClient } from './lib/queryClient';
  import { MobileGuard } from '@/components/mobile-guard';
  import { DashboardShell } from '@/dashboard/dashboard-shell';
  import type { Widget, WidgetType } from '@/widgets/shared';
  import { WidgetRenderer } from '@/widgets/widget-renderer';

  // ─── Static background ────────────────────────────────────────────────────────
  // Resets the document body to a flat off-white. Lives here (rather than in
  // dashboard-shell) so it runs once at the App level regardless of route.
  const StaticBackground = () => {
    useEffect(() => {
      const body = document.body;
      body.style.backgroundColor = '#F8F9FA';
      body.style.backgroundImage = 'none';
      body.style.backgroundSize = 'cover';
      body.style.backgroundPosition = 'center';
      body.style.backgroundAttachment = 'fixed';
      body.style.minHeight = '100vh';
    }, []);
    return null;
  };

  function App() {
    return (
      <QueryClientProvider client={queryClient}>
        <MobileGuard>
          <StaticBackground />
          <DashboardShell />
        </MobileGuard>
      </QueryClientProvider>
    );
  }

  // ── Backward-compatible re-exports ──────────────────────────────────────────
  export type { Widget, WidgetType };
  export { WidgetRenderer };

  export default App;
  