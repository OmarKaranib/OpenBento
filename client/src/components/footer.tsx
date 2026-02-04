import { Link } from "wouter";

export function Footer() {
  return (
    <footer className="w-full py-4 px-6 bg-slate-900/80 border-t border-slate-700/50 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-slate-400 text-sm">
          © 2026 ANCU LABS FZC LLC. All rights reserved.
        </p>
        <div className="flex items-center gap-6">
          <Link 
            href="/terms" 
            className="text-slate-400 text-sm transition-colors hover-elevate rounded px-2 py-1"
            data-testid="link-terms"
          >
            Terms of Service
          </Link>
          <Link 
            href="/privacy" 
            className="text-slate-400 text-sm transition-colors hover-elevate rounded px-2 py-1"
            data-testid="link-privacy"
          >
            Privacy Policy
          </Link>
        </div>
      </div>
    </footer>
  );
}
