"use client";

import { IconMoon, IconSun } from "@tabler/icons-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className={cn(
        "grid size-11 shrink-0 place-items-center rounded-xl border border-border bg-background text-foreground shadow-sm transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
        className,
      )}
      aria-label="Ubah tema warna"
      title="Ubah tema warna"
    >
      <IconMoon className="size-5 dark:hidden" />
      <IconSun className="hidden size-5 dark:block" />
    </button>
  );
}
