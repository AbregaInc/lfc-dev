import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "../../lib/utils";

type ButtonVariant = "default" | "outline" | "ghost" | "danger";
type ButtonSize = "default" | "sm";

export function buttonVariants({
  variant = "default",
  size = "default",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  return cn(
    "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border text-sm font-medium transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
    size === "sm" ? "h-8 px-2.5 text-[0.8rem]" : "h-9 px-3",
    variant === "default" &&
      "border-transparent bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
    variant === "outline" &&
      "border-border bg-background text-foreground shadow-sm hover:bg-muted hover:text-foreground",
    variant === "ghost" &&
      "border-transparent bg-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground",
    variant === "danger" &&
      "border-transparent bg-destructive/10 text-destructive hover:bg-destructive/15",
    className
  );
}

export function Button({
  variant,
  size,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}) {
  return (
    <button className={buttonVariants({ variant, size, className })} {...props}>
      {children}
    </button>
  );
}

export function ButtonLink({
  variant,
  size,
  className,
  children,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}) {
  return (
    <a className={buttonVariants({ variant, size, className })} {...props}>
      {children}
    </a>
  );
}
