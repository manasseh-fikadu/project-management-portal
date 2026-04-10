import Link from "next/link";
import {
  ArrowRight,
  FileBarChart,
  FolderKanban,
  HandCoins,
  Landmark,
  ScrollText,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteFrame } from "@/components/landing/site-frame";
import {
  audienceGroups,
  platformPillars,
  workflowSteps,
} from "@/lib/landing-content";

const overviewPoints = [
  {
    title: "Project oversight",
    description:
      "Organize initiatives, timelines, managers, milestones, and supporting documents in one place.",
    icon: FolderKanban,
  },
  {
    title: "Financial monitoring",
    description:
      "Follow planned budgets, utilization, disbursements, and execution gaps across the portfolio.",
    icon: HandCoins,
  },
  {
    title: "Reporting outputs",
    description:
      "Prepare donor-facing and internal reports from consistent operational records.",
    icon: FileBarChart,
  },
] as const;

const moduleGroups = [
  {
    label: "Core records",
    title: "Projects, proposals, and partner-linked documentation",
    description:
      "Maintain complete records from intake to execution with ownership, timelines, attachments, and donor relationships in one place.",
  },
  {
    label: "Financial follow-up",
    title: "Budgets, disbursements, and expenditure visibility",
    description:
      "Review planned budgets against spend and keep financial progress close to implementation progress rather than in separate reporting cycles.",
  },
  {
    label: "Reporting readiness",
    title: "Outputs prepared from live operational records",
    description:
      "Create consistent summaries for internal leadership and external partners from a shared, current source of information.",
  },
] as const;

export default function HomePage() {
  return (
    <SiteFrame>
      <main className="bg-background">
        {/* Hero Section */}
        <section className="border-b border-border/60">
          <div className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-32">
            <div className="grid gap-16 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
              <div className="max-w-4xl">
                <p className="text-[0.75rem] font-bold uppercase tracking-[0.2em] text-primary">
                  Ministry of Trade and Regional Integration
                </p>
                <h1 className="mt-8 text-[clamp(2.5rem,5vw,4.5rem)] font-serif leading-[1.05] tracking-tight text-foreground">
                  Project management with a clearer operational picture.
                </h1>
                <p className="mt-8 max-w-[54ch] text-lg leading-relaxed text-muted-foreground">
                  The portal brings together project records, financial follow-up,
                  partner coordination, and reporting preparation in a single
                  working environment for ministry teams, donors, and partners.
                </p>
                <div className="mt-10 flex flex-wrap gap-3">
                  <Button asChild className="h-11 rounded-full px-6">
                    <Link href="/login">
                      Sign in to the portal
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="h-11 rounded-full px-6">
                    <a href="#overview">View platform overview</a>
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-8 lg:mt-4">
                <div className="border-l border-border/60 pl-6">
                  <div className="flex items-center gap-4">
                    <Landmark className="h-6 w-6 text-primary" strokeWidth={1.5} />
                    <h2 className="text-xl font-serif text-foreground">
                      Operational overview
                    </h2>
                  </div>
                  <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                    One environment for oversight, delivery tracking, and reporting.
                  </p>
                  
                  <div className="mt-8 grid gap-6">
                    {overviewPoints.map((point) => (
                      <div key={point.title} className="flex gap-4">
                        <point.icon className="mt-1 h-5 w-5 shrink-0 text-primary" strokeWidth={1.5} />
                        <div>
                          <h3 className="text-sm font-bold text-foreground">
                            {point.title}
                          </h3>
                          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                            {point.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Overview Section */}
        <section id="overview" className="border-b border-border/60 bg-muted/20">
          <div className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-32">
            <div className="grid gap-16 lg:grid-cols-[0.8fr_1.2fr]">
              <div className="flex flex-col justify-between gap-8">
                <div>
                  <p className="text-[0.75rem] font-bold uppercase tracking-[0.2em] text-primary">
                    Overview
                  </p>
                  <h2 className="mt-6 text-3xl font-serif leading-tight tracking-tight text-foreground lg:text-4xl">
                    Built to reduce fragmentation across the project cycle.
                  </h2>
                </div>
                <p className="max-w-[42ch] text-base leading-relaxed text-muted-foreground">
                  Instead of keeping project data, budget tracking, reporting notes,
                  and supporting files in separate places, the portal keeps them in
                  one coordinated structure that can support both day-to-day delivery
                  work and formal review.
                </p>
              </div>

              <div className="grid gap-12 border-l border-border/60 pl-6 lg:pl-12">
                {moduleGroups.map((group, index) => (
                  <div key={group.title} className="grid gap-4 sm:grid-cols-[48px_1fr]">
                    <div className="text-sm font-bold text-primary">
                      0{index + 1}
                    </div>
                    <div>
                      <p className="text-[0.75rem] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                        {group.label}
                      </p>
                      <h3 className="mt-3 text-2xl font-serif leading-tight tracking-tight text-foreground">
                        {group.title}
                      </h3>
                      <p className="mt-4 max-w-[54ch] text-base leading-relaxed text-muted-foreground">
                        {group.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Modules & Users Section */}
        <section id="modules" className="border-b border-border/60">
          <div className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-32">
            <div className="grid gap-16 lg:grid-cols-2">
              <div>
                <p className="text-[0.75rem] font-bold uppercase tracking-[0.2em] text-primary">
                  What the platform covers
                </p>
                <div className="mt-10 grid gap-12">
                  {platformPillars.map((pillar) => (
                    <div key={pillar.title} className="border-t border-border/60 pt-6">
                      <h3 className="text-2xl font-serif leading-tight tracking-tight text-foreground">
                        {pillar.title}
                      </h3>
                      <p className="mt-4 max-w-[54ch] text-base leading-relaxed text-muted-foreground">
                        {pillar.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col justify-between gap-16 border-l border-border/60 pl-6 lg:pl-12">
                <div>
                  <p className="text-[0.75rem] font-bold uppercase tracking-[0.2em] text-primary">
                    Supported users
                  </p>
                  <div className="mt-10 grid gap-10">
                    {audienceGroups.map((group) => (
                      <div key={group.title} className="flex gap-4">
                        <Users className="mt-1 h-5 w-5 shrink-0 text-primary" strokeWidth={1.5} />
                        <div>
                          <h3 className="text-lg font-bold text-foreground">
                            {group.title}
                          </h3>
                          <p className="mt-2 max-w-[46ch] text-base leading-relaxed text-muted-foreground">
                            {group.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-primary/5 p-8 border border-primary/10">
                  <p className="text-[0.75rem] font-bold uppercase tracking-[0.2em] text-primary">
                    Access and governance
                  </p>
                  <div className="mt-8 grid gap-6">
                    <div className="flex gap-4">
                      <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-primary" strokeWidth={1.5} />
                      <p className="text-sm leading-relaxed text-foreground/80">
                        Role-based access keeps different audiences aligned while
                        preserving appropriate controls over operational records.
                      </p>
                    </div>
                    <div className="flex gap-4">
                      <ScrollText className="mt-1 h-5 w-5 shrink-0 text-primary" strokeWidth={1.5} />
                      <p className="text-sm leading-relaxed text-foreground/80">
                        Reporting outputs are grounded in the same live data used
                        for routine monitoring and follow-up.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Workflow Section */}
        <section id="workflow" className="border-b border-border/60 bg-muted/20">
          <div className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-32">
            <div className="grid gap-16 lg:grid-cols-[0.8fr_1.2fr]">
              <div>
                <p className="text-[0.75rem] font-bold uppercase tracking-[0.2em] text-primary">
                  Workflow
                </p>
                <h2 className="mt-6 text-3xl font-serif leading-tight tracking-tight text-foreground lg:text-4xl">
                  A simpler path from intake to reporting.
                </h2>
                <p className="mt-6 max-w-[42ch] text-base leading-relaxed text-muted-foreground">
                  The platform is designed to follow the logic of delivery work:
                  register information once, monitor it continuously, and use it
                  again when formal updates are due.
                </p>
              </div>

              <div className="grid gap-12 border-l border-border/60 pl-6 lg:pl-12">
                {workflowSteps.map((step) => (
                  <div key={step.step} className="grid gap-4 sm:grid-cols-[48px_1fr]">
                    <div className="text-xl font-serif text-primary">
                      {step.step}
                    </div>
                    <div>
                      <h3 className="text-2xl font-serif leading-tight tracking-tight text-foreground">
                        {step.title}
                      </h3>
                      <p className="mt-4 max-w-[54ch] text-base leading-relaxed text-muted-foreground">
                        {step.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="bg-primary text-primary-foreground">
          <div className="mx-auto flex max-w-7xl flex-col gap-10 px-5 py-20 lg:flex-row lg:items-end lg:justify-between lg:px-8 lg:py-24">
            <div className="max-w-3xl">
              <p className="text-[0.75rem] font-bold uppercase tracking-[0.2em] text-primary-foreground/70">
                Access the portal
              </p>
              <h2 className="mt-6 text-3xl font-serif leading-tight tracking-tight lg:text-4xl">
                A shared operational surface for delivery, oversight, and partner reporting.
              </h2>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild className="h-11 rounded-full bg-white px-6 text-primary hover:bg-white/90">
                <Link href="/login">
                  Sign in
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
    </SiteFrame>
  );
}
