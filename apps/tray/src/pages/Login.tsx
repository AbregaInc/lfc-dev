import { useState } from "react";
import { API_URL } from "../config";

export default function Login({
  onLogin,
}: {
  onLogin: (apiUrl: string, email: string, password: string) => Promise<void>;
}) {
  const isDev = import.meta.env.DEV;
  const [email, setEmail] = useState(isDev ? "admin@acme.com" : "");
  const [password, setPassword] = useState(isDev ? "password123" : "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await onLogin(API_URL, email, password);
    } catch (err: any) {
      setError(typeof err === "string" ? err : err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex flex-col" style={{ background: "var(--color-surface)" }}>
      {/* Header */}
      <div className="px-5 pt-6 pb-4 text-center" style={{ borderBottom: "1px solid var(--color-border)" }}>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold mx-auto mb-3"
          style={{ background: "var(--color-text-primary)", color: "var(--color-text-inverse)" }}
        >
          LF
        </div>
        <div className="text-[15px] font-semibold" style={{ letterSpacing: "-0.01em" }}>
          Connect to LFC
        </div>
        <div className="text-[12px] mt-0.5" style={{ color: "var(--color-text-tertiary)" }}>
          Sign in to sync your team's configs
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex-1 px-5 py-4 space-y-3.5">
        {error && (
          <div
            className="p-2.5 rounded-lg text-[12px]"
            style={{ background: "var(--color-danger-subtle)", color: "var(--color-danger)" }}
          >
            {error}
          </div>
        )}

        <div>
          <label className="label">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input-base"
            required
          />
        </div>

        <div>
          <label className="label">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input-base"
            required
          />
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full" style={{ marginTop: "8px" }}>
          {loading ? "Connecting..." : "Connect"}
        </button>
      </form>
    </div>
  );
}
