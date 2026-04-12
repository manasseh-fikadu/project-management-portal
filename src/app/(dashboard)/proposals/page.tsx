"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TorDocumentEditor } from "@/components/ui/tor-document-editor";
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
  LocateFixed,
  MapPin,
} from "lucide-react";
import { CurrencyInput } from "@/components/currency-input";
import { formatCurrency as formatCurrencyUtil } from "@/lib/currency";
import { SUPPORTED_CURRENCIES, type CurrencyCode } from "@/lib/currency";
import { isRichTextEmpty } from "@/lib/rich-text";
import {
  buildDocumentLocationMapUrl,
  DOCUMENT_LOCATION_TIMEOUT_MS,
  getDocumentLocationDisplayName,
  getGeolocationErrorMessage,
  parseDocumentMetadata,
  resolveLocationLabelFromCoordinates,
  type DocumentMetadata,
} from "@/lib/document-location";

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
  metadata?: DocumentMetadata | null;
  createdAt: string;
  uploader: {
    id: string;
    firstName: string;
    lastName: string;
  };
};

type UploadLocationState = {
  label: string;
  latitude: number | null;
  longitude: number | null;
  accuracyMeters: number | null;
  capturedAt: string | null;
};

function createEmptyUploadLocation(): UploadLocationState {
  return {
    label: "",
    latitude: null,
    longitude: null,
    accuracyMeters: null,
    capturedAt: null,
  };
}

function buildUploadLocationPayload(location: UploadLocationState): string | null {
  const label = location.label.trim();
  const hasCoordinates = location.latitude !== null && location.longitude !== null;

  if (!label && !hasCoordinates) return null;

  return JSON.stringify({
    label: label || null,
    latitude: location.latitude,
    longitude: location.longitude,
    accuracyMeters: location.accuracyMeters,
    capturedAt: location.capturedAt ?? new Date().toISOString(),
    source: hasCoordinates ? "browser_geolocation" : "manual",
  });
}

function getDocumentLocation(document: ProposalDocument) {
  return parseDocumentMetadata(document.metadata)?.location ?? null;
}

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

function getStandardTorTemplate(t: (key: string) => string): ProposalTemplate {
  return {
    id: "standard-tor-starter",
    name: t("site.standard_terms_of_reference_tor"),
    description: t("site.standard_tor_description"),
    category: t("site.general_tor"),
    isActive: true,
    sections: [
      {
        key: "background",
        name: t("site.background"),
        label: t("site.background"),
        type: "textarea",
        required: true,
        placeholder: t("site.background_placeholder"),
      },
      {
        key: "objective",
        name: t("site.objective"),
        label: t("site.objective"),
        type: "textarea",
        required: true,
        placeholder: t("site.objective_placeholder"),
      },
      {
        key: "scope_of_work",
        name: t("site.scope_of_work"),
        label: t("site.scope_of_work"),
        type: "textarea",
        required: true,
        placeholder: t("site.scope_of_work_placeholder"),
      },
      {
        key: "deliverables",
        name: t("site.deliverables"),
        label: t("site.deliverables"),
        type: "textarea",
        required: true,
        placeholder: t("site.deliverables_placeholder"),
      },
      {
        key: "duration_timeline",
        name: t("site.duration_and_timeline"),
        label: t("site.duration_and_timeline"),
        type: "textarea",
        required: true,
        placeholder: t("site.duration_and_timeline_placeholder"),
      },
      {
        key: "reporting_supervision",
        name: t("site.reporting_and_supervision"),
        label: t("site.reporting_and_supervision"),
        type: "textarea",
        required: false,
        placeholder: t("site.reporting_and_supervision_placeholder"),
      },
      {
        key: "required_qualifications",
        name: t("site.required_qualifications"),
        label: t("site.required_qualifications"),
        type: "textarea",
        required: true,
        placeholder: t("site.required_qualifications_placeholder"),
      },
      {
        key: "evaluation_criteria",
        name: t("site.evaluation_criteria"),
        label: t("site.evaluation_criteria"),
        type: "textarea",
        required: false,
        placeholder: t("site.evaluation_criteria_placeholder"),
      },
    ],
  };
}

const statusConfig: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  draft: { bg: "bg-muted", text: "text-muted-foreground", dot: "bg-muted-foreground", label: "site.draft" },
  submitted: { bg: "bg-lavender-pale", text: "text-lavender", dot: "bg-lavender", label: "site.submitted" },
  under_review: { bg: "bg-amber-pale", text: "text-amber-warm", dot: "bg-amber-warm", label: "site.under_review" },
  approved: { bg: "bg-sage-pale", text: "text-primary", dot: "bg-primary", label: "site.approved" },
  rejected: { bg: "bg-rose-pale", text: "text-rose-muted", dot: "bg-rose-muted", label: "site.rejected" },
  withdrawn: { bg: "bg-muted", text: "text-muted-foreground", dot: "bg-muted-foreground", label: "site.withdrawn" },
};

const typeConfig: Record<string, { bg: string; text: string; label: string }> = {
  grant: { bg: "bg-sage-pale", text: "text-primary", label: "site.grant" },
  tor: { bg: "bg-lavender-pale", text: "text-lavender", label: "site.tor" },
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

function buildTemplateForm(template: ProposalTemplate): {
  name: string;
  description: string;
  category: string;
  isActive: boolean;
  sections: TemplateSectionForm[];
} {
  return {
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
  };
}

export default function ProposalsPage() {
  const { t } = useTranslation();
  const router = useRouter();
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
  const [uploadLocation, setUploadLocation] = useState<UploadLocationState>(createEmptyUploadLocation());
  const [capturingUploadLocation, setCapturingUploadLocation] = useState(false);
  const [uploadLocationError, setUploadLocationError] = useState("");
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ProposalTemplate | null>(null);
  const [templateSearch, setTemplateSearch] = useState("");
  const [proposalFormError, setProposalFormError] = useState("");
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

  const fetchDonors = useCallback(async () => {
    try {
      const res = await fetch("/api/donors");
      const data = await res.json();
      if (data.donors) {
        setDonors(data.donors);
      }
    } catch (error) {
      console.error(t("site.error_fetching_donors"), error);
    }
  }, [t]);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/projects");
      const data = await res.json();
      if (data.projects) {
        setProjects(data.projects);
      }
    } catch (error) {
      console.error(t("site.error_fetching_projects"), error);
    }
  }, [t]);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/proposal-templates");
      const data = await res.json();
      if (data.templates) {
        setTemplates(data.templates);
      }
    } catch (error) {
      console.error(t("site.error_fetching_templates"), error);
    }
  }, [t]);

  useEffect(() => {
    fetchDonors();
    fetchProjects();
    fetchTemplates();
  }, [fetchDonors, fetchProjects, fetchTemplates]);

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
    setTemplateForm(buildTemplateForm(template));
    setIsTemplateDialogOpen(true);
  }

  function useStarterTemplate() {
    setTemplateFormError("");
    setEditingTemplate(null);
    setTemplateForm(buildTemplateForm(getStandardTorTemplate(t)));
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
      setTemplateFormError(t("site.template_name_is_required"));
      return;
    }
    if (templateForm.sections.length === 0) {
      setTemplateFormError(t("site.add_at_least_one_section"));
      return;
    }
    const hasInvalidSection = templateForm.sections.some(
      (section) => !section.label.trim()
    );
    if (hasInvalidSection) {
      setTemplateFormError(t("site.each_section_needs_a_label"));
      return;
    }
    const normalizedSections = templateForm.sections.map((section, idx) => ({
      key: section.key.trim() || `section_${idx + 1}`,
      name: section.label.trim() || section.key.trim() || `section_${idx + 1}`,
      label: section.label.trim() || section.key.trim() || `section_${idx + 1}`,
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
      console.error(t("site.error_saving_template"), error);
      setTemplateFormError(t("site.could_not_save_template_please_try_again"));
    } finally {
      setIsTemplateSaving(false);
    }
  }

  async function handleDeleteTemplate(templateId: string) {
    if (!confirm(t("site.delete_this_template"))) return;
    try {
      setDeletingTemplateId(templateId);
      await fetch(`/api/proposal-templates/${templateId}`, { method: "DELETE" });
      await fetchTemplates();
      if (editingTemplate?.id === templateId) {
        resetTemplateForm();
      }
    } catch (error) {
      console.error(t("site.error_deleting_template"), error);
    } finally {
      setDeletingTemplateId(null);
    }
  }

  function resetForm() {
    setProposalFormError("");
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
    setProposalFormError("");

    if (formData.proposalType === "tor") {
      if (!selectedTemplate) {
        setProposalFormError(`${t("site.template")}: ${t("site.required_label")}`);
        return;
      }

      const missingRequiredSections = selectedTemplateSections
        .filter((section) => section.required && isRichTextEmpty(formData.templateData[section.key]))
        .map((section) => section.label);

      if (missingRequiredSections.length > 0) {
        setProposalFormError(`${t("site.required")}: ${missingRequiredSections.join(", ")}`);
        return;
      }
    }

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
        if (!res.ok || !data.proposal) {
          throw new Error(data.error || "Could not save proposal.");
        }
        await refreshProposalData();
      } else {
        const res = await fetch("/api/proposals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok || !data.proposal) {
          throw new Error(data.error || "Could not save proposal.");
        }
        await refreshProposalData();
      }
      resetForm();
      setIsAddDialogOpen(false);
    } catch (error) {
      setProposalFormError(error instanceof Error ? error.message : "Could not save proposal.");
      console.error(t("site.error_saving_proposal"), error);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(t("site.are_you_sure_you_want_to_delete_this_proposal"))) return;

    try {
      await fetch(`/api/proposals/${id}`, { method: "DELETE" });
      await refreshProposalData();
    } catch (error) {
      console.error(t("site.error_deleting_proposal"), error);
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
      console.error(t("site.error_updating_proposal_status"), error);
    }
  }

  function openEditDialog(proposal: Proposal) {
    setProposalFormError("");
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
    setUploadLocationError("");
    try {
      const res = await fetch(`/api/proposals/${proposal.id}/documents`);
      const data = await res.json();
      setDocuments(data.documents || []);
    } catch (error) {
      console.error(t("site.error_loading_proposal_documents"), error);
      setDocuments([]);
    }
  }

  async function handleDocumentUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !documentsDialogProposal) return;
    const formDataPayload = new FormData();
    formDataPayload.append("file", file);
    const locationPayload = buildUploadLocationPayload(uploadLocation);
    if (locationPayload) {
      formDataPayload.append("locationMetadata", locationPayload);
    }
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
      console.error(t("site.error_uploading_proposal_document"), error);
    } finally {
      e.target.value = "";
    }
  }

  async function captureUploadLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setUploadLocationError(t("site.geolocation_not_supported"));
      return;
    }

    setCapturingUploadLocation(true);
    setUploadLocationError("");

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: DOCUMENT_LOCATION_TIMEOUT_MS,
          maximumAge: 60000,
        });
      });
      const resolvedLabel = await resolveLocationLabelFromCoordinates(
        position.coords.latitude,
        position.coords.longitude
      );

      setUploadLocation((current) => ({
        ...current,
        label: current.label.trim() || resolvedLabel || "",
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracyMeters: position.coords.accuracy,
        capturedAt: new Date(position.timestamp).toISOString(),
      }));
    } catch (error) {
      const geolocationError =
        error && typeof error === "object" && "code" in error
          ? (error as GeolocationPositionError)
          : null;
      setUploadLocationError(getGeolocationErrorMessage(t, geolocationError));
    } finally {
      setCapturingUploadLocation(false);
    }
  }

  async function handleDeleteDocument(documentId: string) {
    try {
      await fetch(`/api/proposal-documents/${documentId}`, { method: "DELETE" });
      setDocuments((prev) => prev.filter((doc) => doc.id !== documentId));
    } catch (error) {
      console.error(t("site.error_deleting_proposal_document"), error);
    }
  }

  function formatCurrency(amount: number, currency: string) {
    return formatCurrencyUtil(amount, normalizeCurrency(currency));
  }

  function formatDate(date: string | null) {
    if (!date) return t("site.not_set");
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
  const selectedTemplateSections = selectedTemplate?.sections.map((section, index) => ({
    key: section.key || section.name || `section_${index + 1}`,
    label: section.label || section.name || t("site.section_number", { number: index + 1 }),
    placeholder: section.placeholder || "",
    required: Boolean(section.required),
  })) || [];
  const standardTorTemplate = getStandardTorTemplate(t);

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
  const summaryLabelPrefix = pipelineStats.isPageScoped ? `${t("site.this_page")} - ` : "";
  const pipelineViewProposals = viewMode === "pipeline" ? pipelineProposals : proposals;
  const loading = listLoading || (viewMode === "pipeline" && pipelineLoading);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Leaf className="h-6 w-6 animate-pulse text-primary" />
          <p className="text-sm text-muted-foreground">{t("site.loading_proposals")}</p>
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
              {t("site.proposals_and_tor")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("site.monitor_proposals_and_tor_submissions_from_draft_to_decision")}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Dialog open={isTemplateDialogOpen} onOpenChange={(open) => { setIsTemplateDialogOpen(open); if (!open) resetTemplateForm(); }}>
              <DialogTrigger asChild>
                <Button variant="outline" className="rounded-xl">{t("site.manage_templates")}</Button>
              </DialogTrigger>
              <DialogContent className="w-[96vw] sm:max-w-[1200px] max-h-[88vh] overflow-hidden p-0 gap-0">
                <DialogHeader className="px-6 py-4 border-b border-border">
                  <DialogTitle className="font-serif text-xl">{t("site.template_manager")}</DialogTitle>
                  <p className="text-sm text-muted-foreground">
                    {t("site.start_from_a_standard_tor_structure_or_build_your_own_users_can_customize_any_saved_template_before_using_it_in_submissions")}
                  </p>
                </DialogHeader>
                <div className="grid lg:grid-cols-[320px_1fr] min-h-0">
                  <aside className="border-b lg:border-b-0 lg:border-r border-border p-4 space-y-3 overflow-y-auto max-h-[72vh]">
                    <div className="rounded-[1.25rem] border border-primary/20 bg-[linear-gradient(145deg,rgba(201,228,193,0.35),rgba(242,235,220,0.82))] p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary/80">
                            {t("site.ready_to_use")}
                          </p>
                          <h3 className="font-serif text-lg leading-tight text-foreground">
                            {standardTorTemplate.name}
                          </h3>
                        </div>
                        <span className="rounded-full bg-card/80 px-2.5 py-1 text-[10px] font-semibold text-primary shadow-sm">
                          {t("site.recommended")}
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-foreground/75">
                        {t("site.includes_the_sections_most_teams_expect_background_objective_scope_deliverables_timeline_reporting_qualifications_and_evaluation_criteria")}
                      </p>
                      <Button type="button" onClick={useStarterTemplate} className="mt-4 w-full rounded-xl">
                        <FileText className="mr-2 h-4 w-4" /> {t("site.use_standard_tor")}
                      </Button>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="template-search">{t("site.find_template")}</Label>
                      <Input
                        id="template-search"
                        placeholder={t("site.search_by_name_or_category")}
                        value={templateSearch}
                        onChange={(e) => setTemplateSearch(e.target.value)}
                        className="rounded-xl"
                      />
                    </div>
                    <Button className="w-full rounded-xl" variant="outline" onClick={() => openTemplateEditor()}>
                      <Plus className="h-4 w-4 mr-2" /> {t("site.start_blank")}
                    </Button>
                    <div className="space-y-2">
                      {filteredTemplates.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                          {t("site.no_saved_templates_yet_use_the_standard_starter_above_or_build_one_from_scratch")}
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
                                  {(template.category || t("site.general"))} · {t("site.sections_count", { count: template.sections?.length || 0 })}
                                </p>
                              </button>
                              <div className="flex items-center gap-1.5">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                  template.isActive ? "bg-sage-pale text-primary" : "bg-muted text-muted-foreground"
                                }`}>
                                  {template.isActive ? t("site.active") : t("site.inactive")}
                                </span>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-destructive"
                                  aria-label={t("site.delete_template")}
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
                          {editingTemplate ? t("site.edit_template") : t("site.create_template")}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {t("site.step_1_confirm_template_details_step_2_tailor_the_sections_users_will_complete_in_tor_submissions")}
                        </p>
                      </div>

                      <div className="rounded-xl border border-border p-4 space-y-4">
                        <p className="text-sm font-medium text-foreground">{t("site.step_1_template_info")}</p>
                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="template-name">{t("site.template_name")}</Label>
                            <Input
                              id="template-name"
                              value={templateForm.name}
                              onChange={(e) => setTemplateForm((prev) => ({ ...prev, name: e.target.value }))}
                              placeholder={t("site.example_procurement_tor")}
                              required
                              className="rounded-xl"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="template-category">{t("site.category")}</Label>
                            <Input
                              id="template-category"
                              value={templateForm.category}
                              onChange={(e) => setTemplateForm((prev) => ({ ...prev, category: e.target.value }))}
                              placeholder={t("site.procurement_consultancy_construction")}
                              className="rounded-xl"
                            />
                          </div>
                        </div>
                        <div className="grid md:grid-cols-[1fr_180px] gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="template-description">{t("site.description")}</Label>
                            <Textarea
                              id="template-description"
                              value={templateForm.description}
                              onChange={(e) => setTemplateForm((prev) => ({ ...prev, description: e.target.value }))}
                              rows={2}
                              placeholder={t("site.explain_when_this_template_should_be_used")}
                              className="rounded-xl"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="template-active">{t("site.status")}</Label>
                            <Select
                              value={templateForm.isActive ? "active" : "inactive"}
                              onValueChange={(value) => setTemplateForm((prev) => ({ ...prev, isActive: value === "active" }))}
                            >
                              <SelectTrigger id="template-active" className="rounded-xl">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="active">{t("site.active")}</SelectItem>
                                <SelectItem value="inactive">{t("site.inactive")}</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-xl border border-border p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-foreground">{t("site.step_2_template_sections")}</p>
                            <p className="text-xs text-muted-foreground">
                              {t("site.each_section_appears_as_an_input_in_the_tor_form")}
                            </p>
                          </div>
                          <Button type="button" size="sm" onClick={addTemplateSection} className="rounded-xl">
                            <Plus className="h-4 w-4 mr-1" /> {t("site.add_section")}
                          </Button>
                        </div>

                        {templateForm.sections.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                            {t("site.add_your_first_section_eg_objective_scope_of_work_deliverables")}
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {templateForm.sections.map((section, index) => (
                              <div key={`${section.key}-${index}`} className="rounded-xl border border-border p-3 space-y-3">
                                <div className="flex items-center justify-between">
                                  <p className="text-sm font-medium text-foreground">{t("site.section_number", { number: index + 1 })}</p>
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
                                    <Label>{t("site.label")}</Label>
                                    <Input
                                      placeholder={t("site.section_label_shown_to_user")}
                                      value={section.label}
                                      onChange={(e) => updateTemplateSection(index, { label: e.target.value })}
                                      className="rounded-xl"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>{t("site.key")}</Label>
                                    <Input
                                      placeholder={t("site.internal_field_key")}
                                      value={section.key}
                                      onChange={(e) => updateTemplateSection(index, { key: e.target.value })}
                                      className="rounded-xl"
                                    />
                                  </div>
                                </div>
                                <div className="grid md:grid-cols-3 gap-3">
                                  <div className="space-y-2">
                                    <Label>{t("site.input_type")}</Label>
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
                                        <SelectItem value="text">{t("site.single_line")}</SelectItem>
                                        <SelectItem value="textarea">{t("site.multi_line")}</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-2">
                                    <Label>{t("site.required")}</Label>
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
                                        <SelectItem value="optional">{t("site.optional_label")}</SelectItem>
                                        <SelectItem value="required">{t("site.required_label")}</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-2">
                                    <Label>{t("site.placeholder")}</Label>
                                    <Input
                                      placeholder={t("site.helper_text_inside_field")}
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
                              <Trash2 className="h-4 w-4 mr-1.5" /> {t("site.delete_template")}
                            </Button>
                          ) : null}
                        </div>
                        <div className="flex gap-2">
                          <Button type="button" variant="ghost" onClick={resetTemplateForm}>
                            {t("site.clear")}
                          </Button>
                          <Button type="submit" disabled={isTemplateSaving} className="rounded-xl">
                            {isTemplateSaving
                              ? (editingTemplate ? t("site.updating") : t("site.creating"))
                              : (editingTemplate ? t("site.update_template") : t("site.create_template"))}
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
                  <Plus className="h-4 w-4 mr-2" /> {t("site.new_entry")}
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[96vw] sm:max-w-5xl max-h-[92vh] overflow-y-auto p-0 gap-0">
                <DialogHeader>
                  <DialogTitle className="border-b border-border/70 px-6 py-4 font-serif text-xl">
                    {editingProposal ? t("site.edit_entry") : t("site.create_new_entry")}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-5 px-6 py-5">
                  <div className="space-y-2">
                    <Label htmlFor="title">{t("site.proposal_title")}</Label>
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
                      <Label htmlFor="proposalType">{t("site.entry_type")}</Label>
                      <Select
                        value={formData.proposalType}
                        onValueChange={(value) => {
                          setProposalFormError("");
                          setFormData((prev) => ({
                            ...prev,
                            proposalType: value,
                            templateId: value === "tor" ? prev.templateId : "",
                            templateData: value === "tor" ? prev.templateData : {},
                            torCode: value === "tor" ? prev.torCode : "",
                            torSubmissionRef: value === "tor" ? prev.torSubmissionRef : "",
                          }));
                        }}
                      >
                        <SelectTrigger className="rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="grant">{t("site.grant_proposal")}</SelectItem>
                          <SelectItem value="tor">{t("site.tor_submission")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {formData.proposalType === "tor" && (
                      <div className="space-y-2">
                        <Label htmlFor="templateId">{t("site.template")}</Label>
                        <Select
                          value={formData.templateId}
                          onValueChange={(value) => {
                            setProposalFormError("");
                            setFormData((prev) => ({
                              ...prev,
                              templateId: value,
                              templateData: {},
                            }));
                          }}
                        >
                          <SelectTrigger className="rounded-xl">
                            <SelectValue placeholder={t("site.select_template")} />
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
                        <Label htmlFor="torCode">{t("site.tor_code")}</Label>
                        <Input
                          id="torCode"
                          value={formData.torCode}
                          onChange={(e) => setFormData({ ...formData, torCode: e.target.value })}
                          placeholder={t("site.tor_code_example")}
                          className="rounded-xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="torSubmissionRef">{t("site.submission_reference")}</Label>
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
                    <div className="space-y-3 rounded-[1.5rem] border border-border/70 bg-[linear-gradient(180deg,rgba(254,255,254,0.96),rgba(242,247,240,0.76))] p-5 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-foreground">{t("site.template_sections")}</p>
                        <p className="text-xs text-muted-foreground">{t("site.write_your_tor_in_one_flow")}</p>
                      </div>
                      <TorDocumentEditor
                        sections={selectedTemplateSections}
                        values={formData.templateData}
                        onChange={(nextValue) => {
                          setProposalFormError("");
                          setFormData((prev) => ({
                            ...prev,
                            templateData: nextValue,
                          }));
                        }}
                      />
                    </div>
                  ) : null}

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="donorId">{t("site.donor")}</Label>
                      <Select
                        value={formData.donorId}
                        onValueChange={(value) => setFormData({ ...formData, donorId: value })}
                      >
                        <SelectTrigger className="rounded-xl">
                          <SelectValue placeholder={t("site.select_donor")} />
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
                      <Label htmlFor="projectId">{t("site.related_project")}</Label>
                      <Select
                        value={formData.projectId}
                        onValueChange={(value) => setFormData({ ...formData, projectId: value })}
                      >
                        <SelectTrigger className="rounded-xl">
                          <SelectValue placeholder={t("site.select_project")} />
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
                      <Label htmlFor="status">{t("site.status")}</Label>
                      <Select
                        value={formData.status}
                        onValueChange={(value) => setFormData({ ...formData, status: value })}
                      >
                        <SelectTrigger className="rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">{t("site.draft")}</SelectItem>
                          <SelectItem value="submitted">{t("site.submitted")}</SelectItem>
                          <SelectItem value="under_review">{t("site.under_review")}</SelectItem>
                          <SelectItem value="approved">{t("site.approved")}</SelectItem>
                          <SelectItem value="rejected">{t("site.rejected")}</SelectItem>
                          <SelectItem value="withdrawn">{t("site.withdrawn")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="amountRequested">{t("site.amount_requested")}</Label>
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
                      <Label htmlFor="amountApproved">{t("site.amount_approved")}</Label>
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
                      <Label htmlFor="submissionDate">{t("site.submission_date")}</Label>
                      <Input
                        id="submissionDate"
                        type="date"
                        value={formData.submissionDate}
                        onChange={(e) => setFormData({ ...formData, submissionDate: e.target.value })}
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="decisionDate">{t("site.decision_date")}</Label>
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
                      <Label htmlFor="startDate">{t("site.project_start_date")}</Label>
                      <Input
                        id="startDate"
                        type="date"
                        value={formData.startDate}
                        onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="endDate">{t("site.project_end_date")}</Label>
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
                    <Label htmlFor="description">{t("site.description")}</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                      className="rounded-xl"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes">{t("site.notes")}</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={2}
                      className="rounded-xl"
                    />
                  </div>

                  {proposalFormError ? (
                    <p className="text-sm text-destructive">{proposalFormError}</p>
                  ) : null}

                  <div className="flex gap-2 justify-end">
                    <Button type="button" variant="ghost" onClick={() => { setIsAddDialogOpen(false); resetForm(); }}>
                      {t("site.cancel")}
                    </Button>
                    <Button type="submit" className="rounded-xl">
                      {editingProposal ? t("site.update") : t("site.create")} {t("site.entry")}
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
          <span className="text-xs text-muted-foreground">{summaryLabelPrefix}{t("site.total")}</span>
          <p className="font-serif text-lg text-foreground">{pipelineStats.total}</p>
        </div>
        <div className="px-4 py-2.5 bg-sage-pale rounded-xl">
          <span className="text-xs text-muted-foreground">{summaryLabelPrefix}{t("site.pipeline_value")}</span>
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
          <span className="text-xs text-muted-foreground">{summaryLabelPrefix}{t("site.approved")}</span>
          <p className="font-serif text-lg text-primary">{pipelineStats.approved}</p>
        </div>
        <div className="px-4 py-2.5 bg-lavender-pale rounded-xl">
          <span className="text-xs text-muted-foreground">{summaryLabelPrefix}{t("site.approved_value")}</span>
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
            placeholder={t("site.search_proposals")}
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
            <SelectItem value="all">{t("site.all_status")}</SelectItem>
            <SelectItem value="draft">{t("site.draft")}</SelectItem>
            <SelectItem value="submitted">{t("site.submitted")}</SelectItem>
            <SelectItem value="under_review">{t("site.under_review")}</SelectItem>
            <SelectItem value="approved">{t("site.approved")}</SelectItem>
            <SelectItem value="rejected">{t("site.rejected")}</SelectItem>
            <SelectItem value="withdrawn">{t("site.withdrawn")}</SelectItem>
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
            <SelectItem value="all">{t("site.all_types")}</SelectItem>
            <SelectItem value="grant">{t("site.grant")}</SelectItem>
            <SelectItem value="tor">{t("site.tor")}</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex rounded-xl border border-border overflow-hidden">
          <button
            onClick={() => setViewMode("list")}
            className={`px-3.5 py-2 text-xs font-medium transition-colors ${
              viewMode === "list" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            {t("site.list")}
          </button>
          <button
            onClick={() => setViewMode("pipeline")}
            className={`px-3.5 py-2 text-xs font-medium transition-colors ${
              viewMode === "pipeline" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            {t("site.pipeline")}
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
                  ? t("site.no_entries_match_your_filters")
                  : t("site.no_proposals_yet_create_your_first_entry")}
              </p>
              {!searchQuery && filterStatus === "all" && filterType === "all" && (
                <Button onClick={() => setIsAddDialogOpen(true)} className="rounded-xl">
                  <Plus className="h-4 w-4 mr-2" /> {t("site.create_your_first_entry")}
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
                      <Link
                        href={`/proposals/${proposal.id}`}
                        className="flex min-w-0 flex-1 items-start gap-4 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        <div className={`p-2.5 rounded-xl shrink-0 ${type.bg}`}>
                          <TrendingUp className={`h-5 w-5 ${type.text}`} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1.5">
                            <h3 className="font-serif text-lg text-foreground leading-snug">
                              {proposal.title}
                            </h3>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${type.bg} ${type.text}`}>
                              {t(type.label)}
                            </span>
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ${status.bg} ${status.text}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                              {t(status.label)}
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
                      </Link>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground shrink-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/proposals/${proposal.id}`}>
                              <FileText className="h-4 w-4 mr-2" /> {t("site.view_details")}
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEditDialog(proposal)}>
                            <Edit className="h-4 w-4 mr-2" /> {t("site.edit")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openDocumentsDialog(proposal)}>
                            <FileText className="h-4 w-4 mr-2" /> {t("site.documents")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(proposal.id, "submitted")}>
                            {t("site.mark_as_submitted")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(proposal.id, "under_review")}>
                            {t("site.mark_as_under_review")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(proposal.id, "approved")}>
                            {t("site.mark_as_approved")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(proposal.id, "rejected")}>
                            {t("site.mark_as_rejected")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDelete(proposal.id)} className="text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" /> {t("site.delete")}
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
              {t("site.page_of", {
                page: pagination.page,
                total: Math.max(1, Math.ceil((pagination.total || 1) / pagination.limit)),
              })}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl"
                disabled={pagination.page <= 1}
                onClick={() => setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
              >
                {t("site.previous")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl"
                disabled={pagination.page >= Math.ceil((pagination.total || 1) / pagination.limit)}
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
              >
                {t("site.next")}
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
                    <h2 className="font-medium text-sm text-foreground">{t(sc.label)}</h2>
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
                        onClick={() => router.push(`/proposals/${proposal.id}`)}
                        aria-label={`View proposal: ${proposal.title}`}
                      >
                        <h3 className="text-sm font-medium text-foreground line-clamp-2 leading-snug mb-2">
                          {proposal.title}
                        </h3>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${type.bg} ${type.text}`}>
                            {t(type.label)}
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
                      <p className="text-xs text-muted-foreground">{t("site.no_entries")}</p>
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
              {t("site.documents")} {documentsDialogProposal ? `- ${documentsDialogProposal.title}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("site.attachments")}</p>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <Button size="sm" variant="outline" className="rounded-xl h-7 text-xs" asChild>
                  <span>
                    <Upload className="h-3 w-3 mr-1.5" /> {t("site.upload")}
                  </span>
                </Button>
                <input type="file" className="hidden" onChange={handleDocumentUpload} />
              </label>
            </div>

            <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
              <div className="space-y-3">
                <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                  <div className="space-y-2">
                  <Label htmlFor="proposal-document-location">{t("site.location_label")}</Label>
                  <Input
                    id="proposal-document-location"
                    value={uploadLocation.label}
                    onChange={(event) => setUploadLocation((current) => ({ ...current, label: event.target.value }))}
                    placeholder={t("site.location_label_placeholder")}
                    className="rounded-xl"
                  />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-xl sm:self-end"
                    onClick={captureUploadLocation}
                    disabled={capturingUploadLocation}
                  >
                    <LocateFixed className="h-3 w-3 mr-1.5" />
                    {capturingUploadLocation ? t("site.capturing_location") : t("site.use_current_location")}
                  </Button>
                </div>
                {uploadLocationError ? (
                  <p className="text-xs text-destructive">{uploadLocationError}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {getDocumentLocationDisplayName({
                      label: uploadLocation.label.trim() || null,
                      latitude: uploadLocation.latitude,
                      longitude: uploadLocation.longitude,
                    }) ?? t("site.location_auto_fill_hint")}
                  </p>
                )}
              </div>
            </div>

            {documents.length === 0 ? (
              <div className="py-8 text-center">
                <FileText className="h-6 w-6 mx-auto mb-1.5 text-primary/15" />
                <p className="text-xs text-muted-foreground">{t("site.no_documents_uploaded_for_this_entry")}</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {documents.map((doc) => {
                  const location = getDocumentLocation(doc);
                  const locationName = getDocumentLocationDisplayName(location);
                  const mapUrl = location ? buildDocumentLocationMapUrl(location) : null;

                  return (
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
                      {locationName && (
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {locationName}
                          </span>
                          {mapUrl ? (
                            <a
                              href={mapUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              {t("site.view_map")}
                            </a>
                          ) : null}
                        </div>
                      )}
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
                );})}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
