import { Link } from "wouter";
import { ArrowLeft, Compass } from "lucide-react";
import { Footer } from "@/components/footer";
import { usePageMeta } from "@/hooks/use-page-meta";
import logoUrl from "/t.png";

export default function NotFound() {
  usePageMeta({
    title: "Page Not Found",
    description: "The page you were looking for does not exist on OpenBento.",
  });

  return (
    <div className="min-h-screen w-full flex flex-col bg-slate-950">
      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-xl text-center" data-testid="not-found-card">
          <Link
            href="/"
            className="inline-flex items-center gap-2 mb-10 transition-transform hover:-translate-y-0.5"
            data-testid="link-home-logo"
          >
            <img src={logoUrl} alt="OpenBento" className="h-12 w-auto" />
          </Link>

          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-cyan-500/10 border border-cyan-400/30 mb-8">
            <Compass className="w-10 h-10 text-cyan-400" />
          </div>

          <p className="text-7xl font-extrabold text-cyan-400 mb-4 tracking-tight" data-testid="text-404-code">
            404
          </p>
          <h1 className="text-3xl font-bold text-white mb-4" data-testid="text-404-title">
            Page not found
          </h1>
          <p className="text-slate-400 text-lg mb-10 leading-relaxed" data-testid="text-404-description">
            The page you are looking for does not exist or may have been moved.
            Let us get you back to your dashboard.
          </p>

          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold transition-colors shadow-lg shadow-cyan-900/40"
            data-testid="button-back-to-dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Dashboard
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
