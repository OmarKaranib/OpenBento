import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Footer } from "@/components/footer";
import { usePageMeta } from "@/hooks/use-page-meta";

export default function Terms() {
  usePageMeta({
    title: "Terms of Service",
    description:
      "Read the OpenBento Dashboard Terms of Service: account responsibilities, subscriptions, refunds, acceptable use, and contact details.",
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
                related information widgets. The Service is offered in a free tier and
                a paid Pro tier.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">3. Account Responsibilities</h2>
              <p>
                You may use OpenBento as a guest, but creating an account unlocks
                cross-device sync and the personal channel library. You are responsible
                for maintaining the confidentiality of your account credentials and for
                any activity that occurs under your account. Notify us immediately of
                any unauthorized use.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">4. Subscriptions, Billing &amp; Cancellation</h2>
              <p>
                Pro subscriptions are billed on a recurring monthly or yearly basis
                through our payment processor, Stripe. By subscribing you authorize us
                to charge the payment method on file at the start of each billing
                period until you cancel.
              </p>
              <p>
                You can cancel anytime from the in-app billing portal. Cancellation
                takes effect at the end of the current paid period; you keep Pro access
                until then. Promo codes (e.g. <em>BENTO2FREE</em>, <em>FREE2BENTO</em>)
                may apply to the first invoice only.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">5. Refund Policy</h2>
              <p>
                Subscription fees are generally non-refundable. If you believe you were
                charged in error or experienced a serious service issue, contact us
                within 14 days of the charge and we will review the request in good
                faith.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">6. Acceptable Use</h2>
              <p>You agree not to:</p>
              <ul className="list-disc list-inside space-y-1 mt-2">
                <li>use the Service to violate any law or third-party right;</li>
                <li>attempt to bypass rate limits, paywall enforcement, or authentication;</li>
                <li>scrape, resell, or redistribute the Service or its underlying data;</li>
                <li>upload content (notes, images) that is unlawful, hateful, or infringing;</li>
                <li>interfere with or disrupt the Service or its infrastructure.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">7. Third-Party Services</h2>
              <p>
                OpenBento embeds and relies on third-party platforms and APIs. Your use
                of those features is also subject to their own terms:
              </p>
              <ul className="list-disc list-inside space-y-1 mt-2">
                <li>YouTube, Twitch, and Kick (video embeds)</li>
                <li>Supabase (authentication and database)</li>
                <li>Stripe (payments and subscription management)</li>
                <li>Resend (transactional email)</li>
                <li>OpenWeatherMap and NewsAPI.org (live data widgets)</li>
              </ul>
              <p className="mt-2">
                We are not responsible for the availability, content, or policies of
                these third parties.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">8. Service Availability</h2>
              <p>
                The Service is provided "as is" and "as available." We do not guarantee
                uninterrupted access; outages may occur due to maintenance, third-party
                API changes, or factors outside our control.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">9. Limitation of Liability</h2>
              <p>
                To the maximum extent permitted by law, ANCU LABS FZC LLC and its
                officers, employees, and contractors will not be liable for any
                indirect, incidental, special, consequential, or punitive damages, or
                any loss of profits or data, arising out of your use of the Service.
                Our total liability for any claim relating to the Service shall not
                exceed the amount you paid us in the twelve (12) months preceding the
                claim.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">10. Changes to These Terms</h2>
              <p>
                We may update these Terms from time to time. Material changes will be
                announced in-app or by email. Continued use of the Service after a
                change constitutes acceptance of the updated Terms.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">11. Governing Law</h2>
              <p>
                These Terms are governed by the laws of the United Arab Emirates,
                without regard to its conflict-of-law principles. Any dispute arising
                from these Terms shall be resolved in the competent courts of the UAE
                free zone in which ANCU LABS FZC LLC is registered.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">12. Contact</h2>
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
