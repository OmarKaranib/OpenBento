import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Footer } from "@/components/footer";

export default function Privacy() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-950">
      <div className="flex-1 py-12 px-6">
        <div className="max-w-3xl mx-auto">
          <Link href="/" className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 mb-8 transition-colors" data-testid="link-back-home">
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          
          <h1 className="text-3xl font-bold text-white mb-8">Privacy Policy</h1>
          
          <div className="prose prose-invert prose-slate max-w-none">
            <p className="text-slate-300 mb-6">
              Last updated: February 2026
            </p>
            
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-white mb-4">1. Information We Collect</h2>
              <p className="text-slate-300">
                We collect information you provide directly to us, such as when you create an account, subscribe to our service, or contact us for support.
              </p>
            </section>
            
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-white mb-4">2. How We Use Your Information</h2>
              <p className="text-slate-300">
                We use the information we collect to provide, maintain, and improve our services, process transactions, and communicate with you.
              </p>
            </section>
            
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-white mb-4">3. Information Sharing</h2>
              <p className="text-slate-300">
                We do not sell, trade, or otherwise transfer your personally identifiable information to third parties without your consent, except as described in this policy.
              </p>
            </section>
            
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-white mb-4">4. Data Security</h2>
              <p className="text-slate-300">
                We implement appropriate security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.
              </p>
            </section>
            
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-white mb-4">5. Contact</h2>
              <p className="text-slate-300">
                For questions about this Privacy Policy, please contact ANCU LABS FZC LLC.
              </p>
            </section>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
