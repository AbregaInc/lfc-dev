import { useState } from "react";
import { useAuth } from "../lib/auth";
import * as api from "../lib/api";

export default function Invite() {
  const { user } = useAuth();
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  const generateInvite = async () => {
    if (!user?.orgId) return;
    setLoading(true);
    try {
      const data = await api.createInvite(user.orgId);
      setInviteCode(data.invite.code);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const inviteUrl = inviteCode ? `${window.location.origin}/join/${inviteCode}` : null;

  const copyToClipboard = async () => {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="page-title">Invite</h1>
        <p className="page-subtitle">Generate a link to share with your team members.</p>
      </div>

      <div className="card p-5 max-w-[520px]">
        <button onClick={generateInvite} disabled={loading} className="btn-primary">
          {loading ? "Generating..." : "Generate invite link"}
        </button>

        {inviteUrl && (
          <div className="mt-5">
            <label className="label">Invite link</label>
            <div className="flex gap-2">
              <input type="text" value={inviteUrl} readOnly className="input-base font-mono text-[12px]" style={{ background: "var(--color-surface-sunken)" }} />
              <button onClick={copyToClipboard} className="btn-primary shrink-0">
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="text-[12px] mt-2" style={{ color: "var(--color-text-tertiary)" }}>
              Share this link. Recipients will create an account and join your org.
            </p>
          </div>
        )}

        <div className="mt-6 p-3.5 rounded-lg text-[13px]" style={{ background: "var(--color-accent-subtle)", color: "var(--color-accent)" }}>
          <span className="font-medium">Demo:</span> Use invite code <code className="font-mono text-[12px] px-1 py-0.5 rounded" style={{ background: "rgba(37,99,235,0.1)" }}>acme-invite-2024</code> at <code className="font-mono text-[12px]">/join/acme-invite-2024</code>
        </div>
      </div>
    </div>
  );
}
