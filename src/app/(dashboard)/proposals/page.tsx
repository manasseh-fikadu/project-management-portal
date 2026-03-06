"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Search,
  MoreVertical,
  Trash2,
  Edit,
  DollarSign,
  Calendar,
  Building2,
  FolderKanban,
  TrendingUp,
  Upload,
  FileText,
  Leaf,
  X,
} from "lucide-react";
import { CurrencyInput } from "@/components/currency-input";
import { formatCurrency as formatCurrencyUtil } from "@/lib/currency";
import { SUPPORTED_CURRENCIES, type CurrencyCode } from "@/lib/currency";

type Donor = {
  id: string;
  name: string;
  type: string;
};

type Project = {
  id: string;
  name: string;
};

type TemplateSection = {
  key?: string;
  name?: string;
  label?: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
};

type TemplateSectionForm = {
  key: string;
  label: string;
  type: "text" | "textarea";
  required: boolean;
  placeholder: string;
};

type ProposalTemplate = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  sections: TemplateSection[];
  isActive: boolean;
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
  donor: Donor | null;
  project: Project | null;
  template: { id: string; name: string; category: string | null } | null;
  creator: {
    id: string;
    firstName: string;
    lastName: string;
  };
};

const statusConfig: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  draft: { bg: "bg-muted", text: "text-muted-foreground", dot: "bg-muted-foreground", label: "Draft" },
  submitted: { bg: "bg-lavender-pale", text: "text-lavender", dot: "bg-lavender", label: "Submitted" },
  under_review: { bg: "bg-amber-pale", text: "text-amber-warm", dot: "bg-amber-warm", label: "Under Review" },
  approved: { bg: "bg-sage-pale", text: "text-primary", dot: "bg-primary", label: "Approved" },
  rejected: { bg: "bg-rose-pale", text: "text-rose-muted", dot: "bg-rose-muted", label: "Rejected" },
  withdrawn: { bg: "bg-muted", text: "text-muted-foreground", dot: "bg-muted-foreground", label: "Withdrawn" },
};

const typeConfig: Record<string, { bg: string; text: string; label: string }> = {
  grant: { bg: "bg-sage-pale", text: "text-primary", label: "Grant" },
  tor: { bg: "bg-lavender-pale", text: "text-lavender", label: "ToR" },
};

const pipelineColumnConfig: Record<string, { bg: string; headerBg: string; dotColor: string }> = {
  draft: { bg: "bg-muted/50", headerBg: "bg-card", dotColor: "bg-muted-foreground" },
  submitted: { bg: "bg-lavender-pale/30", headerBg: "bg-card", dotColor: "bg-lavender" },
  under_review: { bg: "bg-amber-pale/30", headerBg: "bg-card", dotColor: "bg-amber-warm" },
  approved: { bg: "bg-sage-pale/30", headerBg: "bg-card", dotColor: "bg-primary" },
  rejected: { bg: "bg-rose-pale/30", headerBg: "bg-card", dotColor: "bg-rose-muted" },
  withdrawn: { bg: "bg-muted/50", headerBg: "bg-card", dotColor: "bg-muted-foreground" },
};

const SUPPORTED_CURRENCY_SET = new Set<string>(SUPPORTED_CURRENCIES);

function normalizeCurrency(currency: string): CurrencyCode {
  return SUPPORTED_CURRENCY_SET.has(currency) ? (currency as CurrencyCode) : "ETB";
}

export default function ProposalsPage() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [pipelineProposals, setPipelineProposals] = useState<Proposal[]>([]);
  const [donors, setDonors] = useState<Donor[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [templates, setTemplates] = useState<ProposalTemplate[]>([]);
  const [documents, setDocuments] = useState<ProposalDocument[]>([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 25 });
  const [listLoading, setListLoading] = useState(true);
  const [pipelineLoading, setPipelineLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"list" | "pipeline">("list");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingProposal, setEditingProposal] = useState<Proposal | null>(null);
  const [documentsDialogProposal, setDocumentsDialogProposal] = useState<Proposal | null>(null);
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ProposalTemplate | null>(null);
  const [templateSearch, setTemplateSearch] = useState("");
  const [templateFormError, setTemplateFormError] = useState("");
  const [isTemplateSaving, setIsTemplateSaving] = useState(false);
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);
  const [templateForm, setTemplateForm] = useState({
    name: "",
    description: "",
    category: "",
    isActive: true,
    sections: [] as TemplateSectionForm[],
  });
  const [formData, setFormData] = useState({
    title: "",
    proposalType: "grant",
    donorId: "",
    projectId: "",
    templateId: "",
    torCode: "",
    torSubmissionRef: "",
    status: "draft",
    amountRequested: "",
    amountApproved: "",
    currency: "ETB",
    submissionDate: "",
    decisionDate: "",
    startDate: "",
    endDate: "",
    description: "",
    notes: "",
    templateData: {} as Record<string, string>,
  });

  useEffect(() => {
    fetchDonors();
    fetchProjects();
    fetchTemplates();
  }, []);

  useEffect(() => {
    if (!formData.templateId) return;
    const exists = templates.some((template) => template.id === formData.templateId && template.isActive);
    if (!exists) {
      setFormData((prev) => ({ ...prev, templateId: "", templateData: {} }));
    }
  }, [templates, formData.templateId]);

  const buildProposalParams = useCallback((page: number, limit: number) => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    if (searchQuery.trim()) params.set("q", searchQuery.trim());
    if (filterStatus !== "all") params.set("status", filterStatus);
    if (filterType !== "all") params.set("proposalType", filterType);
    return params;
  }, [searchQuery, filterStatus, filterType]);

  const fetchProposals = useCallback(async () => {
    try {
      setListLoading(true);
      const params = buildProposalParams(pagination.page, pagination.limit);
      const res = await fetch(`/api/proposals?${params.toString()}`);
      const data = await res.json();
      if (data.proposals) {
        setProposals(data.proposals);
      }
      if (data.pagination) {
        setPagination((prev) => ({
          ...prev,
          total: data.pagination.total ?? prev.total,
          page: data.pagination.page ?? prev.page,
          limit: data.pagination.limit ?? prev.limit,
        }));
      }
    } finally {
      setListLoading(false);
    }
  }, [buildProposalParams, pagination.page, pagination.limit]);

  const fetchAllProposals = useCallback(async () => {
    const pageSize = 100;

    try {
      setPipelineLoading(true);

      const firstPageParams = buildProposalParams(1, pageSize);
      const firstPageRes = await fetch(`/api/proposals?${firstPageParams.toString()}`);
      const firstPageData = await firstPageRes.json();
      const firstPageProposals: Proposal[] = firstPageData.proposals ?? [];
      const total = firstPageData.pagination?.total ?? firstPageProposals.length;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));

      if (totalPages === 1) {
        setPipelineProposals(firstPageProposals);
        return;
      }

      const remainingPages = await Promise.all(
        Array.from({ length: totalPages - 1 }, (_, index) => {
          const page = index + 2;
          const params = buildProposalParams(page, pageSize);
          return fetch(`/api/proposals?${params.toString()}`).then((response) => response.json());
        })
      );

      setPipelineProposals([
        ...firstPageProposals,
        ...remainingPages.flatMap((pageData) => pageData.proposals ?? []),
      ]);
    } finally {
      setPipelineLoading(false);
    }
  }, [buildProposalParams]);

  const refreshProposalData = useCallback(async () => {
    if (viewMode === "pipeline") {
      await Promise.all([fetchProposals(), fetchAllProposals()]);
      return;
    }

    await fetchProposals();
  }, [viewMode, fetchProposals, fetchAllProposals]);

  useEffect(() => {
    if (viewMode === "pipeline") {
      void Promise.all([fetchProposals(), fetchAllProposals()]);
      return;
    }

    void fetchProposals();
  }, [viewMode, fetchProposals, fetchAllProposals]);

  async function fetchDonors() {
    try {
      const res = await fetch("/api/donors");
      const data = await res.json();
      if (data.donors) {
        setDonors(data.donors);
      }
    } catch (error) {
      console.error("Error fetching donors:", error);
    }
  }

  async function fetchProjects() {
    try {
      const res = await fetch("/api/projects");
      const data = await res.json();
      if (data.projects) {
        setProjects(data.projects);
      }
    } catch (error) {
      console.error("Error fetching projects:", error);
    }
  }

  async function fetchTemplates() {
    try {
      const res = await fetch("/api/proposal-templates");
      const data = await res.json();
      if (data.templates) {
        setTemplates(data.templates);
      }
    } catch (error) {
      console.error("Error fetching templates:", error);
    }
  }

  function resetTemplateForm() {
    setTemplateFormError("");
    setTemplateForm({
      name: "",
      description: "",
      category: "",
      isActive: true,
      sections: [],
    });
    setEditingTemplate(null);
  }

  function openTemplateEditor(template?: ProposalTemplate) {
    setTemplateFormError("");
    if (!template) {
      resetTemplateForm();
      setIsTemplateDialogOpen(true);
      return;
    }
    setEditingTemplate(template);
    setTemplateForm({
      name: template.name,
      description: template.description || "",
      category: template.category || "",
      isActive: template.isActive,
      sections: (template.sections || []).map((section, idx) => ({
        key: section.key || section.name || `section_${idx + 1}`,
        label: section.label || section.name || "",
        type: section.type === "textarea" || section.type === "long_text" ? "textarea" : "text",
        required: Boolean(section.required),
        placeholder: section.placeholder || "",
      })),
    });
    setIsTemplateDialogOpen(true);
  }

  function addTemplateSection() {
    setTemplateFormError("");
    setTemplateForm((prev) => ({
      ...prev,
      sections: [
        ...prev.sections,
        {
          key: `section_${prev.sections.length + 1}`,
          label: "",
          type: "text",
          required: false,
          placeholder: "",
        },
      ],
    }));
  }

  function updateTemplateSection(index: number, patch: Partial<TemplateSectionForm>) {
    setTemplateForm((prev) => ({
      ...prev,
      sections: prev.sections.map((section, idx) =>
        idx === index ? { ...section, ...patch } : section
      ),
    }));
  }

  function removeTemplateSection(index: number) {
    setTemplateForm((prev) => ({
      ...prev,
      sections: prev.sections.filter((_, idx) => idx !== index),
    }));
  }

  async function saveTemplate(e: React.FormEvent) {
    e.preventDefault();
    if (isTemplateSaving) return;
    setTemplateFormError("");
    if (!templateForm.name.trim()) {
      setTemplateFormError("Template name is required.");
      return;
    }
    if (templateForm.sections.length === 0) {
      setTemplateFormError("Add at least one section.");
      return;
    }
    const hasInvalidSection = templateForm.sections.some(
      (section) => !section.label.trim()
    );
    if (hasInvalidSection) {
      setTemplateFormError("Each section needs a label.");
      return;
    }
    const normalizedSections = templateForm.sections.map((section, idx) => ({
      key: section.key.trim() || `section_${idx + 1}`,
      name: section.label.trim() || section.key.trim() || `Section ${idx + 1}`,
      label: section.label.trim() || section.key.trim() || `Section ${idx + 1}`,
      type: section.type,
      required: section.required,
      placeholder: section.placeholder.trim(),
    }));
    const payload = {
      name: templateForm.name.trim(),
      description: templateForm.description.trim() || null,
      category: templateForm.category.trim() || null,
      isActive: templateForm.isActive,
      sections: normalizedSections,
    };

    try {
      setIsTemplateSaving(true);
      if (editingTemplate) {
        await fetch(`/api/proposal-templates/${editingTemplate.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch("/api/proposal-templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      await fetchTemplates();
      resetTemplateForm();
    } catch (error) {
      console.error("Error saving template:", error);
      setTemplateFormError("Could not save template. Please try again.");
    } finally {
      setIsTemplateSaving(false);
    }
  }

  async function handleDeleteTemplate(templateId: string) {
    if (!confirm("Delete this template?")) return;
    try {
      setDeletingTemplateId(templateId);
      await fetch(`/api/proposal-templates/${templateId}`, { method: "DELETE" });
      await fetchTemplates();
      if (editingTemplate?.id === templateId) {
        resetTemplateForm();
      }
    } catch (error) {
      console.error("Error deleting template:", error);
    } finally {
      setDeletingTemplateId(null);
    }
  }

  function resetForm() {
    setFormData({
      title: "",
      proposalType: "grant",
      donorId: "",
      projectId: "",
      templateId: "",
      torCode: "",
      torSubmissionRef: "",
      status: "draft",
      amountRequested: "",
      amountApproved: "",
      currency: "ETB",
      submissionDate: "",
      decisionDate: "",
      startDate: "",
      endDate: "",
      description: "",
      notes: "",
      templateData: {},
    });
    setEditingProposal(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const payload = {
      ...formData,
      donorId: formData.donorId || null,
      projectId: formData.projectId || null,
      templateId: formData.templateId || null,
      amountRequested: parseInt(formData.amountRequested),
      amountApproved: formData.amountApproved ? parseInt(formData.amountApproved) : null,
      submissionDate: formData.submissionDate || null,
      decisionDate: formData.decisionDate || null,
      startDate: formData.startDate || null,
      endDate: formData.endDate || null,
      templateData: formData.proposalType === "tor" ? formData.templateData : null,
    };

    try {
      if (editingProposal) {
        const res = await fetch(`/api/proposals/${editingProposal.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.proposal) {
          await refreshProposalData();
        }
      } else {
        const res = await fetch("/api/proposals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.proposal) {
          await refreshProposalData();
        }
      }
      resetForm();
      setIsAddDialogOpen(false);
    } catch (error) {
      console.error("Error saving proposal:", error);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this proposal?")) return;

    try {
      await fetch(`/api/proposals/${id}`, { method: "DELETE" });
      await refreshProposalData();
    } catch (error) {
      console.error("Error deleting proposal:", error);
    }
  }

  async function handleStatusChange(id: string, newStatus: string) {
    try {
      const res = await fetch(`/api/proposals/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.proposal) {
        await refreshProposalData();
      }
    } catch (error) {
      console.error("Error updating proposal status:", error);
    }
  }

  function openEditDialog(proposal: Proposal) {
    setEditingProposal(proposal);
    setFormData({
      title: proposal.title,
      proposalType: proposal.proposalType || "grant",
      donorId: proposal.donor?.id || "",
      projectId: proposal.project?.id || "",
      templateId: proposal.templateId || "",
      torCode: proposal.torCode || "",
      torSubmissionRef: proposal.torSubmissionRef || "",
      status: proposal.status,
      amountRequested: proposal.amountRequested.toString(),
      amountApproved: proposal.amountApproved?.toString() || "",
      currency: normalizeCurrency(proposal.currency),
      submissionDate: proposal.submissionDate ? proposal.submissionDate.split("T")[0] : "",
      decisionDate: proposal.decisionDate ? proposal.decisionDate.split("T")[0] : "",
      startDate: proposal.startDate ? proposal.startDate.split("T")[0] : "",
      endDate: proposal.endDate ? proposal.endDate.split("T")[0] : "",
      description: proposal.description || "",
      notes: proposal.notes || "",
      templateData: proposal.templateData || {},
    });
    setIsAddDialogOpen(true);
  }

  async function openDocumentsDialog(proposal: Proposal) {
    setDocumentsDialogProposal(proposal);
    try {
      const res = await fetch(`/api/proposals/${proposal.id}/documents`);
      const data = await res.json();
      setDocuments(data.documents || []);
    } catch (error) {
      console.error("Error loading proposal documents:", error);
      setDocuments([]);
    }
  }

  async function handleDocumentUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !documentsDialogProposal) return;
    const formDataPayload = new FormData();
    formDataPayload.append("file", file);
    try {
      const res = await fetch(`/api/proposals/${documentsDialogProposal.id}/documents`, {
        method: "POST",
        body: formDataPayload,
      });
      const data = await res.json();
      if (data.document) {
        setDocuments((prev) => [data.document, ...prev]);
      }
    } catch (error) {
      console.error("Error uploading proposal document:", error);
    } finally {
      e.target.value = "";
    }
  }

  async function handleDeleteDocument(documentId: string) {
    try {
      await fetch(`/api/proposal-documents/${documentId}`, { method: "DELETE" });
      setDocuments((prev) => prev.filter((doc) => doc.id !== documentId));
    } catch (error) {
      console.error("Error deleting proposal document:", error);
    }
  }

  function formatCurrency(amount: number, currency: string) {
    return formatCurrencyUtil(amount, normalizeCurrency(currency));
  }

  function formatDate(date: string | null) {
    if (!date) return "Not set";
    return new Date(date).toLocaleDateString();
  }

  function formatFileSize(bytes: number) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  const activeTemplates = templates.filter((template) => template.isActive);
  const filteredTemplates = templates.filter((template) => {
    const q = templateSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      template.name.toLowerCase().includes(q) ||
      (template.category || "").toLowerCase().includes(q)
    );
  });
  const selectedTemplate = templates.find((template) => template.id === formData.templateId);

  const summaryProposals = viewMode === "pipeline" ? pipelineProposals : proposals;
  const totalsByCurrency: Record<string, { pipelineValue: number; approvedValue: number }> = {};
  for (const p of summaryProposals) {
    const c = normalizeCurrency(p.currency);
    if (!totalsByCurrency[c]) totalsByCurrency[c] = { pipelineValue: 0, approvedValue: 0 };
    totalsByCurrency[c].pipelineValue += p.amountRequested;
    if (p.status === "approved") {
      totalsByCurrency[c].approvedValue += p.amountApproved ?? p.amountRequested;
    }
  }
  const pipelineStats = {
    isPageScoped: viewMode !== "pipeline",
    total: summaryProposals.length,
    draft: summaryProposals.filter((p) => p.status === "draft").length,
    submitted: summaryProposals.filter((p) => p.status === "submitted").length,
    underReview: summaryProposals.filter((p) => p.status === "under_review").length,
    approved: summaryProposals.filter((p) => p.status === "approved").length,
    totalsByCurrency,
  };
  const summaryLabelPrefix = pipelineStats.isPageScoped ? "This Page - " : "";
  const pipelineViewProposals = viewMode === "pipeline" ? pipelineProposals : proposals;
  const loading = listLoading || (viewMode === "pipeline" && pipelineLoading);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Leaf className="h-6 w-6 animate-pulse text-primary" />
          <p className="text-sm text-muted-foreground">Loading proposals…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10">
      <header className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl lg:text-4xl text-foreground mb-2">
              Proposals & ToR
            </h1>
            <p className="text-sm text-muted-foreground">
              Monitor proposals and ToR submissions from draft to decision
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Dialog open={isTemplateDialogOpen} onOpenChange={(open) => { setIsTemplateDialogOpen(open); if (!open) resetTemplateForm(); }}>
              <DialogTrigger asChild>
                <Button variant="outline" className="rounded-xl">Manage Templates</Button>
              </DialogTrigger>
              <DialogContent className="w-[96vw] sm:max-w-[1200px] max-h-[88vh] overflow-hidden p-0 gap-0">
                <DialogHeader className="px-6 py-4 border-b border-border">
                  <DialogTitle className="font-serif text-xl">Template Manager</DialogTitle>
                  <p className="text-sm text-muted-foreground">
                    Create reusable ToR templates in two steps: define template details, then add sections users will fill.
                  </p>
                </DialogHeader>
                <div className="grid lg:grid-cols-[320px_1fr] min-h-0">
                  <aside className="border-b lg:border-b-0 lg:border-r border-border p-4 space-y-3 overflow-y-auto max-h-[72vh]">
                    <div className="space-y-2">
                      <Label htmlFor="template-search">Find template</Label>
                      <Input
                        id="template-search"
                        placeholder="Search by name or category"
                        value={templateSearch}
                        onChange={(e) => setTemplateSearch(e.target.value)}
                        className="rounded-xl"
                      />
                    </div>
                    <Button className="w-full rounded-xl" variant="outline" onClick={() => openTemplateEditor()}>
                      <Plus className="h-4 w-4 mr-2" /> New Template
                    </Button>
                    <div className="space-y-2">
                      {filteredTemplates.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                          No templates found. Create your first template to make ToR entry faster.
                        </div>
                      ) : (
                        filteredTemplates.map((template) => (
                          <div
                            key={template.id}
                            className={`w-full rounded-xl border border-border p-3 transition-colors ${
                              editingTemplate?.id === template.id ? "border-primary bg-sage-pale/50" : "hover:bg-muted/60"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => openTemplateEditor(template)}
                                className="min-w-0 text-left flex-1"
                              >
                                <p className="font-medium text-foreground truncate">{template.name}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {(template.category || "General")} · {template.sections?.length || 0} sections
                                </p>
                              </button>
                              <div className="flex items-center gap-1.5">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                  template.isActive ? "bg-sage-pale text-primary" : "bg-muted text-muted-foreground"
                                }`}>
                                  {template.isActive ? "Active" : "Inactive"}
                                </span>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-destructive"
                                  aria-label={`Delete template ${template.name || template.id}`}
                                  disabled={deletingTemplateId === template.id}
                                  onClick={() => handleDeleteTemplate(template.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </aside>

                  <section className="p-4 sm:p-5 overflow-y-auto max-h-[72vh]">
                    <form onSubmit={saveTemplate} className="space-y-6">
                      <div className="space-y-1">
                        <h3 className="font-serif text-lg text-foreground">
                          {editingTemplate ? "Edit Template" : "Create Template"}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Step 1: Basic details. Step 2: Section fields users complete in ToR forms.
                        </p>
                      </div>

                      <div className="rounded-xl border border-border p-4 space-y-4">
                        <p className="text-sm font-medium text-foreground">Step 1 — Template Info</p>
                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="template-name">Template Name *</Label>
                            <Input
                              id="template-name"
                              value={templateForm.name}
                              onChange={(e) => setTemplateForm((prev) => ({ ...prev, name: e.target.value }))}
                              placeholder="Example: Procurement ToR"
                              required
                              className="rounded-xl"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="template-category">Category</Label>
                            <Input
                              id="template-category"
                              value={templateForm.category}
                              onChange={(e) => setTemplateForm((prev) => ({ ...prev, category: e.target.value }))}
                              placeholder="Procurement, Consultancy, Construction"
                              className="rounded-xl"
                            />
                          </div>
                        </div>
                        <div className="grid md:grid-cols-[1fr_180px] gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="template-description">Description</Label>
                            <Textarea
                              id="template-description"
                              value={templateForm.description}
                              onChange={(e) => setTemplateForm((prev) => ({ ...prev, description: e.target.value }))}
                              rows={2}
                              placeholder="Explain when this template should be used."
                              className="rounded-xl"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="template-active">Status</Label>
                            <Select
                              value={templateForm.isActive ? "active" : "inactive"}
                              onValueChange={(value) => setTemplateForm((prev) => ({ ...prev, isActive: value === "active" }))}
                            >
                              <SelectTrigger id="template-active" className="rounded-xl">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="inactive">Inactive</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-xl border border-border p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-foreground">Step 2 — Template Sections *</p>
                            <p className="text-xs text-muted-foreground">
                              Each section appears as an input in the ToR form.
                            </p>
                          </div>
                          <Button type="button" size="sm" onClick={addTemplateSection} className="rounded-xl">
                            <Plus className="h-4 w-4 mr-1" /> Add Section
                          </Button>
                        </div>

                        {templateForm.sections.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                            Add your first section, e.g. Objective, Scope of Work, Deliverables.
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {templateForm.sections.map((section, index) => (
                              <div key={`${section.key}-${index}`} className="rounded-xl border border-border p-3 space-y-3">
                                <div className="flex items-center justify-between">
                                  <p className="text-sm font-medium text-foreground">Section {index + 1}</p>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => removeTemplateSection(index)}
                                    className="text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                                <div className="grid md:grid-cols-2 gap-3">
                                  <div className="space-y-2">
                                    <Label>Label *</Label>
                                    <Input
                                      placeholder="Section label shown to user"
                                      value={section.label}
                                      onChange={(e) => updateTemplateSection(index, { label: e.target.value })}
                                      className="rounded-xl"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Key</Label>
                                    <Input
                                      placeholder="Internal field key"
                                      value={section.key}
                                      onChange={(e) => updateTemplateSection(index, { key: e.target.value })}
                                      className="rounded-xl"
                                    />
                                  </div>
                                </div>
                                <div className="grid md:grid-cols-3 gap-3">
                                  <div className="space-y-2">
                                    <Label>Input type</Label>
                                    <Select
                                      value={section.type}
                                      onValueChange={(value: "text" | "textarea") =>
                                        updateTemplateSection(index, { type: value })
                                      }
                                    >
                                      <SelectTrigger className="rounded-xl">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="text">Single line</SelectItem>
                                        <SelectItem value="textarea">Multi line</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Required</Label>
                                    <Select
                                      value={section.required ? "required" : "optional"}
                                      onValueChange={(value) =>
                                        updateTemplateSection(index, { required: value === "required" })
                                      }
                                    >
                                      <SelectTrigger className="rounded-xl">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="optional">Optional</SelectItem>
                                        <SelectItem value="required">Required</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Placeholder</Label>
                                    <Input
                                      placeholder="Helper text inside field"
                                      value={section.placeholder}
                                      onChange={(e) =>
                                        updateTemplateSection(index, { placeholder: e.target.value })
                                      }
                                      className="rounded-xl"
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {templateFormError ? (
                        <p className="text-sm text-destructive">{templateFormError}</p>
                      ) : null}

                      <div className="flex items-center justify-between">
                        <div className="flex gap-2">
                          {editingTemplate ? (
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => handleDeleteTemplate(editingTemplate.id)}
                              className="text-destructive hover:text-destructive hover:bg-rose-pale rounded-xl"
                            >
                              <Trash2 className="h-4 w-4 mr-1.5" /> Delete Template
                            </Button>
                          ) : null}
                        </div>
                        <div className="flex gap-2">
                          <Button type="button" variant="ghost" onClick={resetTemplateForm}>
                            Clear
                          </Button>
                          <Button type="submit" disabled={isTemplateSaving} className="rounded-xl">
                            {isTemplateSaving
                              ? (editingTemplate ? "Updating…" : "Creating…")
                              : (editingTemplate ? "Update Template" : "Create Template")}
                          </Button>
                        </div>
                      </div>
                    </form>
                  </section>
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={isAddDialogOpen} onOpenChange={(open) => { setIsAddDialogOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button className="rounded-xl">
                  <Plus className="h-4 w-4 mr-2" /> New Entry
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="font-serif text-xl">
                    {editingProposal ? "Edit Entry" : "Create New Entry"}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-5 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Proposal Title *</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      required
                      className="rounded-xl"
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="proposalType">Entry Type</Label>
                      <Select
                        value={formData.proposalType}
                        onValueChange={(value) =>
                          setFormData((prev) => ({
                            ...prev,
                            proposalType: value,
                            templateId: value === "tor" ? prev.templateId : "",
                            templateData: value === "tor" ? prev.templateData : {},
                            torCode: value === "tor" ? prev.torCode : "",
                            torSubmissionRef: value === "tor" ? prev.torSubmissionRef : "",
                          }))
                        }
                      >
                        <SelectTrigger className="rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="grant">Grant Proposal</SelectItem>
                          <SelectItem value="tor">ToR Submission</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {formData.proposalType === "tor" && (
                      <div className="space-y-2">
                        <Label htmlFor="templateId">Template</Label>
                        <Select
                          value={formData.templateId}
                          onValueChange={(value) =>
                            setFormData((prev) => ({
                              ...prev,
                              templateId: value,
                              templateData: {},
                            }))
                          }
                        >
                          <SelectTrigger className="rounded-xl">
                            <SelectValue placeholder="Select template" />
                          </SelectTrigger>
                          <SelectContent>
                            {activeTemplates.map((template) => (
                              <SelectItem key={template.id} value={template.id}>
                                {template.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  {formData.proposalType === "tor" && (
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="torCode">ToR Code</Label>
                        <Input
                          id="torCode"
                          value={formData.torCode}
                          onChange={(e) => setFormData({ ...formData, torCode: e.target.value })}
                          placeholder="TOR-2026-001"
                          className="rounded-xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="torSubmissionRef">Submission Reference</Label>
                        <Input
                          id="torSubmissionRef"
                          value={formData.torSubmissionRef}
                          onChange={(e) => setFormData({ ...formData, torSubmissionRef: e.target.value })}
                          className="rounded-xl"
                        />
                      </div>
                    </div>
                  )}

                  {formData.proposalType === "tor" && selectedTemplate?.sections?.length ? (
                    <div className="space-y-3 rounded-xl border border-border p-4">
                      <p className="text-sm font-medium text-foreground">Template Sections</p>
                      {selectedTemplate.sections.map((section, index) => {
                        const fieldKey = section.key || section.name || `section_${index}`;
                        const fieldLabel = section.label || section.name || `Section ${index + 1}`;
                        const isLongText = section.type === "textarea" || section.type === "long_text";
                        return (
                          <div key={fieldKey} className="space-y-2">
                            <Label htmlFor={`template-${fieldKey}`}>
                              {fieldLabel}
                              {section.required ? " *" : ""}
                            </Label>
                            {isLongText ? (
                              <Textarea
                                id={`template-${fieldKey}`}
                                value={formData.templateData[fieldKey] || ""}
                                onChange={(e) =>
                                  setFormData((prev) => ({
                                    ...prev,
                                    templateData: { ...prev.templateData, [fieldKey]: e.target.value },
                                  }))
                                }
                                placeholder={section.placeholder || ""}
                                rows={3}
                                className="rounded-xl"
                              />
                            ) : (
                              <Input
                                id={`template-${fieldKey}`}
                                value={formData.templateData[fieldKey] || ""}
                                onChange={(e) =>
                                  setFormData((prev) => ({
                                    ...prev,
                                    templateData: { ...prev.templateData, [fieldKey]: e.target.value },
                                  }))
                                }
                                placeholder={section.placeholder || ""}
                                className="rounded-xl"
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="donorId">Donor</Label>
                      <Select
                        value={formData.donorId}
                        onValueChange={(value) => setFormData({ ...formData, donorId: value })}
                      >
                        <SelectTrigger className="rounded-xl">
                          <SelectValue placeholder="Select donor" />
                        </SelectTrigger>
                        <SelectContent>
                          {donors.map((donor) => (
                            <SelectItem key={donor.id} value={donor.id}>
                              {donor.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="projectId">Related Project</Label>
                      <Select
                        value={formData.projectId}
                        onValueChange={(value) => setFormData({ ...formData, projectId: value })}
                      >
                        <SelectTrigger className="rounded-xl">
                          <SelectValue placeholder="Select project" />
                        </SelectTrigger>
                        <SelectContent>
                          {projects.map((project) => (
                            <SelectItem key={project.id} value={project.id}>
                              {project.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="status">Status</Label>
                      <Select
                        value={formData.status}
                        onValueChange={(value) => setFormData({ ...formData, status: value })}
                      >
                        <SelectTrigger className="rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="submitted">Submitted</SelectItem>
                          <SelectItem value="under_review">Under Review</SelectItem>
                          <SelectItem value="approved">Approved</SelectItem>
                          <SelectItem value="rejected">Rejected</SelectItem>
                          <SelectItem value="withdrawn">Withdrawn</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="amountRequested">Amount Requested *</Label>
                      <CurrencyInput
                        id="amountRequested"
                        value={formData.amountRequested}
                        onChange={(val) => setFormData(prev => ({ ...prev, amountRequested: val }))}
                        currency={normalizeCurrency(formData.currency)}
                        onCurrencyChange={(c) => setFormData(prev => ({ ...prev, currency: c }))}
                        required
                      />
                    </div>
                  </div>

                  {formData.status === "approved" && (
                    <div className="space-y-2">
                      <Label htmlFor="amountApproved">Amount Approved</Label>
                      <CurrencyInput
                        id="amountApproved"
                        value={formData.amountApproved}
                        onChange={(val) => setFormData(prev => ({ ...prev, amountApproved: val }))}
                        currency={normalizeCurrency(formData.currency)}
                        onCurrencyChange={(c) => setFormData(prev => ({ ...prev, currency: c }))}
                      />
                    </div>
                  )}

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="submissionDate">Submission Date</Label>
                      <Input
                        id="submissionDate"
                        type="date"
                        value={formData.submissionDate}
                        onChange={(e) => setFormData({ ...formData, submissionDate: e.target.value })}
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="decisionDate">Decision Date</Label>
                      <Input
                        id="decisionDate"
                        type="date"
                        value={formData.decisionDate}
                        onChange={(e) => setFormData({ ...formData, decisionDate: e.target.value })}
                        className="rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="startDate">Project Start Date</Label>
                      <Input
                        id="startDate"
                        type="date"
                        value={formData.startDate}
                        onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="endDate">Project End Date</Label>
                      <Input
                        id="endDate"
                        type="date"
                        value={formData.endDate}
                        onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                        className="rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                      className="rounded-xl"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={2}
                      className="rounded-xl"
                    />
                  </div>

                  <div className="flex gap-2 justify-end">
                    <Button type="button" variant="ghost" onClick={() => { setIsAddDialogOpen(false); resetForm(); }}>
                      Cancel
                    </Button>
                    <Button type="submit" className="rounded-xl">
                      {editingProposal ? "Update" : "Create"} Entry
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      {/* Summary strip */}
      <div className="flex gap-3 mb-8 flex-wrap">
        <div className="px-4 py-2.5 bg-card rounded-xl">
          <span className="text-xs text-muted-foreground">{summaryLabelPrefix}Total</span>
          <p className="font-serif text-lg text-foreground">{pipelineStats.total}</p>
        </div>
        <div className="px-4 py-2.5 bg-sage-pale rounded-xl">
          <span className="text-xs text-muted-foreground">{summaryLabelPrefix}Pipeline Value</span>
          <p className="font-serif text-lg text-primary">
            {Object.keys(pipelineStats.totalsByCurrency).length === 0
              ? "—"
              : Object.entries(pipelineStats.totalsByCurrency)
                  .filter(([, v]) => v.pipelineValue > 0)
                  .map(([currency, v]) => formatCurrency(v.pipelineValue, currency))
                  .join(" · ")}
          </p>
        </div>
        <div className="px-4 py-2.5 bg-sage-pale rounded-xl">
          <span className="text-xs text-muted-foreground">{summaryLabelPrefix}Approved</span>
          <p className="font-serif text-lg text-primary">{pipelineStats.approved}</p>
        </div>
        <div className="px-4 py-2.5 bg-lavender-pale rounded-xl">
          <span className="text-xs text-muted-foreground">{summaryLabelPrefix}Approved Value</span>
          <p className="font-serif text-lg text-lavender">
            {Object.keys(pipelineStats.totalsByCurrency).length === 0
              ? "—"
              : Object.entries(pipelineStats.totalsByCurrency)
                  .filter(([, v]) => v.approvedValue > 0)
                  .map(([currency, v]) => formatCurrency(v.approvedValue, currency))
                  .join(" · ")}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-8 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search proposals…"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
            className="pl-10 rounded-xl bg-card"
          />
        </div>
        <Select
          value={filterStatus}
          onValueChange={(value) => {
            setFilterStatus(value);
            setPagination((prev) => ({ ...prev, page: 1 }));
          }}
        >
          <SelectTrigger className="w-40 rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="submitted">Submitted</SelectItem>
            <SelectItem value="under_review">Under Review</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="withdrawn">Withdrawn</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={filterType}
          onValueChange={(value) => {
            setFilterType(value);
            setPagination((prev) => ({ ...prev, page: 1 }));
          }}
        >
          <SelectTrigger className="w-36 rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="grant">Grant</SelectItem>
            <SelectItem value="tor">ToR</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex rounded-xl border border-border overflow-hidden">
          <button
            onClick={() => setViewMode("list")}
            className={`px-3.5 py-2 text-xs font-medium transition-colors ${
              viewMode === "list" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            List
          </button>
          <button
            onClick={() => setViewMode("pipeline")}
            className={`px-3.5 py-2 text-xs font-medium transition-colors ${
              viewMode === "pipeline" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            Pipeline
          </button>
        </div>
      </div>

      {/* List View */}
      {viewMode === "list" && (
        <>
          {proposals.length === 0 ? (
            <div className="py-20 text-center">
              <TrendingUp className="h-10 w-10 mx-auto mb-3 text-primary/25" />
              <p className="text-sm text-muted-foreground mb-5">
                {searchQuery || filterStatus !== "all" || filterType !== "all"
                  ? "No entries match your filters"
                  : "No proposals yet — create your first entry"}
              </p>
              {!searchQuery && filterStatus === "all" && filterType === "all" && (
                <Button onClick={() => setIsAddDialogOpen(true)} className="rounded-xl">
                  <Plus className="h-4 w-4 mr-2" /> Create your first entry
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {proposals.map((proposal) => {
                const status = statusConfig[proposal.status] || statusConfig.draft;
                const type = typeConfig[proposal.proposalType] || typeConfig.grant;
                return (
                  <div
                    key={proposal.id}
                    className="bg-card rounded-2xl p-5 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 group"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4 min-w-0">
                        <div className={`p-2.5 rounded-xl shrink-0 ${type.bg}`}>
                          <TrendingUp className={`h-5 w-5 ${type.text}`} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1.5">
                            <h3 className="font-serif text-lg text-foreground leading-snug">
                              {proposal.title}
                            </h3>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${type.bg} ${type.text}`}>
                              {type.label}
                            </span>
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ${status.bg} ${status.text}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                              {status.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 flex-wrap text-sm text-muted-foreground">
                            {proposal.donor && (
                              <span className="flex items-center gap-1.5">
                                <Building2 className="h-3.5 w-3.5 shrink-0" />
                                {proposal.donor.name}
                              </span>
                            )}
                            {proposal.project && (
                              <span className="flex items-center gap-1.5">
                                <FolderKanban className="h-3.5 w-3.5 shrink-0" />
                                {proposal.project.name}
                              </span>
                            )}
                            <span className="flex items-center gap-1.5">
                              <DollarSign className="h-3.5 w-3.5 shrink-0" />
                              {formatCurrency(proposal.amountRequested, proposal.currency)}
                            </span>
                            {proposal.submissionDate && (
                              <span className="flex items-center gap-1.5">
                                <Calendar className="h-3.5 w-3.5 shrink-0" />
                                {formatDate(proposal.submissionDate)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground shrink-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(proposal)}>
                            <Edit className="h-4 w-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openDocumentsDialog(proposal)}>
                            <FileText className="h-4 w-4 mr-2" /> Documents
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(proposal.id, "submitted")}>
                            Mark as Submitted
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(proposal.id, "under_review")}>
                            Mark as Under Review
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(proposal.id, "approved")}>
                            Mark as Approved
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(proposal.id, "rejected")}>
                            Mark as Rejected
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDelete(proposal.id)} className="text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          <div className="mt-6 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Page {pagination.page} of {Math.max(1, Math.ceil((pagination.total || 1) / pagination.limit))}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl"
                disabled={pagination.page <= 1}
                onClick={() => setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl"
                disabled={pagination.page >= Math.ceil((pagination.total || 1) / pagination.limit)}
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Pipeline View */}
      {viewMode === "pipeline" && (
        <div className="grid gap-5 md:grid-cols-6">
          {(["draft", "submitted", "under_review", "approved", "rejected", "withdrawn"] as const).map((status) => {
            const col = pipelineColumnConfig[status];
            const sc = statusConfig[status];
            const columnProposals = pipelineViewProposals.filter((p) => p.status === status);
            return (
              <div key={status} className={`rounded-2xl ${col.bg}`}>
                <div className={`flex items-center justify-between p-4 ${col.headerBg} rounded-t-2xl`}>
                  <div className="flex items-center gap-2.5">
                    <span className={`h-2 w-2 rounded-full ${col.dotColor}`} />
                    <h2 className="font-medium text-sm text-foreground">{sc.label}</h2>
                  </div>
                  <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {columnProposals.length}
                  </span>
                </div>
                <div className="p-2.5 min-h-[180px] space-y-2.5">
                  {columnProposals.map((proposal) => {
                    const type = typeConfig[proposal.proposalType] || typeConfig.grant;
                    return (
                      <button
                        type="button"
                        key={proposal.id}
                        className="w-full text-left bg-card rounded-xl p-3.5 cursor-pointer transition-all duration-150 hover:shadow-md hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        onClick={() => openEditDialog(proposal)}
                        aria-label={`Edit proposal: ${proposal.title}`}
                      >
                        <h3 className="text-sm font-medium text-foreground line-clamp-2 leading-snug mb-2">
                          {proposal.title}
                        </h3>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${type.bg} ${type.text}`}>
                            {type.label}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {formatCurrency(proposal.amountRequested, proposal.currency)}
                          </span>
                        </div>
                        {proposal.donor && (
                          <p className="text-[11px] text-muted-foreground mt-1.5 truncate">
                            {proposal.donor.name}
                          </p>
                        )}
                      </button>
                    );
                  })}
                  {columnProposals.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <TrendingUp className="h-6 w-6 text-primary/15 mb-2" />
                      <p className="text-xs text-muted-foreground">No entries</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Documents Dialog */}
      <Dialog open={!!documentsDialogProposal} onOpenChange={(open) => !open && setDocumentsDialogProposal(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">
              Documents {documentsDialogProposal ? `— ${documentsDialogProposal.title}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Attachments</p>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <Button size="sm" variant="outline" className="rounded-xl h-7 text-xs" asChild>
                  <span>
                    <Upload className="h-3 w-3 mr-1.5" /> Upload
                  </span>
                </Button>
                <input type="file" className="hidden" onChange={handleDocumentUpload} />
              </label>
            </div>

            {documents.length === 0 ? (
              <div className="py-8 text-center">
                <FileText className="h-6 w-6 mx-auto mb-1.5 text-primary/15" />
                <p className="text-xs text-muted-foreground">No documents uploaded for this entry</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {documents.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-2.5 p-2.5 hover:bg-muted/40 rounded-xl group transition-colors">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-foreground hover:text-primary truncate block transition-colors"
                      >
                        {doc.name}
                      </a>
                      <p className="text-[11px] text-muted-foreground">
                        {formatFileSize(doc.size)} · {formatDate(doc.createdAt)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100 h-6 w-6 text-destructive transition-opacity"
                      onClick={() => handleDeleteDocument(doc.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
