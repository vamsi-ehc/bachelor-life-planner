import { Footer } from './Footer';

export function PrivacyPolicy() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 flex flex-col gap-8">
      <div>
        <h1 className="font-display font-bold text-2xl sm:text-3xl">Privacy Policy</h1>
        <p className="mt-2 font-mono text-xs text-muted">Last updated 2026-07-28</p>
      </div>

      <section>
        <h2 className="font-display font-semibold text-lg">Who runs this</h2>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          Punch In is built and operated by an individual developer, not a registered company. If you have
          questions about this policy or your data, contact{' '}
          <a href="mailto:konathalavamsi123@gmail.com" className="text-primary underline">
            konathalavamsi123@gmail.com
          </a>
          .
        </p>
      </section>

      <section>
        <h2 className="font-display font-semibold text-lg">What we collect</h2>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          When you sign in with Google, we receive your account name and email address via Firebase
          Authentication. Everything you log inside the app — workout, learning, chores, finances, meals,
          health, and goals entries — is stored in Cloud Firestore under a document scoped to your account's
          unique ID.
        </p>
      </section>

      <section>
        <h2 className="font-display font-semibold text-lg">Why we collect it</h2>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          Solely to run the tracking and dashboard features: building your rings, trend chart, and consistency
          heatmap. We do not use your data for anything else.
        </p>
      </section>

      <section>
        <h2 className="font-display font-semibold text-lg">Third parties</h2>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          We use Firebase and Google Cloud as our infrastructure and authentication processor. If configured, we
          use Google Analytics (GA4) to understand aggregate usage — only after you accept the cookie banner
          shown on your first visit. We do not use ad networks, and we never sell your data to anyone.
        </p>
      </section>

      <section>
        <h2 className="font-display font-semibold text-lg">Security</h2>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          Cloud Firestore security rules restrict every read and write to the authenticated owner of that
          data — no other account can access your entries. All traffic is served over HTTPS. Because sign-in
          uses Google OAuth, this app never sees or stores your password.
        </p>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          Punch In does not currently hold formal certifications such as SOC 2, HIPAA, or ISO 27001. Despite
          tracking health and finance entries, this app is not a healthcare provider or financial institution
          and is not subject to those regulatory frameworks.
        </p>
      </section>

      <section>
        <h2 className="font-display font-semibold text-lg">Retention &amp; your rights</h2>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          We keep your data until you ask us to delete it. There is currently no self-service delete or export
          button in the app — email{' '}
          <a href="mailto:konathalavamsi123@gmail.com" className="text-primary underline">
            konathalavamsi123@gmail.com
          </a>{' '}
          from your account's address and we will delete or export your data on request.
        </p>
      </section>

      <section>
        <h2 className="font-display font-semibold text-lg">Tracking</h2>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          We only load Google Analytics cookies after you click "Accept" on the cookie banner shown on your
          first visit. If you decline, no analytics script loads.
        </p>
      </section>

      <section>
        <h2 className="font-display font-semibold text-lg">Children</h2>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          Punch In is not directed at children under 13, and we do not knowingly collect data from them.
        </p>
      </section>

      <section>
        <h2 className="font-display font-semibold text-lg">Changes to this policy</h2>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          If this policy changes, we will update the date at the top of this page.
        </p>
      </section>

      <Footer />
    </div>
  );
}
