import { Footer } from './Footer';

export function TermsOfService() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 flex flex-col gap-8">
      <div>
        <h1 className="font-display font-bold text-2xl sm:text-3xl">Terms of Service</h1>
        <p className="mt-2 font-mono text-xs text-muted">Last updated 2026-07-28</p>
      </div>

      <section>
        <h2 className="font-display font-semibold text-lg">The service</h2>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          Punch In is a personal life-tracking app covering workouts, learning, chores, finances, meals,
          health, and goals. It is provided by an individual developer, not a registered company.
        </p>
      </section>

      <section>
        <h2 className="font-display font-semibold text-lg">Eligibility</h2>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          You need a valid Google account to sign in and use Punch In. You are responsible for keeping that
          account secure.
        </p>
      </section>

      <section>
        <h2 className="font-display font-semibold text-lg">Acceptable use</h2>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          Use Punch In only for its intended purpose of tracking your own personal activity. Don't attempt to
          disrupt the service, access another account's data, or use the app for unlawful purposes.
        </p>
      </section>

      <section>
        <h2 className="font-display font-semibold text-lg">No warranty</h2>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          Punch In is provided "as is" and "as available," without warranties of any kind, express or
          implied, including fitness for a particular purpose or uninterrupted availability.
        </p>
      </section>

      <section>
        <h2 className="font-display font-semibold text-lg">Limitation of liability</h2>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          To the maximum extent permitted by law, the operator of Punch In is not liable for any indirect,
          incidental, or consequential damages arising from your use of the service.
        </p>
      </section>

      <section>
        <h2 className="font-display font-semibold text-lg">Termination</h2>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          You may stop using Punch In and request account deletion at any time. We may suspend or terminate
          access if these terms are violated.
        </p>
      </section>

      <section>
        <h2 className="font-display font-semibold text-lg">Changes to these terms</h2>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          If these terms change, we will update the date at the top of this page.
        </p>
      </section>

      <section>
        <h2 className="font-display font-semibold text-lg">Governing law</h2>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          These terms are governed by the applicable mandatory law of your jurisdiction; no specific
          jurisdiction is otherwise asserted.
        </p>
      </section>

      <section>
        <h2 className="font-display font-semibold text-lg">Contact</h2>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          Questions about these terms:{' '}
          <a href="mailto:konathalavamsi123@gmail.com" className="text-primary underline">
            konathalavamsi123@gmail.com
          </a>
          .
        </p>
      </section>

      <Footer />
    </div>
  );
}
