import Link from "next/link";

import { Logo } from "@/components/brand/logo";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-[1120px] items-center justify-between px-10">
        <Logo variant="horizontal" priority />
        <nav>
          <Link
            href="/"
            className="text-sm font-medium tracking-wide text-muted-foreground transition-colors duration-100 ease-out hover:text-foreground"
          >
            New evaluation
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function PageMain({
  children,
  className = "",
  narrow = false,
}: {
  children: React.ReactNode;
  className?: string;
  narrow?: boolean;
}) {
  return (
    <main
      className={`mx-auto w-full flex-1 px-10 py-12 sm:py-16 ${
        narrow ? "max-w-[720px]" : "max-w-[1120px]"
      } ${className}`}
    >
      {children}
    </main>
  );
}
