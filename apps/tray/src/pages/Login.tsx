import { useState } from "react";

import BrandMark from "../components/BrandMark";
import StatusBadge from "../components/StatusBadge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
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

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
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
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <div className="flex flex-1 items-center justify-center px-4 py-6">
        <div className="w-full max-w-md space-y-4">
          <div className="space-y-3 text-center">
            <div className="flex justify-center">
              <BrandMark />
            </div>
            <StatusBadge tone="neutral">Desktop client</StatusBadge>
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                Connect this machine
              </h1>
              <p className="text-sm leading-6 text-muted-foreground">
                Sign in once. LFC will detect compatible tools, sync approved artifacts, and keep
                your local personal config intact.
              </p>
            </div>
          </div>

          <Card>
            <CardContent className="space-y-4 py-5">
              {error ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase">
                    Email
                  </label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase">
                    Password
                  </label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
                </div>

                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? "Connecting..." : "Connect"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
