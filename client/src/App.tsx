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

import React, { useEffect, lazy, Suspense } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { Switch, Route } from 'wouter';
import { queryClient } from './lib/queryClient';
import { MobileGuard } from '@/components/mobile-guard';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
const DashboardShell = lazy(() =>
  import('@/dashboard/dashboard-shell').then(({ DashboardShell }) => ({ default: DashboardShell })),
);
const NotFound = lazy(() => import('@/pages/not-found'));
const Admin = lazy(() => import('@/pages/admin'));
const Terms = lazy(() => import('@/pages/terms'));
const Privacy = lazy(() => import('@/pages/privacy'));
const Feedback = lazy(() => import('@/pages/feedback'));
const DevWidgets = lazy(() => import('@/pages/dev-widgets'));
const Marketplace = lazy(() => import('@/pages/marketplace'));
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
          <Suspense fallback={<div className="w-screen h-screen bg-slate-950" />}>
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
              <Route path="/cast" component={CastPage} />
              <Route component={NotFound} />
            </Switch>
          </Suspense>
          <Toaster />
        </TooltipProvider>
      </MobileGuard>
    </QueryClientProvider>
  );
}

export default App;
