"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Search, MoreVertical, Trash2, Edit, DollarSign, Calendar, Building2, FolderKanban, TrendingUp, Upload, FileText } from "lucide-react";
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

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  submitted: "bg-blue-100 text-blue-800",
  under_review: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  withdrawn: "bg-purple-100 text-purple-800",
};

const statusLabels: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under Review",
  approved: "Approved",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

const SUPPORTED_CURRENCY_SET = new Set<string>(SUPPORTED_CURRENCIES);

function normalizeCurrency(currency: string): CurrencyCode {
  return SUPPORTED_CURRENCY_SET.has(currency) ? (currency as CurrencyCode) : "ETB";
}

export default function ProposalsPage() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [donors, setDonors] = useState<Donor[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [templates, setTemplates] = useState<ProposalTemplate[]>([]);
  const [documents, setDocuments] = useState<ProposalDocument[]>([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 25 });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
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

  const fetchProposals = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(pagination.page),
        limit: String(pagination.limit),
      });
      if (searchQuery.trim()) params.set("q", searchQuery.trim());
      if (filterStatus !== "all") params.set("status", filterStatus);
      if (filterType !== "all") params.set("proposalType", filterType);
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
      setLoading(false);
    }
  }, [searchQuery, filterStatus, filterType, pagination.page, pagination.limit]);

  useEffect(() => {
    fetchProposals();
  }, [fetchProposals]);

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
          await fetchProposals();
        }
      } else {
        const res = await fetch("/api/proposals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.proposal) {
          await fetchProposals();
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
      await fetchProposals();
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
        await fetchProposals();
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

  const pipelineStats = {
    total: proposals.length,
    draft: proposals.filter((p) => p.status === "draft").length,
    submitted: proposals.filter((p) => p.status === "submitted").length,
    underReview: proposals.filter((p) => p.status === "under_review").length,
    approved: proposals.filter((p) => p.status === "approved").length,
    totalAmount: proposals.reduce((sum, p) => sum + p.amountRequested, 0),
    approvedAmount: proposals
      .filter((p) => p.status === "approved")
      .reduce((sum, p) => sum + (p.amountApproved || p.amountRequested), 0),
  };

  if (loading) {
    return (
      <div className="p-6">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Proposal and ToR Tracker</h1>
          <p className="text-muted-foreground">Monitor proposals and ToR submissions from draft to decision</p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={isTemplateDialogOpen} onOpenChange={(open) => { setIsTemplateDialogOpen(open); if (!open) resetTemplateForm(); }}>
            <DialogTrigger asChild>
              <Button variant="outline">Manage Templates</Button>
            </DialogTrigger>
            <DialogContent className="w-[96vw] sm:max-w-[1200px] max-h-[88vh] overflow-hidden p-0 gap-0">
              <DialogHeader className="px-6 py-3 border-b">
                <DialogTitle>Template Manager</DialogTitle>
                <p className="text-sm text-muted-foreground">
                  Create reusable ToR templates in two steps: define template details, then add sections users will fill.
                </p>
              </DialogHeader>
              <div className="grid lg:grid-cols-[320px_1fr] min-h-0">
                <aside className="border-b lg:border-b-0 lg:border-r p-4 space-y-3 overflow-y-auto max-h-[72vh]">
                  <div className="space-y-2">
                    <Label htmlFor="template-search">Find template</Label>
                    <Input
                      id="template-search"
                      placeholder="Search by name or category"
                      value={templateSearch}
                      onChange={(e) => setTemplateSearch(e.target.value)}
                    />
                  </div>
                  <Button className="w-full" variant="outline" onClick={() => openTemplateEditor()}>
                    <Plus className="h-4 w-4 mr-2" /> New Template
                  </Button>
                  <div className="space-y-2">
                    {filteredTemplates.length === 0 ? (
                      <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                        No templates found. Create your first template to make ToR entry faster.
                      </div>
                    ) : (
                      filteredTemplates.map((template) => (
                        <div
                          key={template.id}
                          className={`w-full rounded-md border p-3 transition-colors ${
                            editingTemplate?.id === template.id ? "border-primary bg-muted" : "hover:bg-muted/60"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => openTemplateEditor(template)}
                              className="min-w-0 text-left flex-1"
                            >
                              <p className="font-medium truncate">{template.name}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {(template.category || "General")} - {template.sections?.length || 0} sections
                              </p>
                            </button>
                            <div className="flex items-center gap-1">
                              <Badge variant={template.isActive ? "default" : "secondary"}>
                                {template.isActive ? "Active" : "Inactive"}
                              </Badge>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                disabled={deletingTemplateId === template.id}
                                onClick={() => handleDeleteTemplate(template.id)}
                              >
                                <Trash2 className="h-4 w-4 text-red-600" />
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
                      <h3 className="text-base font-semibold">
                        {editingTemplate ? "Edit Template" : "Create Template"}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Step 1: Basic details. Step 2: Section fields users complete in ToR forms.
                      </p>
                    </div>

                    <div className="rounded-lg border p-4 space-y-4">
                      <p className="text-sm font-medium">Step 1 - Template Info</p>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="template-name">Template Name *</Label>
                          <Input
                            id="template-name"
                            value={templateForm.name}
                            onChange={(e) => setTemplateForm((prev) => ({ ...prev, name: e.target.value }))}
                            placeholder="Example: Procurement ToR"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="template-category">Category</Label>
                          <Input
                            id="template-category"
                            value={templateForm.category}
                            onChange={(e) => setTemplateForm((prev) => ({ ...prev, category: e.target.value }))}
                            placeholder="Procurement, Consultancy, Construction"
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
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="template-active">Status</Label>
                          <Select
                            value={templateForm.isActive ? "active" : "inactive"}
                            onValueChange={(value) => setTemplateForm((prev) => ({ ...prev, isActive: value === "active" }))}
                          >
                            <SelectTrigger id="template-active">
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

                    <div className="rounded-lg border p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">Step 2 - Template Sections *</p>
                          <p className="text-xs text-muted-foreground">
                            Each section appears as an input in the ToR form.
                          </p>
                        </div>
                        <Button type="button" size="sm" onClick={addTemplateSection}>
                          <Plus className="h-4 w-4 mr-1" /> Add Section
                        </Button>
                      </div>

                      {templateForm.sections.length === 0 ? (
                        <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                          Add your first section, e.g. Objective, Scope of Work, Deliverables.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {templateForm.sections.map((section, index) => (
                            <div key={`${section.key}-${index}`} className="rounded-md border p-3 space-y-3">
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-medium">Section {index + 1}</p>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => removeTemplateSection(index)}
                                >
                                  <Trash2 className="h-4 w-4 text-red-600" />
                                </Button>
                              </div>
                              <div className="grid md:grid-cols-2 gap-3">
                                <div className="space-y-2">
                                  <Label>Label *</Label>
                                  <Input
                                    placeholder="Section label shown to user"
                                    value={section.label}
                                    onChange={(e) => updateTemplateSection(index, { label: e.target.value })}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Key</Label>
                                  <Input
                                    placeholder="Internal field key"
                                    value={section.key}
                                    onChange={(e) => updateTemplateSection(index, { key: e.target.value })}
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
                                    <SelectTrigger>
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
                                    <SelectTrigger>
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
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {templateFormError ? (
                      <p className="text-sm text-red-600">{templateFormError}</p>
                    ) : null}

                    <div className="flex items-center justify-between">
                      <div className="flex gap-2">
                        {editingTemplate ? (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleDeleteTemplate(editingTemplate.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-1" /> Delete Template
                          </Button>
                        ) : null}
                      </div>
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" onClick={resetTemplateForm}>
                          Clear
                        </Button>
                        <Button type="submit" disabled={isTemplateSaving}>
                          {isTemplateSaving
                            ? (editingTemplate ? "Updating..." : "Creating...")
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
            <Button>
              <Plus className="h-4 w-4 mr-2" /> New Entry
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingProposal ? "Edit Entry" : "Create New Entry"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="title">Proposal Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
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
                      }))
                    }
                  >
                    <SelectTrigger>
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
                      <SelectTrigger>
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
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="torSubmissionRef">Submission Reference</Label>
                    <Input
                      id="torSubmissionRef"
                      value={formData.torSubmissionRef}
                      onChange={(e) => setFormData({ ...formData, torSubmissionRef: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {formData.proposalType === "tor" && selectedTemplate?.sections?.length ? (
                <div className="space-y-3 rounded-md border p-3">
                  <p className="text-sm font-medium">Template Sections</p>
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
                    <SelectTrigger>
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
                    <SelectTrigger>
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
                    <SelectTrigger>
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
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="decisionDate">Decision Date</Label>
                  <Input
                    id="decisionDate"
                    type="date"
                    value={formData.decisionDate}
                    onChange={(e) => setFormData({ ...formData, decisionDate: e.target.value })}
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
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">Project End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
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
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => { setIsAddDialogOpen(false); resetForm(); }}>
                  Cancel
                </Button>
                <Button type="submit">{editingProposal ? "Update" : "Create"} Entry</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Proposals</CardDescription>
            <CardTitle className="text-2xl">{pipelineStats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pipeline Value</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(pipelineStats.totalAmount, "ETB")}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Approved</CardDescription>
            <CardTitle className="text-2xl text-green-600">{pipelineStats.approved}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Approved Value</CardDescription>
            <CardTitle className="text-2xl text-green-600">{formatCurrency(pipelineStats.approvedAmount, "ETB")}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="flex gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search entries..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
            className="pl-9"
          />
        </div>
        <Select
          value={filterStatus}
          onValueChange={(value) => {
            setFilterStatus(value);
            setPagination((prev) => ({ ...prev, page: 1 }));
          }}
        >
          <SelectTrigger className="w-40">
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
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="grant">Grant</SelectItem>
            <SelectItem value="tor">ToR</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="list">
        <TabsList className="mb-4">
          <TabsTrigger value="list">List View</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline View</TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          {proposals.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-gray-500 mb-4">
                  {searchQuery || filterStatus !== "all" || filterType !== "all" ? "No entries match your search" : "No entries found"}
                </p>
                {!searchQuery && filterStatus === "all" && filterType === "all" && (
                  <Button onClick={() => setIsAddDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" /> Create your first entry
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {proposals.map((proposal) => (
                <Card key={proposal.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-gray-100 rounded-lg">
                          <TrendingUp className="h-5 w-5 text-gray-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium">{proposal.title}</h3>
                            <Badge variant="outline">
                              {proposal.proposalType === "tor" ? "ToR" : "Grant"}
                            </Badge>
                            <Badge className={statusColors[proposal.status]}>
                              {statusLabels[proposal.status]}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                            {proposal.donor && (
                              <div className="flex items-center gap-1">
                                <Building2 className="h-3 w-3" />
                                <span>{proposal.donor.name}</span>
                              </div>
                            )}
                            {proposal.project && (
                              <div className="flex items-center gap-1">
                                <FolderKanban className="h-3 w-3" />
                                <span>{proposal.project.name}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-1">
                              <DollarSign className="h-3 w-3" />
                              <span>{formatCurrency(proposal.amountRequested, proposal.currency)}</span>
                            </div>
                            {proposal.submissionDate && (
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                <span>{formatDate(proposal.submissionDate)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
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
                          <DropdownMenuItem onClick={() => handleDelete(proposal.id)} className="text-red-600">
                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing page {pagination.page} of {Math.max(1, Math.ceil((pagination.total || 1) / pagination.limit))}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page >= Math.ceil((pagination.total || 1) / pagination.limit)}
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
              >
                Next
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="pipeline">
          <div className="grid gap-4 md:grid-cols-5">
            {["draft", "submitted", "under_review", "approved", "rejected"].map((status) => (
              <div key={status} className="space-y-2">
                <div className="flex items-center justify-between p-2 bg-gray-100 rounded-lg">
                  <span className="font-medium text-sm">{statusLabels[status]}</span>
                  <Badge variant="secondary">
                    {proposals.filter((p) => p.status === status).length}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {proposals
                    .filter((p) => p.status === status)
                    .map((proposal) => (
                      <Card key={proposal.id} className="cursor-pointer hover:shadow-md transition-shadow">
                        <CardContent className="p-3">
                          <p className="font-medium text-sm truncate">{proposal.title}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {formatCurrency(proposal.amountRequested, proposal.currency)}
                          </p>
                          {proposal.donor && (
                            <p className="text-xs text-gray-400 mt-1 truncate">{proposal.donor.name}</p>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
      <Dialog open={!!documentsDialogProposal} onOpenChange={(open) => !open && setDocumentsDialogProposal(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Documents {documentsDialogProposal ? `- ${documentsDialogProposal.title}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <label className="inline-flex items-center gap-2 border rounded-md px-3 py-2 cursor-pointer hover:bg-muted/60">
              <Upload className="h-4 w-4" />
              <span className="text-sm">Upload document</span>
              <input type="file" className="hidden" onChange={handleDocumentUpload} />
            </label>
            {documents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No documents uploaded for this entry.</p>
            ) : (
              <div className="space-y-2">
                {documents.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between rounded border p-2 gap-3">
                    <a href={doc.url} target="_blank" rel="noreferrer" className="text-sm hover:underline truncate">
                      {doc.name}
                    </a>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteDocument(doc.id)}>
                      <Trash2 className="h-4 w-4 text-red-600" />
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
