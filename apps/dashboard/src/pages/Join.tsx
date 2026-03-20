import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import * as api from "../lib/api";

export default function Join() {
  const { code } = useParams<{ code: string }>();
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [invite, setInvite] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (code) api.getInvite(code).then(setInvite).catch(() => setError("Invalid invite link"));
  }, [code]);

  const handleJoin = async () => {
    if (!code) return;
    setLoading(true); setError("");
    try { await api.acceptInvite(code); navigate("/app"); window.location.reload(); }
    catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleRegisterAndJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      await register(name, email, password);
      if (code) await api.acceptInvite(code);
      navigate("/app"); window.location.reload();
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  if (error && !invite) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--color-surface-sunken)" }}>
        <div className="card max-w-[380px] w-full p-8 text-center">
          <h1 className="page-title mb-2">Invalid invite</h1>
          <p className="text-[14px] mb-4" style={{ color: "var(--color-text-tertiary)" }}>{error}</p>
          <Link to="/login" className="text-[13px] font-medium" style={{ color: "var(--color-text-primary)" }}>Go to login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--color-surface-sunken)" }}>
      <div className="w-full max-w-[380px] px-4">
        <div className="text-center mb-8">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold mx-auto mb-4" style={{ background: "var(--color-text-primary)", color: "var(--color-text-inverse)" }}>LF</div>
          <h1 className="text-[22px] font-semibold" style={{ letterSpacing: "-0.02em", color: "var(--color-text-primary)" }}>
            Join {invite?.invite?.orgName || "organization"}
          </h1>
          <p className="text-[14px] mt-1.5" style={{ color: "var(--color-text-tertiary)" }}>You've been invited to an LFC org.</p>
        </div>

        <div className="card p-6">
          {error && (
            <div className="p-3 rounded-lg text-[13px] mb-4" style={{ background: "var(--color-danger-subtle)", color: "var(--color-danger)" }}>{error}</div>
          )}

          {user ? (
            <div className="text-center">
              <p className="text-[14px] mb-4" style={{ color: "var(--color-text-secondary)" }}>Signed in as <strong>{user.email}</strong></p>
              <button onClick={handleJoin} disabled={loading} className="btn-primary w-full">{loading ? "Joining..." : "Join organization"}</button>
            </div>
          ) : (
            <form onSubmit={handleRegisterAndJoin} className="space-y-4">
              <div><label className="label">Name</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input-base" required /></div>
              <div><label className="label">Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input-base" required /></div>
              <div><label className="label">Password</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input-base" required /></div>
              <button type="submit" disabled={loading} className="btn-primary w-full" style={{ marginTop: "20px" }}>{loading ? "Creating account..." : "Create account & join"}</button>
            </form>
          )}
        </div>

        {!user && (
          <p className="mt-5 text-center text-[13px]" style={{ color: "var(--color-text-tertiary)" }}>
            Already have an account? <Link to="/login" className="font-medium" style={{ color: "var(--color-text-primary)" }}>Sign in</Link>
          </p>
        )}
      </div>
    </div>
  );
}
