"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import DOMPurify from "dompurify";
import {
  ArrowLeft,
  Calendar,
  CircleDashed,
  Clock3,
  DollarSign,
  Download,
  Edit,
  FileText,
  FolderKanban,
  Leaf,
  Target,
  User2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TorDocumentEditor } from "@/components/ui/tor-document-editor";
import { formatCurrency, SUPPORTED_CURRENCIES, type CurrencyCode } from "@/lib/currency";
import { buildTorDocumentPreviewHtml } from "@/lib/tor-document";

type Donor = {
  id: string;
  name: string;
  type: string;
};

type Project = {
  id: string;
  name: string;
};

type ProposalDocument = {
  id: string;
  name: string;
  type: string;
  url: string;
  size: number;
  createdAt: string;
  uploader: {
    id: string;
    firstName: string;
    lastName: string;
  };
};

type ProposalSection = {
  key?: string;
  name?: string;
  label?: string;
};

type ProposalTemplate = {
  id: string;
  name: string;
  category: string | null;
  sections?: ProposalSection[];
};

type Proposal = {
  id: string;
  title: string;
  proposalType: "grant" | "tor";
  templateId: string | null;
  torCode: string | null;
  torSubmissionRef: string | null;
  templateData: Record<string, string> | null;
  status: string;
  amountRequested: number;
  amountApproved: number | null;
  currency: string;
  submissionDate: string | null;
  decisionDate: string | null;
  startDate: string | null;
  endDate: string | null;
  description: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt?: string;
  donor: Donor | null;
  project: Project | null;
  template: ProposalTemplate | null;
  documents: ProposalDocument[];
  creator: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
};

const PROPOSAL_EDIT_ROLES = new Set(["admin", "project_manager"]);

const statusConfig: Record<string, { label: string; tone: string; panel: string }> = {
  draft: {
    label: "site.draft",
    tone: "text-muted-foreground",
    panel: "border-border bg-card/80",
  },
  submitted: {
    label: "site.submitted",
    tone: "text-lavender",
    panel: "border-lavender/20 bg-lavender-pale/60",
  },
  under_review: {
    label: "site.under_review",
    tone: "text-amber-warm",
    panel: "border-amber-warm/20 bg-amber-pale/70",
  },
  approved: {
    label: "site.approved",
    tone: "text-primary",
    panel: "border-primary/20 bg-sage-pale/75",
  },
  rejected: {
    label: "site.rejected",
    tone: "text-rose-muted",
    panel: "border-rose-muted/20 bg-rose-pale/70",
  },
  withdrawn: {
    label: "site.withdrawn",
    tone: "text-muted-foreground",
    panel: "border-border bg-muted/50",
  },
};

const typeConfig: Record<string, { label: string; panel: string }> = {
  grant: { label: "site.grant_proposal", panel: "bg-sage-pale text-primary" },
  tor: { label: "site.terms_of_reference", panel: "bg-lavender-pale text-lavender" },
};

const SUPPORTED_CURRENCY_SET = new Set<string>(SUPPORTED_CURRENCIES);

function normalizeCurrency(currency: string): CurrencyCode {
  return SUPPORTED_CURRENCY_SET.has(currency) ? (currency as CurrencyCode) : "ETB";
}

function formatDate(date: string | null, fallback: string, locale?: string) {
  if (!date) return fallback;
  return new Date(date).toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isValidExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function prettyKey(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function ProposalDetailsPage() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const params = useParams();
  const proposalId = params.id as string;
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [isEditingSections, setIsEditingSections] = useState(false);
  const [isSavingSections, setIsSavingSections] = useState(false);
  const [sectionDrafts, setSectionDrafts] = useState<Record<string, string>>({});
  const [sectionsError, setSectionsError] = useState("");

  const fetchProposal = useCallback(async () => {
    try {
      const res = await fetch(`/api/proposals/${proposalId}`);
      const data = await res.json();
      if (data.proposal) {
        setProposal(data.proposal);
      } else {
        router.push("/proposals");
      }
    } catch {
      router.push("/proposals");
    } finally {
      setLoading(false);
    }
  }, [proposalId, router]);

  const fetchCurrentUserRole = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      if (!res.ok) {
        return;
      }

      const data = await res.json();
      if (data.user?.role) {
        setCurrentUserRole(data.user.role);
      }
    } catch (error) {
      console.error("Error fetching current user role:", error);
    }
  }, []);

  useEffect(() => {
    void fetchProposal();
    void fetchCurrentUserRole();
  }, [fetchCurrentUserRole, fetchProposal]);

  const allTemplateSections = useMemo(() => {
    if (!proposal) return [];
    const entries = Object.entries(proposal.templateData || {});

    const labels = new Map<string, string>();
    const sections: Array<{ key: string; label: string; value: string }> = [];
    const seenKeys = new Set<string>();

    for (const section of proposal.template?.sections || []) {
      const key = section.key || section.name;
      const label = section.label || section.name;
      if (!key) continue;

      if (key && label) labels.set(key, label);

      sections.push({
        key,
        label: label ?? prettyKey(key),
        value: typeof proposal.templateData?.[key] === "string" ? proposal.templateData[key] : "",
      });
      seenKeys.add(key);
    }

    const remainingSections = entries
      .filter(([key, value]) => !seenKeys.has(key) && typeof value === "string")
      .map(([key, value]) => ({
        key,
        label: labels.get(key) || prettyKey(key),
        value,
      }));

    return [...sections, ...remainingSections];
  }, [proposal]);

  const templateSections = useMemo(
    () => allTemplateSections.filter((section) => section.value.trim().length > 0),
    [allTemplateSections]
  );

  useEffect(() => {
    if (!allTemplateSections.length) {
      setSectionDrafts({});
      return;
    }

    setSectionDrafts(
      allTemplateSections.reduce<Record<string, string>>((acc, section) => {
        acc[section.key] = section.value;
        return acc;
      }, {})
    );
  }, [allTemplateSections]);

  async function handleSaveSections() {
    if (!proposal) return;

    try {
      setIsSavingSections(true);
      setSectionsError("");

      const res = await fetch(`/api/proposals/${proposal.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateData: sectionDrafts }),
      });
      const data = await res.json();

      if (!res.ok || !data.proposal) {
        throw new Error(data.error || "Unable to update proposal details");
      }

      setProposal(data.proposal);
      setIsEditingSections(false);
    } catch (error) {
      console.error(t("site.error_saving_proposal"), error);
      setSectionsError(t("site.could_not_update_proposal_details_please_try_again"));
    } finally {
      setIsSavingSections(false);
    }
  }

  function resetSectionDrafts() {
    setSectionDrafts(
      allTemplateSections.reduce<Record<string, string>>((acc, section) => {
        acc[section.key] = section.value;
        return acc;
      }, {})
    );
    setSectionsError("");
    setIsEditingSections(false);
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] rounded-[2rem] border border-border/70 bg-card/80 p-8 shadow-sm">
        <p className="text-sm text-muted-foreground">{t("site.loading_proposal_details")}</p>
      </div>
    );
  }

  if (!proposal) return null;

  const status = statusConfig[proposal.status] || statusConfig.draft;
  const type = typeConfig[proposal.proposalType] || typeConfig.grant;
  const canEditProposal = currentUserRole !== null && PROPOSAL_EDIT_ROLES.has(currentUserRole);
  const documents = proposal.documents ?? [];
  const torDocumentSections = allTemplateSections.map((section) => ({
    key: section.key,
    label: section.label,
  }));
  const torDocumentPreviewHtml = buildTorDocumentPreviewHtml(
    templateSections.map((section) => ({
      key: section.key,
      label: section.label,
    })),
    proposal.templateData || {}
  );

  return (
    <div className="space-y-6 pb-10">
      <section className={`overflow-hidden rounded-[2rem] border ${status.panel}`}>
        <div className="relative px-6 py-6 sm:px-8 sm:py-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(122,155,109,0.2),transparent_38%),radial-gradient(circle_at_right,rgba(139,126,184,0.16),transparent_32%)]" />
          <div className="relative space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <Button asChild variant="outline" className="rounded-full bg-card/80">
                <Link href="/proposals">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  {t("site.back_to_proposals")}
                </Link>
              </Button>
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${type.panel}`}>
                {t(type.label)}
              </span>
              <span className={`inline-flex items-center gap-2 rounded-full border border-current/10 bg-card/70 px-3 py-1 text-xs font-semibold ${status.tone}`}>
                <CircleDashed className="h-3.5 w-3.5" />
                {t(status.label)}
              </span>
              {proposal.proposalType === "tor" && (
                <>
                  <Button asChild variant="outline" className="rounded-full bg-card/80">
                    <a href={`/api/proposals/${proposal.id}/export?format=docx`}>
                      <Download className="mr-2 h-4 w-4" />
                      {t("site.export_docx")}
                    </a>
                  </Button>
                  <Button asChild className="rounded-full">
                    <a href={`/api/proposals/${proposal.id}/export?format=pdf`}>
                      <FileText className="mr-2 h-4 w-4" />
                      {t("site.export_pdf")}
                    </a>
                  </Button>
                </>
              )}
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.7fr)]">
              <div className="space-y-4">
                <div className="space-y-3">
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                    {t("site.proposal_dossier")}
                  </p>
                  <h1 className="max-w-4xl font-serif text-3xl leading-tight text-foreground sm:text-5xl">
                    {proposal.title}
                  </h1>
                  <p className="max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">
                    {proposal.description || t("site.no_overview_added_for_proposal_yet")}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[1.5rem] border border-border/70 bg-card/85 p-4">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                      {t("site.requested")}
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">
                      {formatCurrency(proposal.amountRequested, normalizeCurrency(proposal.currency))}
                    </p>
                  </div>
                  <div className="rounded-[1.5rem] border border-border/70 bg-card/85 p-4">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                      {t("site.approved")}
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">
                      {proposal.amountApproved != null
                        ? formatCurrency(proposal.amountApproved, normalizeCurrency(proposal.currency))
                        : t("site.pending")}
                    </p>
                  </div>
                  <div className="rounded-[1.5rem] border border-border/70 bg-card/85 p-4">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                      {t("site.documents")}
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">{documents.length}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-border/70 bg-card/80 p-5">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  {t("site.at_a_glance")}
                </p>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex items-start gap-3 rounded-2xl bg-muted/45 px-3 py-3">
                    <DollarSign className="mt-0.5 h-4 w-4 text-primary" />
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{t("site.donor")}</p>
                      <p className="font-medium text-foreground">{proposal.donor?.name || t("site.not_linked")}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-2xl bg-muted/45 px-3 py-3">
                    <FolderKanban className="mt-0.5 h-4 w-4 text-primary" />
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{t("site.project")}</p>
                      <p className="font-medium text-foreground">{proposal.project?.name || t("site.standalone_proposal")}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-2xl bg-muted/45 px-3 py-3">
                    <User2 className="mt-0.5 h-4 w-4 text-primary" />
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{t("site.owner")}</p>
                      <p className="font-medium text-foreground">
                        {proposal.creator.firstName} {proposal.creator.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground">{proposal.creator.email}</p>
                    </div>
                  </div>
                  {proposal.template && (
                    <div className="flex items-start gap-3 rounded-2xl bg-muted/45 px-3 py-3">
                      <Leaf className="mt-0.5 h-4 w-4 text-primary" />
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{t("site.template")}</p>
                        <p className="font-medium text-foreground">{proposal.template.name}</p>
                        {proposal.template.category && (
                          <p className="text-xs text-muted-foreground">{proposal.template.category}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <div className="rounded-[1.75rem] border border-border/70 bg-card p-6">
            <div className="flex items-center gap-3">
              <Clock3 className="h-4 w-4 text-primary" />
              <h2 className="font-serif text-2xl text-foreground">{t("site.timeline_and_references")}</h2>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-muted/40 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{t("site.submitted")}</p>
                <p className="mt-2 text-sm font-medium text-foreground">{formatDate(proposal.submissionDate, t("site.not_set"), i18n.language)}</p>
              </div>
              <div className="rounded-2xl bg-muted/40 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{t("site.decision")}</p>
                <p className="mt-2 text-sm font-medium text-foreground">{formatDate(proposal.decisionDate, t("site.not_set"), i18n.language)}</p>
              </div>
              <div className="rounded-2xl bg-muted/40 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{t("site.start_date")}</p>
                <p className="mt-2 text-sm font-medium text-foreground">{formatDate(proposal.startDate, t("site.not_set"), i18n.language)}</p>
              </div>
              <div className="rounded-2xl bg-muted/40 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{t("site.end_date")}</p>
                <p className="mt-2 text-sm font-medium text-foreground">{formatDate(proposal.endDate, t("site.not_set"), i18n.language)}</p>
              </div>
              {proposal.torCode && (
                <div className="rounded-2xl bg-muted/40 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{t("site.tor_code")}</p>
                  <p className="mt-2 text-sm font-medium text-foreground">{proposal.torCode}</p>
                </div>
              )}
              {proposal.torSubmissionRef && (
                <div className="rounded-2xl bg-muted/40 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{t("site.submission_ref")}</p>
                  <p className="mt-2 text-sm font-medium text-foreground">{proposal.torSubmissionRef}</p>
                </div>
              )}
            </div>
          </div>

          {allTemplateSections.length > 0 && (
            <div className="rounded-[1.75rem] border border-border/70 bg-card p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Target className="h-4 w-4 text-primary" />
                  <h2 className="font-serif text-2xl text-foreground">{t("site.proposal_details")}</h2>
                </div>
                {proposal.proposalType === "tor" && canEditProposal ? (
                  <div className="flex items-center gap-2">
                    {isEditingSections ? (
                      <>
                        <Button type="button" variant="ghost" onClick={resetSectionDrafts}>
                          {t("site.cancel")}
                        </Button>
                        <Button type="button" className="rounded-xl" onClick={handleSaveSections} disabled={isSavingSections}>
                          {isSavingSections ? t("site.updating") : t("site.update")}
                        </Button>
                      </>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-xl"
                        onClick={() => {
                          setSectionsError("");
                          setIsEditingSections(true);
                        }}
                      >
                        <Edit className="mr-2 h-4 w-4" />
                        {t("site.edit")}
                      </Button>
                    )}
                  </div>
                ) : null}
              </div>
              <div className="mt-5 space-y-4">
                {isEditingSections ? (
                  <>
                    <TorDocumentEditor
                      sections={torDocumentSections}
                      values={sectionDrafts}
                      onChange={setSectionDrafts}
                    />
                    {sectionsError ? <p className="text-sm text-destructive">{sectionsError}</p> : null}
                  </>
                ) : templateSections.length > 0 ? (
                  <div
                    className="tor-document-render"
                    dangerouslySetInnerHTML={{
                      __html: DOMPurify.sanitize(torDocumentPreviewHtml, {
                        USE_PROFILES: { html: true },
                      }),
                    }}
                  />
                ) : (
                  <div className="rounded-[1.5rem] border border-dashed border-border/70 bg-muted/15 px-5 py-6 text-sm text-muted-foreground">
                    {t("site.no_tor_details_added_yet")}
                  </div>
                )}
              </div>
            </div>
          )}

          {proposal.notes && (
            <div className="rounded-[1.75rem] border border-border/70 bg-card p-6">
              <div className="flex items-center gap-3">
                <Leaf className="h-4 w-4 text-primary" />
                <h2 className="font-serif text-2xl text-foreground">{t("site.internal_notes")}</h2>
              </div>
              <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-foreground/90">{proposal.notes}</p>
            </div>
          )}
        </div>

        <aside className="space-y-6">
          <div className="rounded-[1.75rem] border border-border/70 bg-card p-6">
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-primary" />
              <h2 className="font-serif text-2xl text-foreground">{t("site.record")}</h2>
            </div>
            <div className="mt-5 space-y-4 text-sm">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{t("site.created")}</p>
                <p className="mt-1 font-medium text-foreground">{formatDate(proposal.createdAt, t("site.not_set"), i18n.language)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{t("site.last_updated")}</p>
                <p className="mt-1 font-medium text-foreground">{formatDate(proposal.updatedAt || proposal.createdAt, t("site.not_set"), i18n.language)}</p>
              </div>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-border/70 bg-card p-6">
            <div className="flex items-center gap-3">
              <FileText className="h-4 w-4 text-primary" />
              <h2 className="font-serif text-2xl text-foreground">{t("site.documents")}</h2>
            </div>
            <div className="mt-5 space-y-3">
              {documents.length === 0 ? (
                <div className="rounded-2xl bg-muted/35 px-4 py-5 text-sm text-muted-foreground">
                  {t("site.no_documents_uploaded_for_this_proposal_yet")}
                </div>
              ) : (
                documents.map((document) => {
                  const isSafeUrl = isValidExternalUrl(document.url);
                  const content = (
                    <>
                      <p className="font-medium text-foreground">{document.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatFileSize(document.size)} • {formatDate(document.createdAt, t("site.not_set"), i18n.language)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("site.uploaded_by_name", {
                          firstName: document.uploader.firstName,
                          lastName: document.uploader.lastName,
                        })}
                      </p>
                    </>
                  );

                  if (!isSafeUrl) {
                    return (
                      <div
                        key={document.id}
                        className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-4"
                      >
                        {content}
                      </div>
                    );
                  }

                  return (
                    <a
                      key={document.id}
                      href={document.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded-2xl border border-border/60 bg-muted/20 px-4 py-4 transition-colors hover:bg-muted/40"
                    >
                      {content}
                    </a>
                  );
                })
              )}
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
