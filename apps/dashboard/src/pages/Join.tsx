import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import AuthShell from "@/components/AuthShell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import * as api from "@/lib/api";

import { useAuth } from "../lib/auth";

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
    if (!code) return;
    api.getInvite(code).then(setInvite).catch(() => setError("Invalid invite link"));
  }, [code]);

  const handleJoin = async () => {
    if (!code) return;
    setLoading(true);
    setError("");

    try {
      await api.acceptInvite(code);
      navigate("/app");
      window.location.reload();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterAndJoin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      await register(name, email, password);
      if (code) await api.acceptInvite(code);
      navigate("/app");
      window.location.reload();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (error && !invite) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
        <Card className="w-full max-w-md py-0">
          <CardContent className="space-y-4 py-8 text-center">
            <div className="text-2xl font-semibold tracking-tight text-foreground">
              Invalid invite
            </div>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Link to="/login" className="text-sm font-medium text-foreground underline">
              Go to login
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <AuthShell
      eyebrow="Team invite"
      title={`Join ${invite?.invite?.orgName || "organization"}`}
      description="This link will attach your account to the organization and bring you straight into the rollout dashboard."
      highlights={[
        {
          label: "Profiles",
          title: "Assignments stay team-scoped",
          detail: "You inherit the org and can be targeted through profiles instead of local setup docs.",
        },
        {
          label: "Fleet",
          title: "Your devices report health back",
          detail: "Tray and CLI clients show verification state once they register.",
        },
        {
          label: "Security",
          title: "Secrets stay managed",
          detail: "Shared launches resolve org secrets without distributing raw credentials by hand.",
        },
      ]}
      footer={
        !user ? (
          <span>
            Already have an account?{" "}
            <Link to="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
              Sign in
            </Link>
          </span>
        ) : (
          <span>Signed in as {user.email}</span>
        )
      }
    >
      <Card className="py-0">
        <CardContent className="space-y-4 py-6 md:py-7">
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {user ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Signed in as <strong>{user.email}</strong>.
              </p>
              <Button onClick={handleJoin} disabled={loading} className="w-full">
                {loading ? "Joining..." : "Join organization"}
              </Button>
            </div>
          ) : (
            <form onSubmit={handleRegisterAndJoin} className="space-y-4">
              <div>
                <Label htmlFor="join-name">Name</Label>
                <Input
                  id="join-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="mt-2"
                  required
                />
              </div>
              <div>
                <Label htmlFor="join-email">Email</Label>
                <Input
                  id="join-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-2"
                  required
                />
              </div>
              <div>
                <Label htmlFor="join-password">Password</Label>
                <Input
                  id="join-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="mt-2"
                  required
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Creating account..." : "Create account and join"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </AuthShell>
  );
}
