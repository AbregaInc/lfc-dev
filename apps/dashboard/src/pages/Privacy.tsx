import LegalShell from "@/components/LegalShell";

export default function Privacy() {
  return (
    <LegalShell title="Privacy Policy" updated="March 30, 2026">
      <section>
        <h2>What we collect</h2>
        <ul>
          <li><strong>Account info</strong> — name, email, and hashed password when you register.</li>
          <li><strong>Organization data</strong> — artifact definitions, profile assignments, and audit logs you create in the dashboard.</li>
          <li><strong>Device metadata</strong> — OS type, detected AI tools, and config health status reported by the tray client.</li>
          <li><strong>Usage data</strong> — page views, feature usage, and error reports to improve the product.</li>
        </ul>
      </section>

      <section>
        <h2>What we don&apos;t collect</h2>
        <ul>
          <li>We never read or store the contents of your code, prompts, or AI conversations.</li>
          <li>Secret values are encrypted at rest and resolved on-device at install time. We do not log plaintext secrets.</li>
          <li>Personal config entries (not managed by LFC) are never uploaded.</li>
        </ul>
      </section>

      <section>
        <h2>How we use your data</h2>
        <p>We use collected data to operate the service, sync configurations to your devices, display fleet health in the dashboard, and improve reliability. We do not sell your data or use it for advertising.</p>
      </section>

      <section>
        <h2>Data storage and security</h2>
        <p>Data is stored on encrypted infrastructure. Secrets use AES-256 encryption at rest. All connections use TLS. Backups are retained for 30 days.</p>
      </section>

      <section>
        <h2>Third parties</h2>
        <p>We use a minimal set of infrastructure providers (hosting, error tracking, email delivery). We do not share your data with third parties for their own purposes.</p>
      </section>

      <section>
        <h2>Data retention</h2>
        <p>Account data is retained while your account is active. When you delete your account, we remove your personal data within 30 days. Audit logs may be retained for up to 90 days for compliance.</p>
      </section>

      <section>
        <h2>Your rights</h2>
        <p>You can export, correct, or delete your data at any time from the dashboard settings page, or by emailing <strong>privacy@lfc.dev</strong>.</p>
      </section>

      <section>
        <h2>Changes</h2>
        <p>We&apos;ll notify you of material changes via email or an in-app notice. Continued use after changes constitutes acceptance.</p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>Questions? Email <strong>privacy@lfc.dev</strong>.</p>
      </section>
    </LegalShell>
  );
}
