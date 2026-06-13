import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="text-primary">Veluate</span>
          <span className="hidden text-sm font-normal text-muted-foreground sm:inline">
            Teacher evaluation
          </span>
        </Link>
        <nav className="text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground transition-colors">
            New evaluation
          </Link>
        </nav>
      </div>
    </header>
  );
}
