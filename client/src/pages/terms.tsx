import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Footer } from "@/components/footer";
import { usePageMeta } from "@/hooks/use-page-meta";

export default function Terms() {
  usePageMeta({
    title: "Terms of Service",
    description:
      "Read the OpenBento Dashboard Terms of Service: account responsibilities, acceptable use, and contact details.",
  });

  return (
    <div className="min-h-screen flex flex-col bg-slate-950">
      <div className="flex-1 py-12 px-6">
        <div className="max-w-3xl mx-auto">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 mb-8 transition-colors"
            data-testid="link-back-home"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>

          <h1 className="text-3xl font-bold text-white mb-2" data-testid="heading-terms">
            Terms of Service
          </h1>
          <p className="text-slate-400 mb-8" data-testid="text-last-updated">
            Last updated: May 2026
          </p>

          <div className="prose prose-invert prose-slate max-w-none space-y-8 text-slate-300 leading-relaxed">
            <section>
              <h2 className="text-xl font-semibold text-white mb-3">1. Acceptance of Terms</h2>
              <p>
                By accessing or using the OpenBento Dashboard ("Service"), operated by
                ANCU LABS FZC LLC ("we," "us," or "our"), you agree to be bound by these
                Terms of Service ("Terms"). If you do not agree, please do not use the
                Service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">2. Description of Service</h2>
              <p>
                OpenBento is a customizable, bento-style mission control dashboard for
                monitoring multiple live video streams (YouTube, Twitch, Kick) and
                related information widgets. The Service is offered free of charge to
                all users. There is no paid tier, no subscription, and no usage cap.
                An optional in-app "Buy Me a Coffee" donation prompt is the only
                monetization surface.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">3. Account Responsibilities</h2>
              <p>
                You may use OpenBento as a guest, but creating an account unlocks
                cross-device sync of your widget layout and your personal channel
                library. You are responsible for maintaining the confidentiality of
                your account credentials and for any activity that occurs under your
                account. Notify us immediately of any unauthorized use.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">4. Acceptable Use</h2>
              <p>You agree not to:</p>
              <ul className="list-disc list-inside space-y-1 mt-2">
                <li>use the Service to violate any law or third-party right;</li>
                <li>attempt to bypass rate limits or authentication;</li>
                <li>scrape, resell, or redistribute the Service or its underlying data;</li>
                <li>upload content (notes, images) that is unlawful, hateful, or infringing;</li>
                <li>interfere with or disrupt the Service or its infrastructure.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">5. Third-Party Services</h2>
              <p>
                OpenBento embeds and relies on third-party platforms and APIs. Your use
                of those features is also subject to their own terms:
              </p>
              <ul className="list-disc list-inside space-y-1 mt-2">
                <li>YouTube, Twitch, and Kick (video embeds)</li>
                <li>Supabase (authentication and database)</li>
                <li>Resend (transactional email)</li>
                <li>OpenWeatherMap and NewsAPI.org (live data widgets)</li>
              </ul>
              <p className="mt-2">
                We are not responsible for the availability, content, or policies of
                these third parties.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">6. Service Availability</h2>
              <p>
                The Service is provided "as is" and "as available." We do not guarantee
                uninterrupted access; outages may occur due to maintenance, third-party
                API changes, or factors outside our control.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">7. Limitation of Liability</h2>
              <p>
                To the maximum extent permitted by law, ANCU LABS FZC LLC and its
                officers, employees, and contractors will not be liable for any
                indirect, incidental, special, consequential, or punitive damages, or
                any loss of profits or data, arising out of your use of the Service.
                Because the Service is provided free of charge, our total liability
                for any claim relating to the Service is limited to USD 50.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">8. Changes to These Terms</h2>
              <p>
                We may update these Terms from time to time. Material changes will be
                announced in-app or by email. Continued use of the Service after a
                change constitutes acceptance of the updated Terms.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">9. Governing Law</h2>
              <p>
                These Terms are governed by the laws of the United Arab Emirates,
                without regard to its conflict-of-law principles. Any dispute arising
                from these Terms shall be resolved in the competent courts of the UAE
                free zone in which ANCU LABS FZC LLC is registered.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">10. Contact</h2>
              <p>
                Questions about these Terms? Email ANCU LABS FZC LLC at{" "}
                <a
                  href="mailto:support@openbento.tv"
                  className="text-cyan-400 hover:text-cyan-300"
                  data-testid="link-terms-contact-email"
                >
                  support@openbento.tv
                </a>{" "}
                or use the in-app
                feedback form at <Link href="/feedback" className="text-cyan-400 hover:text-cyan-300">/feedback</Link>.
              </p>
            </section>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
