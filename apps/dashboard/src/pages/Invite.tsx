import { useState } from "react";

import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import * as api from "@/lib/api";

import { useAuth } from "../lib/auth";

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
    <div className="space-y-6">
      <PageHeader
        title="Invite"
        subtitle="Generate a link to share with your team members."
      />

      <Card className="max-w-2xl py-0">
        <CardHeader className="border-b py-5">
          <CardTitle>Create invite link</CardTitle>
          <CardDescription>
            Recipients will create an account and join your organization from the same link.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 py-5">
          <Button onClick={generateInvite} disabled={loading}>
            {loading ? "Generating..." : "Generate invite link"}
          </Button>

          {inviteUrl ? (
            <div className="space-y-2">
              <Input value={inviteUrl} readOnly className="font-mono text-sm" />
              <div className="flex gap-2">
                <Button variant="outline" onClick={copyToClipboard}>
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
            </div>
          ) : null}

          <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
            Demo invite code: <code className="font-mono">acme-invite-2024</code>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
