import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(name, email, password);
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
        <div className="text-center mb-10">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold mx-auto mb-4"
            style={{ background: "var(--color-text-primary)", color: "var(--color-text-inverse)" }}
          >
            LF
          </div>
          <h1 className="text-[22px] font-semibold" style={{ letterSpacing: "-0.02em", color: "var(--color-text-primary)" }}>
            Create your account
          </h1>
          <p className="text-[14px] mt-1.5" style={{ color: "var(--color-text-tertiary)" }}>
            Get started with LFC
          </p>
        </div>

        <div className="card p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg text-[13px]" style={{ background: "var(--color-danger-subtle)", color: "var(--color-danger)" }}>
                {error}
              </div>
            )}

            <div>
              <label className="label">Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input-base" placeholder="Your name" required />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input-base" placeholder="you@company.com" required />
            </div>
            <div>
              <label className="label">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input-base" placeholder="Min 6 characters" required />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full" style={{ marginTop: "20px" }}>
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-[13px]" style={{ color: "var(--color-text-tertiary)" }}>
          Already have an account?{" "}
          <Link to="/login" className="font-medium" style={{ color: "var(--color-text-primary)" }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
