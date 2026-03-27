import { useEffect, useState } from "react";

import EmptyState from "@/components/EmptyState";
import PageHeader from "@/components/PageHeader";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import * as api from "@/lib/api";

import { useAuth } from "../lib/auth";

export default function Secrets() {
  const { user } = useAuth();
  const [secrets, setSecrets] = useState<any[]>([]);
  const [newName, setNewName] = useState("");
  const [newValue, setNewValue] = useState("");
  const [error, setError] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    void loadSecrets();
  }, [user?.orgId]);

  const loadSecrets = async () => {
    if (!user?.orgId) return;
    const data = await api.listSecrets(user.orgId);
    setSecrets(data.secrets);
  };

  const handleAdd = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (!user?.orgId) return;

    try {
      await api.createSecret(user.orgId, newName, newValue);
      setNewName("");
      setNewValue("");
      setShowAdd(false);
      await loadSecrets();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (secretId: string) => {
    if (!user?.orgId) return;
    if (
      !confirm(
        "Delete this secret? Any release that resolves it will fail verification until you replace it."
      )
    ) {
      return;
    }

    await api.deleteSecret(user.orgId, secretId);
    await loadSecrets();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Secrets"
        subtitle='Credentials are resolved into managed launch environments at sync time. Reference them in manifests as {{SECRET_NAME}}.'
        action={<Button onClick={() => setShowAdd((value) => !value)}>{showAdd ? "Close" : "Add secret"}</Button>}
      />

      {showAdd ? (
        <Card className="py-0">
          <CardHeader className="border-b py-5">
            <CardTitle>New secret</CardTitle>
            <CardDescription>
              Secrets are encrypted server-side and injected only when an artifact requests them.
            </CardDescription>
          </CardHeader>
          <CardContent className="py-5">
            <form onSubmit={handleAdd} className="space-y-4">
              {error ? (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              <div>
                <Label htmlFor="secret-name">Name</Label>
                <Input
                  id="secret-name"
                  value={newName}
                  onChange={(event) =>
                    setNewName(event.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""))
                  }
                  className="mt-2 font-mono"
                  placeholder="GITHUB_TOKEN"
                  required
                />
              </div>

              <div>
                <Label htmlFor="secret-value">Value</Label>
                <Input
                  id="secret-value"
                  type="password"
                  value={newValue}
                  onChange={(event) => setNewValue(event.target.value)}
                  className="mt-2 font-mono"
                  placeholder="The secret value"
                  required
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="submit">Save secret</Button>
                <Button type="button" variant="outline" onClick={() => setShowAdd(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {secrets.length === 0 ? (
        <EmptyState
          title="No secrets yet"
          description="Add tokens for managed MCP launches, wrappers, and any artifact that resolves environment variables at install time."
          action={<Button onClick={() => setShowAdd(true)}>Add secret</Button>}
        />
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {secrets.map((secret) => (
                <TableRow key={secret.id}>
                  <TableCell className="font-mono font-medium text-foreground">
                    {secret.name}
                  </TableCell>
                  <TableCell className="font-mono tracking-widest text-muted-foreground">
                    {"*".repeat(12)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(secret.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => void handleDelete(secret.id)}
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
