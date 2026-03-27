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
    <AuthShell
      eyebrow="First rollout"
      title="Create the control plane for your team."
      description="Set up your workspace, define shared artifacts, and start pushing approved MCPs, skills, rules, and instructions from one place."
      highlights={[
        {
          label: "Artifacts",
          title: "Typed releases instead of pasted commands",
          detail: "Capture what a teammate discovered and normalize it into something the org can understand.",
        },
        {
          label: "Bindings",
          title: "One release, many tools",
          detail: "The same artifact can target Claude Code, Cursor, Codex, and desktop MCP configs.",
        },
        {
          label: "Verification",
          title: "Install, bind, verify, rollback",
          detail: "Clients apply desired state on-device and keep previous releases around when something fails.",
        },
      ]}
      footer={
        <span>
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
            Sign in
          </Link>
        </span>
      }
    >
      <div className="mb-6">
        <StatusBadge tone="neutral">Create account</StatusBadge>
        <p className="mt-3 text-sm text-muted-foreground">Start with a new organization and publish your first artifact release from the dashboard.</p>
      </div>

      <Card className="py-0">
        <CardContent className="space-y-4 py-6 md:py-7">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} className="mt-2" placeholder="Your name" required />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2" placeholder="you@company.com" required />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2" placeholder="Min 6 characters" required />
          </div>
          <Button type="submit" disabled={loading} className="mt-5 w-full">
            {loading ? "Creating account..." : "Create account"}
          </Button>
        </form>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
