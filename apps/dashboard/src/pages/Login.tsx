import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import AuthShell from "@/components/AuthShell";
import StatusBadge from "@/components/StatusBadge";
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
    <AuthShell
      eyebrow="Operator access"
      title="Get back to the rollout desk."
      description="Sign in to review submissions, publish releases, and keep device state aligned across Claude, Cursor, Codex, and the rest of the toolchain."
      highlights={[
        {
          label: "Profiles",
          title: "One desired state per team",
          detail: "Artifacts are assigned to profiles, not pasted into wikis or side-channel docs.",
        },
        {
          label: "Reliability",
          title: "Managed and unreliable are visible",
          detail: "If something only works on one laptop, the UI says so before you deploy it.",
        },
        {
          label: "Fleet",
          title: "Health is attached to devices",
          detail: "You can see what applied, what verified, and what still needs attention.",
        },
      ]}
      footer={
        <span>
          Don&apos;t have an account?{" "}
          <Link to="/register" className="font-medium text-foreground underline-offset-4 hover:underline">
            Create one
          </Link>
        </span>
      }
    >
      <div className="mb-6">
        <StatusBadge tone="neutral">Sign in</StatusBadge>
        <p className="mt-3 text-sm text-muted-foreground">Use your admin or member credentials to open the dashboard.</p>
      </div>

      <Card className="py-0">
        <CardContent className="space-y-4 py-6 md:py-7">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {isDev && (
            <Alert>
              <AlertDescription>
              Local dev mode is prefilled with `admin@acme.com` and `password123`.
              </AlertDescription>
            </Alert>
          )}

          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2"
              placeholder="you@company.com"
              required
            />
          </div>

          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2"
              required
            />
          </div>

          <Button type="submit" disabled={loading} className="mt-5 w-full">
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
