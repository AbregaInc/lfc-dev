import LegalShell from "@/components/LegalShell";

export default function AcceptableUse() {
  return (
    <LegalShell title="Acceptable Use Policy" updated="March 30, 2026">
      <section>
        <h2>Operator</h2>
        <p>LFC.DEV is operated by Abrega, Inc. This policy applies to all use of the Service by admins, members, and invited users.</p>
      </section>

      <section>
        <h2>Purpose</h2>
        <p>This policy defines what is and isn&apos;t allowed when using LFC.DEV.</p>
      </section>

      <section>
        <h2>You may</h2>
        <ul>
          <li>Use LFC.DEV to manage AI tool configurations for your team.</li>
          <li>Store MCP server definitions, instructions, rules, shared skills, and API credentials in the dashboard.</li>
          <li>Use the tray client to sync approved configurations to your devices.</li>
          <li>Submit suggestions for new artifacts to your organization&apos;s admins.</li>
        </ul>
      </section>

      <section>
        <h2>You may not</h2>
        <ul>
          <li>Use the Service to distribute malware, exploit code, or malicious configurations.</li>
          <li>Attempt to access other organizations&apos; data or other users&apos; accounts.</li>
          <li>Reverse-engineer, scrape, or overload the Service infrastructure.</li>
          <li>Store illegal content or use the Service for any unlawful purpose.</li>
          <li>Resell access to the Service without written permission.</li>
          <li>Use automated systems to create accounts or abuse rate limits.</li>
        </ul>
      </section>

      <section>
        <h2>Secrets and credentials</h2>
        <ul>
          <li>Only store credentials that your team is authorized to use.</li>
          <li>Do not store credentials belonging to third parties without their consent.</li>
          <li>Rotate secrets promptly when team members leave or access is revoked.</li>
        </ul>
      </section>

      <section>
        <h2>Enforcement</h2>
        <p>We may suspend or terminate accounts that violate this policy. When possible, we&apos;ll notify you and give you a chance to resolve the issue before taking action.</p>
      </section>

      <section>
        <h2>Reporting</h2>
        <p>If you see a violation, email <strong>abuse@lfc.dev</strong>.</p>
      </section>
    </LegalShell>
  );
}
