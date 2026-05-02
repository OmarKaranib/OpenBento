import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Footer } from "@/components/footer";
import { usePageMeta } from "@/hooks/use-page-meta";

export default function Privacy() {
  usePageMeta({
    title: "Privacy Policy",
    description:
      "Learn how OpenBento Dashboard collects, uses, and protects your data, plus your GDPR and CCPA rights.",
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

          <h1 className="text-3xl font-bold text-white mb-2" data-testid="heading-privacy">
            Privacy Policy
          </h1>
          <p className="text-slate-400 mb-8" data-testid="text-last-updated">
            Last updated: May 2026
          </p>

          <div className="prose prose-invert prose-slate max-w-none space-y-8 text-slate-300 leading-relaxed">
            <section>
              <p>
                ANCU LABS FZC LLC ("we," "us," or "our") operates the OpenBento
                Dashboard ("Service"). This Privacy Policy explains what personal data
                we collect, why we collect it, who we share it with, and what choices
                you have.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">1. Information We Collect</h2>
              <ul className="list-disc list-inside space-y-2">
                <li>
                  <strong className="text-white">Account data:</strong> email address
                  and authentication identifiers (when you sign up with email/password
                  or Google).
                </li>
                <li>
                  <strong className="text-white">Subscription data:</strong> Pro plan
                  status and limited billing metadata (Stripe customer ID, last 4 of
                  card). Full payment-card details are processed by Stripe and never
                  reach our servers.
                </li>
                <li>
                  <strong className="text-white">Dashboard content:</strong> the
                  layouts, channel selections, notes, and images you save are stored
                  in your browser <code>localStorage</code> by default and synced to
                  our database only when you are signed in.
                </li>
                <li>
                  <strong className="text-white">Feedback submissions:</strong> the
                  message, optional email, and optional screenshot you submit through
                  the in-app feedback form.
                </li>
                <li>
                  <strong className="text-white">Technical data:</strong> IP address,
                  user agent, and request timestamps used for security, rate-limiting,
                  and debugging. Stored in short-lived application logs.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">2. How We Use Your Information</h2>
              <ul className="list-disc list-inside space-y-1">
                <li>Provide, operate, and maintain the Service.</li>
                <li>Authenticate you and sync your dashboard across devices.</li>
                <li>Process Pro subscriptions and prevent payment fraud.</li>
                <li>Respond to feedback, support requests, and service questions.</li>
                <li>Detect, investigate, and prevent abuse of the Service.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">3. Cookies &amp; Local Storage</h2>
              <p>
                We use <code>localStorage</code> and Supabase auth cookies to keep you
                signed in and to remember your widget layout and theme preferences. We
                do not use third-party advertising or cross-site tracking cookies.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">4. Third-Party Processors</h2>
              <p>We share the minimum necessary data with the following processors:</p>
              <ul className="list-disc list-inside space-y-1 mt-2">
                <li>
                  <strong className="text-white">Supabase</strong> (authentication &amp; database) —{" "}
                  <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300">privacy policy</a>
                </li>
                <li>
                  <strong className="text-white">Stripe</strong> (payments) —{" "}
                  <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300">privacy policy</a>
                </li>
                <li>
                  <strong className="text-white">Resend</strong> (transactional email) —{" "}
                  <a href="https://resend.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300">privacy policy</a>
                </li>
                <li>
                  <strong className="text-white">YouTube, Twitch, Kick</strong> (embedded streams)
                </li>
                <li>
                  <strong className="text-white">OpenWeatherMap, NewsAPI.org</strong> (read-only widget data)
                </li>
              </ul>
              <p className="mt-2">
                We never sell your personal data to third parties.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">5. Data Retention</h2>
              <ul className="list-disc list-inside space-y-1">
                <li>Account &amp; subscription data: kept while your account is active and up to 24 months after deletion for legal/accounting reasons.</li>
                <li>Feedback submissions: retained until resolved or 24 months, whichever is shorter.</li>
                <li>Technical logs: rotated automatically within 30 days.</li>
                <li>Local widget data: lives in your browser until you clear it.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">6. Your Rights (GDPR &amp; CCPA)</h2>
              <p>
                Depending on where you live, you may have the right to:
              </p>
              <ul className="list-disc list-inside space-y-1 mt-2">
                <li>access the personal data we hold about you;</li>
                <li>correct inaccurate data;</li>
                <li>request deletion of your account and associated data;</li>
                <li>request a portable export of your data;</li>
                <li>object to or restrict certain processing;</li>
                <li>opt out of the "sale" or "sharing" of personal information (we do not sell or share it).</li>
              </ul>
              <p className="mt-2">
                To exercise any of these rights, email{" "}
                <a
                  href="mailto:support@openbento.tv?subject=Data%20Request"
                  className="text-cyan-400 hover:text-cyan-300"
                  data-testid="link-privacy-email"
                >
                  support@openbento.tv
                </a>{" "}
                with the subject "Data request" or use the
                <Link href="/feedback" className="text-cyan-400 hover:text-cyan-300"> in-app feedback form</Link>.
                We will verify your identity and respond within 30 days.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">7. Data Security &amp; Breach Notification</h2>
              <p>
                We use industry-standard safeguards (TLS in transit, encryption at
                rest via Supabase, restricted admin access). If we become aware of a
                data breach affecting your personal data, we will notify affected
                users without undue delay and, where required, the relevant
                authorities within 72 hours.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">8. Children's Privacy</h2>
              <p>
                OpenBento is not directed at children under 13 (or under 16 in the
                EEA). We do not knowingly collect personal data from children. If you
                believe a child has provided us data, contact us so we can delete it.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">9. Changes to This Policy</h2>
              <p>
                We may update this Privacy Policy from time to time. Material changes
                will be announced in-app or by email. The "Last updated" date at the
                top reflects the most recent revision.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">10. Contact</h2>
              <p>
                Questions or privacy requests? Email ANCU LABS FZC LLC at{" "}
                <a
                  href="mailto:support@openbento.tv"
                  className="text-cyan-400 hover:text-cyan-300"
                  data-testid="link-privacy-contact-email"
                >
                  support@openbento.tv
                </a>{" "}
                or use the
                <Link href="/feedback" className="text-cyan-400 hover:text-cyan-300"> in-app feedback form</Link>.
              </p>
            </section>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
