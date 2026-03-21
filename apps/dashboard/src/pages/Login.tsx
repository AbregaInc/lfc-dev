import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";

export default function Login() {
  const isDev = import.meta.env.DEV;
  const [email, setEmail] = useState(isDev ? "admin@acme.com" : "");
  const [password, setPassword] = useState(isDev ? "password123" : "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/app");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--color-surface-sunken)" }}>
      <div className="w-full max-w-[380px] px-4">
        {/* Brand */}
        <div className="text-center mb-10">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold mx-auto mb-4"
            style={{ background: "var(--color-text-primary)", color: "var(--color-text-inverse)" }}
          >
            LF
          </div>
          <h1 className="text-[22px] font-semibold" style={{ letterSpacing: "-0.02em", color: "var(--color-text-primary)" }}>
            Sign in to LFC
          </h1>
          <p className="text-[14px] mt-1.5" style={{ color: "var(--color-text-tertiary)" }}>
            Manage your team's AI tool configs
          </p>
        </div>

        {/* Card */}
        <div className="card p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div
                className="p-3 rounded-lg text-[13px]"
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
                placeholder="you@company.com"
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

            <button type="submit" disabled={loading} className="btn-primary w-full" style={{ marginTop: "20px" }}>
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-[13px]" style={{ color: "var(--color-text-tertiary)" }}>
          Don't have an account?{" "}
          <Link to="/register" className="font-medium" style={{ color: "var(--color-text-primary)" }}>
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
