import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import AuthShell from "@/components/AuthShell";
import { joinWaitlist } from "@/lib/api";

type WaitlistPlan = "team" | "enterprise";

function normalizePlan(value?: string): WaitlistPlan {
  return value === "enterprise" ? "enterprise" : "team";
}

export default function Waitlist() {
  const { plan: planParam } = useParams();
  const plan = useMemo(() => normalizePlan(planParam), [planParam]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const planLabel = plan === "enterprise" ? "Enterprise" : "Team";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await joinWaitlist({ name, email, company, message, plan, source: "pricing", website });
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      footer={
        <span>
          Want to use LFC now?{" "}
          <Link to="/register" className="font-medium text-foreground underline-offset-4 hover:underline">
            Start free
          </Link>
        </span>
      }
    >
      <Card className="py-0">
        <CardContent className="py-6">
          {submitted ? (
            <div>
              <h1 className="text-lg font-semibold text-foreground">You're on the {planLabel} waitlist</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                We'll reach out before paid checkout or plan limits go live.
              </p>
              <div className="mt-5 flex gap-2">
                <Button type="button" onClick={() => navigate("/register")}>
                  Start free
                </Button>
                <Button type="button" variant="outline" onClick={() => navigate("/")}>
                  Back home
                </Button>
              </div>
            </div>
          ) : (
            <>
              <h1 className="text-lg font-semibold text-foreground">Join the {planLabel} waitlist</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Paid plans are coming later. Tell us where to reach you.
              </p>

              <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5" placeholder="Your name" />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5" placeholder="you@company.com" required />
                </div>
                <div>
                  <Label htmlFor="company">Company</Label>
                  <Input id="company" value={company} onChange={(e) => setCompany(e.target.value)} className="mt-1.5" placeholder="Acme Inc." />
                </div>
                <div>
                  <Label htmlFor="message">What do you need?</Label>
                  <Textarea id="message" value={message} onChange={(e) => setMessage(e.target.value)} className="mt-1.5" placeholder="Team size, SSO, self-hosting, compliance, or anything else." />
                </div>
                <div className="hidden" aria-hidden="true">
                  <Label htmlFor="website">Website</Label>
                  <Input id="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
                </div>

                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? "Joining..." : `Join ${planLabel} waitlist`}
                </Button>
              </form>
            </>
          )}
        </CardContent>
      </Card>
    </AuthShell>
  );
}
