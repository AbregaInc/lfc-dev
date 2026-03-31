import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import StatusBadge from "@/components/StatusBadge";

type Highlight = {
  label: string;
  title: string;
  detail: string;
};

export default function AuthShell({
  eyebrow,
  title,
  description,
  highlights,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  description: string;
  highlights: Highlight[];
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-8">
      <Card className="w-full max-w-6xl py-0">
        <div className="grid lg:grid-cols-[1.05fr_0.95fr]">
          <div className="border-b p-8 lg:border-r lg:border-b-0 lg:p-10">
            <StatusBadge tone="info" className="mb-5">
              {eyebrow}
            </StatusBadge>
            <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-foreground">
              {title}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">
              {description}
            </p>

            <Separator className="my-8" />

            <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-1">
              {highlights.map((item) => (
                <Card key={item.title} size="sm" className="bg-muted/30 py-0">
                  <CardContent className="space-y-2 py-4">
                    <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      {item.label}
                    </div>
                    <div className="text-sm font-medium text-foreground">{item.title}</div>
                    <p className="text-sm text-muted-foreground">{item.detail}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div className="p-6 lg:p-10">
            {children}
            <div className="mt-6 text-sm text-muted-foreground">{footer}</div>
          </div>
        </div>
      </Card>
    </div>
  );
}
