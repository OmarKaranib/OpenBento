import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Footer } from "@/components/footer";

export default function Terms() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-950">
      <div className="flex-1 py-12 px-6">
        <div className="max-w-3xl mx-auto">
          <Link href="/" className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 mb-8 transition-colors" data-testid="link-back-home">
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          
          <h1 className="text-3xl font-bold text-white mb-8">Terms of Service</h1>
          
          <div className="prose prose-invert prose-slate max-w-none">
            <p className="text-slate-300 mb-6">
              Last updated: February 2026
            </p>
            
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-white mb-4">1. Acceptance of Terms</h2>
              <p className="text-slate-300">
                By accessing and using OpenBento Dashboard, you accept and agree to be bound by the terms and provision of this agreement.
              </p>
            </section>
            
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-white mb-4">2. Description of Service</h2>
              <p className="text-slate-300">
                OpenBento Dashboard provides a customizable mission control interface for monitoring video streams and information. The service includes free and premium tiers with varying features.
              </p>
            </section>
            
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-white mb-4">3. User Accounts</h2>
              <p className="text-slate-300">
                You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.
              </p>
            </section>
            
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-white mb-4">4. Subscription and Payments</h2>
              <p className="text-slate-300">
                Premium subscriptions are billed on a recurring basis. You may cancel your subscription at any time through your account settings.
              </p>
            </section>
            
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-white mb-4">5. Contact</h2>
              <p className="text-slate-300">
                For questions about these Terms of Service, please contact ANCU LABS FZC LLC.
              </p>
            </section>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
