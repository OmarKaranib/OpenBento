// App.tsx — top-level providers + route table.
//
// Heavy lifting lives elsewhere after the widget-modularization refactor:
//   - Per-widget components: client/src/widgets/<widget>.tsx
//   - Widget data model + shared helpers: client/src/widgets/shared.tsx
//   - Renderer dispatch + registry: client/src/widgets/widget-renderer.tsx
//     and client/src/widgets/registry.tsx
//   - Cloud-sync hook: client/src/dashboard/use-cloud-sync.ts
//   - Auth/DnD shell + add/edit/move callbacks:
//     client/src/dashboard/dashboard-shell.tsx
//
// Widget, WidgetType, and WidgetRenderer are re-exported below so existing
// callers (pages/dashboard.tsx, pages/cast.tsx, data/starter-packs.ts,
// components/widget-sidebar.tsx, components/onboarding-flow.tsx,
// components/ad-block.tsx) keep working without import-path churn.

import React, { useEffect, lazy, Suspense } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { Switch, Route } from 'wouter';
import { queryClient } from './lib/queryClient';
import { MobileGuard } from '@/components/mobile-guard';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { DashboardShell } from '@/dashboard/dashboard-shell';
import NotFound from '@/pages/not-found';
import Admin from '@/pages/admin';
import Terms from '@/pages/terms';
import Privacy from '@/pages/privacy';
import Feedback from '@/pages/feedback';
import DevWidgets from '@/pages/dev-widgets';
import Marketplace from '@/pages/marketplace';
import type { Widget, WidgetType } from '@/widgets/shared';
import { WidgetRenderer } from '@/widgets/widget-renderer';

const CastPage = lazy(() => import('@/pages/cast'));

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
        <TooltipProvider>
          <Switch>
            {/* Dashboard routes share the full DashboardShell (sidebar,
                login modal, DnD context, MasterControlDashboard). */}
            <Route path="/"                      component={DashboardShell} />
            <Route path="/auth/callback"         component={DashboardShell} />
            <Route path="/auth/reset-password"   component={DashboardShell} />
            {/* Stateless / page-only routes mount their page directly,
                without instantiating the dashboard tree. */}
            <Route path="/admin"    component={Admin} />
            <Route path="/terms"    component={Terms} />
            <Route path="/privacy"  component={Privacy} />
            <Route path="/feedback" component={Feedback} />
            <Route path="/dev/widgets" component={DevWidgets} />
            <Route path="/widgets" component={Marketplace} />
            <Route path="/cast">
              {() => (
                <Suspense fallback={<div className="w-screen h-screen bg-slate-950" />}>
                  <CastPage />
                </Suspense>
              )}
            </Route>
            <Route component={NotFound} />
          </Switch>
          <Toaster />
        </TooltipProvider>
      </MobileGuard>
    </QueryClientProvider>
  );
}

// ── Backward-compatible re-exports ──────────────────────────────────────────
export type { Widget, WidgetType };
export { WidgetRenderer };

export default App;
