import LegalShell from "@/components/LegalShell";

export default function Terms() {
  return (
    <LegalShell title="Terms of Service" updated="March 30, 2026">
      <section>
        <h2>Agreement</h2>
        <p>By using LFC (&quot;the Service&quot;), operated by Abrega Inc. (&quot;we&quot;, &quot;us&quot;), you agree to these terms. If you don&apos;t agree, don&apos;t use the Service.</p>
      </section>

      <section>
        <h2>The Service</h2>
        <p>LFC is a configuration management tool that syncs AI tool settings across your team&apos;s devices. We provide a dashboard for admins and a tray client for developers.</p>
      </section>

      <section>
        <h2>Accounts</h2>
        <ul>
          <li>You must provide accurate information when registering.</li>
          <li>You&apos;re responsible for your account credentials and all activity under your account.</li>
          <li>One person per account. Shared or machine accounts require prior approval.</li>
        </ul>
      </section>

      <section>
        <h2>Your data</h2>
        <p>You own your data. We claim no ownership of your configurations, secrets, or organizational content. We access your data only to provide and improve the Service.</p>
      </section>

      <section>
        <h2>Acceptable use</h2>
        <p>You agree to use the Service in compliance with our <a href="/acceptable-use" className="font-medium text-foreground underline-offset-4 hover:underline">Acceptable Use Policy</a> and all applicable laws.</p>
      </section>

      <section>
        <h2>Payment</h2>
        <ul>
          <li>Free tier is available for up to 5 users with no payment required.</li>
          <li>Paid plans are billed annually. Prices are listed on our pricing page.</li>
          <li>We&apos;ll give 30 days notice before any price changes take effect.</li>
          <li>Refunds are handled on a case-by-case basis within the first 30 days.</li>
        </ul>
      </section>

      <section>
        <h2>Availability</h2>
        <p>We aim for high availability but don&apos;t guarantee uninterrupted service. We&apos;ll notify you of planned maintenance in advance when possible.</p>
      </section>

      <section>
        <h2>Termination</h2>
        <p>You can close your account at any time from settings. We may suspend accounts that violate these terms, with notice when feasible. On termination, we&apos;ll make your data available for export for 30 days.</p>
      </section>

      <section>
        <h2>Liability</h2>
        <p>The Service is provided &quot;as is.&quot; To the maximum extent permitted by law, our liability is limited to the amount you&apos;ve paid us in the 12 months preceding a claim. We&apos;re not liable for indirect, incidental, or consequential damages.</p>
      </section>

      <section>
        <h2>Changes</h2>
        <p>We may update these terms. Material changes will be communicated via email or in-app notice at least 30 days in advance. Continued use constitutes acceptance.</p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>Questions? Email <strong>legal@lfc.dev</strong>.</p>
      </section>
    </LegalShell>
  );
}
