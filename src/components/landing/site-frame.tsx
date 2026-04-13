import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

type SiteFrameProps = {
  children: React.ReactNode;
};

export function SiteFrame({ children }: SiteFrameProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/12 ring-1 ring-primary/12">
              <Image
                src="/motri.png"
                alt="MoTRI"
                width={24}
                height={24}
                className="rounded-full"
                priority
              />
            </div>
            <div>
              <p className="font-serif text-lg leading-none">MoTRI</p>
              <p className="mt-1 text-[0.68rem] uppercase tracking-[0.22em] text-muted-foreground">
                Project Management Portal
              </p>
            </div>
          </Link>

          <nav className="hidden items-center gap-6 lg:flex">
            <a href="#overview" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Overview
            </a>
            <a href="#modules" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Modules
            </a>
            <a href="#workflow" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Workflow
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <Button asChild className="rounded-full px-5">
              <Link href="/login">
                Sign in
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {children}
    </div>
  );
}
