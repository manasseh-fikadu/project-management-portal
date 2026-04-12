"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PortalInviteFeedbackDialog } from "@/components/portal-invite-feedback-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft,
  Plus,
  Calendar,
  User,
  DollarSign,
  MoreVertical,
  Trash2,
  Upload,
  FileText,
  CheckCircle,
  Clock,
  XCircle,
  Loader2,
  ListTodo,
  AlertCircle,
  HandCoins,
  Send,
  Leaf,
  LocateFixed,
  MapPin,
} from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import {
  buildDocumentLocationMapUrl,
  DOCUMENT_LOCATION_TIMEOUT_MS,
  getDocumentLocationDisplayName,
  getGeolocationErrorMessage,
  parseDocumentMetadata,
  resolveLocationLabelFromCoordinates,
  type DocumentMetadata,
} from "@/lib/document-location";

type Milestone = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  dueDate: string | null;
  completedAt: string | null;
  order: number;
};

type Document = {
  id: string;
  name: string;
  type: string;
  url: string;
  size: number;
  metadata?: DocumentMetadata | null;
  createdAt: string;
  uploader: {
    firstName: string;
    lastName: string;
  };
};

type UploadingFile = {
  name: string;
  progress: number;
};

type UserOption = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role?: string;
};

type TaskUser = {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
};

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  progress: number;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  assignee: TaskUser | null;
  creator: { id: string; firstName: string; lastName: string };
};

type Donor = {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
};

type ProjectDonorLink = {
  id: string;
  projectId: string;
  donorId: string;
  status: string;
  notes: string | null;
  createdAt: string;
  donor: {
    id: string;
    name: string;
    type: string;
    email: string | null;
    contactPerson: string | null;
    isActive: boolean;
  };
};

type BudgetImportNotes = {
  template?: string;
  sourceSheet?: string;
  sourceRow?: number;
  rowCode?: string | null;
  categoryCode?: string | null;
  categoryName?: string | null;
  parentActivityCode?: string | null;
  parentActivityName?: string | null;
  description?: string | null;
  unitCost?: number | null;
  unitCount?: number | null;
  quarters?: {
    q1?: number | null;
    q2?: number | null;
    q3?: number | null;
    q4?: number | null;
  };
  rawTotalCost?: number | null;
};

type BudgetAllocation = {
  id: string;
  activityName: string;
  plannedAmount: number;
  q1Amount: number;
  q2Amount: number;
  q3Amount: number;
  q4Amount: number;
  notes: string | null;
};

type ReportingProfile = {
  id: string;
  primaryTemplate: string;
  country: string | null;
  currency: string;
  reportingStartDate: string | null;
  reportingEndDate: string | null;
  annualYear: number | null;
  fundingFacility1Label: string | null;
  fundingFacility2Label: string | null;
  otherFundingLabel: string | null;
  leadAgency: string | null;
  implementingPartner: string | null;
  procurementNotes: string | null;
};

type UploadLocationState = {
  label: string;
  latitude: number | null;
  longitude: number | null;
  accuracyMeters: number | null;
  capturedAt: string | null;
};

type Project = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  donorId: string | null;
  donor: Donor | null;
  projectDonors: ProjectDonorLink[];
  totalBudget: number;
  spentBudget: number;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  manager: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  milestones: Milestone[];
  tasks: Task[];
  documents: Document[];
  budgetAllocations: BudgetAllocation[];
  reportingProfile: ReportingProfile | null;
  members: Array<{
    role: string;
    user: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    };
  }>;
};

function isValidExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function parseBudgetImportNotes(notes: string | null): BudgetImportNotes | null {
  if (!notes) return null;
  try {
    const parsed = JSON.parse(notes);
    return parsed && typeof parsed === "object" ? parsed as BudgetImportNotes : null;
  } catch {
    return null;
  }
}

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

function getDocumentLocation(document: Document) {
  return parseDocumentMetadata(document.metadata)?.location ?? null;
}

function getPortalInviteErrorMessageKey(code: unknown, error: unknown): string | null {
  const errorIdentifier =
    typeof code === "string" && code.trim().length > 0
      ? code.trim().toLowerCase()
      : typeof error === "string" && error.trim().length > 0
        ? error.trim().toLowerCase()
        : "";

  const errorKeyMap: Record<string, string> = {
    unauthorized: "site.portal_invite_unauthorized",
    "forbidden: insufficient role permissions": "site.portal_invite_forbidden",
    "donorid is required and must be a valid uuid": "site.portal_invite_invalid_donor",
    "donor not found": "site.portal_invite_donor_not_found",
    "donor does not have an email address": "site.portal_invite_missing_email",
  };

  return errorKeyMap[errorIdentifier] ?? null;
}

const statusConfig: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  planning: { bg: "bg-amber-pale", text: "text-amber-warm", dot: "bg-amber-warm", label: "site.planning" },
  active: { bg: "bg-sage-pale", text: "text-primary", dot: "bg-primary", label: "site.active" },
  on_hold: { bg: "bg-rose-pale", text: "text-rose-muted", dot: "bg-rose-muted", label: "site.on_hold" },
  completed: { bg: "bg-lavender-pale", text: "text-lavender", dot: "bg-lavender", label: "site.completed" },
  cancelled: { bg: "bg-destructive/10", text: "text-destructive", dot: "bg-destructive", label: "site.cancelled" },
};

const milestoneStatusConfig: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  pending: { bg: "bg-muted", text: "text-muted-foreground", icon: <Clock className="h-4 w-4" /> },
  in_progress: { bg: "bg-lavender-pale", text: "text-lavender", icon: <Clock className="h-4 w-4" /> },
  completed: { bg: "bg-sage-pale", text: "text-primary", icon: <CheckCircle className="h-4 w-4" /> },
  cancelled: { bg: "bg-destructive/10", text: "text-destructive", icon: <XCircle className="h-4 w-4" /> },
};

const taskStatusConfig: Record<string, { bg: string; text: string }> = {
  pending: { bg: "bg-muted", text: "text-muted-foreground" },
  in_progress: { bg: "bg-lavender-pale", text: "text-lavender" },
  completed: { bg: "bg-sage-pale", text: "text-primary" },
};

const taskPriorityConfig: Record<string, { bg: string; text: string }> = {
  low: { bg: "bg-muted", text: "text-muted-foreground" },
  medium: { bg: "bg-amber-pale", text: "text-amber-warm" },
  high: { bg: "bg-rose-pale", text: "text-rose-muted" },
};

const donorStatusConfig: Record<string, { bg: string; text: string }> = {
  active: { bg: "bg-sage-pale", text: "text-primary" },
  pending: { bg: "bg-amber-pale", text: "text-amber-warm" },
  completed: { bg: "bg-lavender-pale", text: "text-lavender" },
  withdrawn: { bg: "bg-rose-pale", text: "text-rose-muted" },
};

const milestoneStatusLabels: Record<string, string> = {
  pending: "site.pending",
  in_progress: "site.in_progress",
  completed: "site.completed",
  cancelled: "site.cancelled",
};

const taskStatusLabels: Record<string, string> = {
  pending: "site.pending",
  in_progress: "site.in_progress",
  completed: "site.completed",
};

const taskPriorityLabels: Record<string, string> = {
  low: "site.low",
  medium: "site.medium",
  high: "site.high",
};

const donorStatusLabels: Record<string, string> = {
  active: "site.active",
  pending: "site.pending",
  completed: "site.completed",
  withdrawn: "site.withdrawn",
};

export default function ProjectProfilePage() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initialVisibleBudgetLines = 12;

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [isAddMilestoneOpen, setIsAddMilestoneOpen] = useState(false);
  const [newMilestone, setNewMilestone] = useState({ title: "", description: "", dueDate: "" });
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [uploadLocation, setUploadLocation] = useState<UploadLocationState>(createEmptyUploadLocation());
  const [capturingUploadLocation, setCapturingUploadLocation] = useState(false);
  const [uploadLocationError, setUploadLocationError] = useState("");
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    priority: "medium",
    dueDate: "",
    assignedTo: "",
  });
  const [allDonors, setAllDonors] = useState<Donor[]>([]);
  const [isAddDonorOpen, setIsAddDonorOpen] = useState(false);
  const [addingDonorId, setAddingDonorId] = useState("");
  const [showAllBudgetLines, setShowAllBudgetLines] = useState(false);
  const [isReportingSettingsOpen, setIsReportingSettingsOpen] = useState(false);
  const [savingReportingSettings, setSavingReportingSettings] = useState(false);
  const [reportingSettingsError, setReportingSettingsError] = useState("");
  const [reportingForm, setReportingForm] = useState({
    primaryTemplate: "eif_cpd_annex",
    country: "",
    currency: "ETB",
    reportingStartDate: "",
    reportingEndDate: "",
    annualYear: "",
    fundingFacility1Label: "",
    fundingFacility2Label: "",
    otherFundingLabel: "",
    leadAgency: "",
    implementingPartner: "",
    procurementNotes: "",
  });
  const [sendingInvites, setSendingInvites] = useState<Set<string>>(new Set());
  const [portalInviteFeedback, setPortalInviteFeedback] = useState<{
    open: boolean;
    title: string;
    message: string;
    variant: "success" | "error";
  }>({
    open: false,
    title: "",
    message: "",
    variant: "success",
  });

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      if (data.users) setUsers(data.users);
    } catch (err) {
      console.error(t("site.error_fetching_users"), err);
    }
  }, [t]);

  const fetchDonors = useCallback(async () => {
    try {
      const res = await fetch("/api/donors");
      const data = await res.json();
      if (data.donors) setAllDonors(data.donors);
    } catch (err) {
      console.error(t("site.error_fetching_donors"), err);
    }
  }, [t]);

  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      const data = await res.json();
      if (data.project) {
        setProject(data.project);
        const profile = data.project.reportingProfile;
        setReportingForm({
          primaryTemplate: profile?.primaryTemplate ?? "eif_cpd_annex",
          country: profile?.country ?? "",
          currency: profile?.currency ?? "ETB",
          reportingStartDate: (profile?.reportingStartDate ?? data.project.startDate ?? "")?.slice(0, 10) ?? "",
          reportingEndDate: (profile?.reportingEndDate ?? data.project.endDate ?? "")?.slice(0, 10) ?? "",
          annualYear: profile?.annualYear ? String(profile.annualYear) : ((data.project.startDate ?? "").slice(0, 4) || ""),
          fundingFacility1Label: profile?.fundingFacility1Label ?? "",
          fundingFacility2Label: profile?.fundingFacility2Label ?? "",
          otherFundingLabel: profile?.otherFundingLabel ?? "",
          leadAgency: profile?.leadAgency ?? "",
          implementingPartner: profile?.implementingPartner ?? "",
          procurementNotes: profile?.procurementNotes ?? "",
        });
      } else {
        router.push("/projects");
      }
    } catch {
      router.push("/projects");
    } finally {
      setLoading(false);
    }
  }, [projectId, router]);

  useEffect(() => {
    setShowAllBudgetLines(false);
  }, [projectId]);

  useEffect(() => {
    fetchProject();
    fetchUsers();
    fetchDonors();
  }, [fetchProject, fetchUsers, fetchDonors]);

  function formatDate(date: string | null) {
    if (!date) return t("site.not_set");
    const dateObj = new Date(date);
    if (Number.isNaN(dateObj.getTime())) return t("site.not_set");
    return dateObj.toLocaleDateString(i18n.language, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function formatBudget(amount: number) {
    return formatCurrency(amount, "ETB");
  }

  function formatFileSize(bytes: number) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  function getEnumLabel(translationKey: string | undefined, rawValue: string) {
    return translationKey ? t(translationKey) : rawValue.replace(/_/g, " ");
  }

  function getRoleLabel(role: string) {
    if (role === "user") {
      return t("roles.team_member");
    }

    if (role === "admin" || role === "project_manager" || role === "team_member" || role === "donor") {
      return t(`roles.${role}`);
    }

    return role.replace(/_/g, " ");
  }

  function getProgress() {
    if (!project || project.milestones.length === 0) return 0;
    const completed = project.milestones.filter((m) => m.status === "completed").length;
    return Math.round((completed / project.milestones.length) * 100);
  }

  function openReportGenerator(template: "agra-budget-breakdown" | "eif-cpd-annex" | "ppg-boost") {
    router.push(`/reports?projectId=${projectId}&template=${template}`);
  }

  async function handleSaveReportingSettings() {
    try {
      setSavingReportingSettings(true);
      setReportingSettingsError("");
      const payload = {
        primaryTemplate: reportingForm.primaryTemplate,
        country: reportingForm.country || null,
        currency: reportingForm.currency,
        reportingStartDate: reportingForm.reportingStartDate || null,
        reportingEndDate: reportingForm.reportingEndDate || null,
        annualYear: reportingForm.annualYear ? Number(reportingForm.annualYear) : null,
        fundingFacility1Label: reportingForm.fundingFacility1Label || null,
        fundingFacility2Label: reportingForm.fundingFacility2Label || null,
        otherFundingLabel: reportingForm.otherFundingLabel || null,
        leadAgency: reportingForm.leadAgency || null,
        implementingPartner: reportingForm.implementingPartner || null,
        procurementNotes: reportingForm.procurementNotes || null,
      };
      const res = await fetch(`/api/projects/${projectId}/reporting-profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        throw new Error("Failed to save reporting settings");
      }
      await fetchProject();
      setIsReportingSettingsOpen(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t("site.failed_to_save_reporting_settings");
      setReportingSettingsError(`${t("site.failed_to_save_reporting_settings")}: ${errorMessage}`);
      console.error("Failed to save reporting settings:", error);
    } finally {
      setSavingReportingSettings(false);
    }
  }

  async function handleManagerChange(newManagerId: string) {
    if (!project || newManagerId === project.manager.id) return;
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ managerId: newManagerId }),
      });
      if (res.ok) {
        await fetchProject();
      }
    } catch (error) {
      console.error(t("site.failed_to_update_manager"), error);
    }
  }

  async function handleStatusChange(newStatus: string) {
    if (!project) return;
    try {
      await fetch(`/api/projects/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      setProject({ ...project, status: newStatus });
    } finally {
    }
  }

  async function handleMilestoneStatusChange(milestoneId: string, newStatus: string) {
    if (!project) return;
    try {
      await fetch(`/api/milestones/${milestoneId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      setProject({
        ...project,
        milestones: project.milestones.map((m) =>
          m.id === milestoneId ? { ...m, status: newStatus } : m
        ),
      });
    } catch (error) {
      console.error(t("site.failed_to_update_milestone"), error);
    }
  }

  async function handleAddMilestone(e: React.FormEvent) {
    e.preventDefault();
    if (!project) return;

    try {
      const res = await fetch(`/api/projects/${projectId}/milestones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newMilestone),
      });
      const data = await res.json();
      if (data.milestone) {
        setProject({
          ...project,
          milestones: [...project.milestones, data.milestone],
        });
        setNewMilestone({ title: "", description: "", dueDate: "" });
        setIsAddMilestoneOpen(false);
      }
    } catch (error) {
      console.error(t("site.failed_to_add_milestone"), error);
    }
  }

  async function handleDeleteMilestone(milestoneId: string) {
    if (!project || !confirm(t("site.are_you_sure_you_want_to_delete_this_milestone"))) return;

    try {
      await fetch(`/api/milestones/${milestoneId}`, { method: "DELETE" });
      setProject({
        ...project,
        milestones: project.milestones.filter((m) => m.id !== milestoneId),
      });
    } catch (error) {
      console.error(t("site.failed_to_delete_milestone"), error);
    }
  }

  async function handleAddTask(e: React.FormEvent) {
    e.preventDefault();
    if (!project) return;

    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          title: newTask.title,
          description: newTask.description || null,
          priority: newTask.priority,
          dueDate: newTask.dueDate || null,
          assignedTo: newTask.assignedTo || null,
        }),
      });
      const data = await res.json();
      if (data.task) {
        setProject({
          ...project,
          tasks: [data.task, ...project.tasks],
        });
        setNewTask({ title: "", description: "", priority: "medium", dueDate: "", assignedTo: "" });
        setIsAddTaskOpen(false);
      }
    } catch (error) {
      console.error(t("site.failed_to_add_task"), error);
    }
  }

  async function handleTaskStatusChange(taskId: string, newStatus: string) {
    if (!project) return;
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      setProject({
        ...project,
        tasks: project.tasks.map((t) =>
          t.id === taskId ? { ...t, status: newStatus } : t
        ),
      });
    } catch (error) {
      console.error(t("site.failed_to_update_task"), error);
    }
  }

  async function handleDeleteTask(taskId: string) {
    if (!project || !confirm(t("site.are_you_sure_you_want_to_delete_this_task"))) return;
    try {
      await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
      setProject({
        ...project,
        tasks: project.tasks.filter((t) => t.id !== taskId),
      });
    } catch (error) {
      console.error(t("site.failed_to_delete_task"), error);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0 || !project) return;
    const locationPayload = buildUploadLocationPayload(uploadLocation);

    const newUploads: UploadingFile[] = files.map((f) => ({ name: f.name, progress: 0 }));
    setUploadingFiles((prev) => [...prev, ...newUploads]);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const formData = new FormData();
      formData.append("file", file);
      if (locationPayload) {
        formData.append("locationMetadata", locationPayload);
      }

      setUploadingFiles((prev) =>
        prev.map((u, idx) => (u.name === file.name && idx === prev.findIndex((p) => p.name === file.name) ? { ...u, progress: 50 } : u))
      );

      try {
        const res = await fetch(`/api/projects/${projectId}/documents`, {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (data.document) {
          setProject((prev) =>
            prev ? { ...prev, documents: [...prev.documents, data.document] } : prev
          );
        }
      } catch (error) {
        console.error(t("site.failed_to_upload_document"), error);
      }

      setUploadingFiles((prev) =>
        prev.map((u) => (u.name === file.name ? { ...u, progress: 100 } : u))
      );
    }

    setTimeout(() => {
      setUploadingFiles((prev) => prev.filter((u) => !files.some((f) => f.name === u.name)));
    }, 500);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
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
    if (!project || !confirm(t("site.are_you_sure_you_want_to_delete_this_document"))) return;

    try {
      await fetch(`/api/documents/${documentId}`, { method: "DELETE" });
      setProject({
        ...project,
        documents: project.documents.filter((d) => d.id !== documentId),
      });
    } catch (error) {
      console.error(t("site.failed_to_delete_document"), error);
    }
  }

  async function handleDeleteProject() {
    if (!confirm(t("site.are_you_sure_you_want_to_delete_this_project_this_action_cannot_be_undone"))) return;

    try {
      await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
      router.push("/projects");
    } catch (error) {
      console.error(t("site.failed_to_delete_project"), error);
    }
  }

  async function handleAddDonor() {
    if (!project || !addingDonorId) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/donors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ donorId: addingDonorId }),
      });
      const data = await res.json();
      if (data.projectDonor) {
        setProject({
          ...project,
          projectDonors: [...project.projectDonors, data.projectDonor],
        });
        setAddingDonorId("");
        setIsAddDonorOpen(false);
      }
    } catch (error) {
      console.error(t("site.failed_to_add_donor"), error);
    }
  }

  async function handleDonorStatusChange(donorId: string, newStatus: string) {
    if (!project) return;
    try {
      await fetch(`/api/projects/${projectId}/donors`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ donorId, status: newStatus }),
      });
      setProject({
        ...project,
        projectDonors: project.projectDonors.map((pd) =>
          pd.donorId === donorId ? { ...pd, status: newStatus } : pd
        ),
      });
    } catch (error) {
      console.error(t("site.failed_to_update_donor_status"), error);
    }
  }

  async function handleRemoveDonor(donorId: string) {
    if (!project || !confirm(t("site.remove_this_donor_from_the_project"))) return;
    try {
      await fetch(`/api/projects/${projectId}/donors?donorId=${donorId}`, {
        method: "DELETE",
      });
      setProject({
        ...project,
        projectDonors: project.projectDonors.filter((pd) => pd.donorId !== donorId),
      });
    } catch (error) {
      console.error(t("site.failed_to_remove_donor"), error);
    }
  }

  async function handleSendPortalInvite(donorId: string) {
    setSendingInvites((prev) => new Set(prev).add(donorId));
    try {
      const res = await fetch("/api/donor-portal/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ donorId }),
      });
      const data: { code?: unknown; error?: unknown } = await res.json();
      if (res.ok) {
        setPortalInviteFeedback({
          open: true,
          title: t("site.invite_sent"),
          message: t("site.donor_portal_invite_sent_message"),
          variant: "success",
        });
      } else {
        const messageKey = getPortalInviteErrorMessageKey(data.code, data.error);
        setPortalInviteFeedback({
          open: true,
          title: t("site.invite_failed"),
          message: messageKey ? t(messageKey) : t("site.failed_to_send_invite"),
          variant: "error",
        });
      }
    } catch (error) {
      console.error(t("site.failed_to_send_portal_invite"), error);
      setPortalInviteFeedback({
        open: true,
        title: t("site.invite_failed"),
        message: t("site.failed_to_send_portal_invite"),
        variant: "error",
      });
    } finally {
      setSendingInvites((prev) => {
        const next = new Set(prev);
        next.delete(donorId);
        return next;
      });
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Leaf className="h-6 w-6 animate-pulse text-primary" />
          <p className="text-sm text-muted-foreground">{t("site.loading_project")}</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return null;
  }

  const status = statusConfig[project.status] || statusConfig.planning;
  const progress = getProgress();
  const budgetLines = project.budgetAllocations ?? [];
  const visibleBudgetLines = showAllBudgetLines ? budgetLines : budgetLines.slice(0, initialVisibleBudgetLines);
  const hiddenBudgetLineCount = Math.max(budgetLines.length - visibleBudgetLines.length, 0);
  const importedBudgetLines = budgetLines
    .map((line) => ({ line, metadata: parseBudgetImportNotes(line.notes) }))
    .filter((entry) => Boolean(entry.metadata?.template));
  const importedTotal = importedBudgetLines.reduce((sum, entry) => sum + entry.line.plannedAmount, 0);

  return (
    <div className="p-6 lg:p-10">
      <PortalInviteFeedbackDialog
        open={portalInviteFeedback.open}
        title={portalInviteFeedback.title}
        message={portalInviteFeedback.message}
        variant={portalInviteFeedback.variant}
        onOpenChange={(open) => setPortalInviteFeedback((prev) => ({ ...prev, open }))}
      />
      {/* Top bar */}
      <div className="mb-8 flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => router.push("/projects")}
          className="text-muted-foreground hover:text-foreground -ml-3"
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> {t("site.back_to_projects")}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground"
              aria-label={t("site.more_project_options")}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleStatusChange("active")}>
              {t("site.set_active")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleStatusChange("on_hold")}>
              {t("site.set_on_hold")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleStatusChange("completed")}>
              {t("site.set_completed")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleStatusChange("cancelled")}>
              {t("site.set_cancelled")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDeleteProject} className="text-destructive">
              <Trash2 className="h-4 w-4 mr-2" /> {t("site.delete_project")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-8">
          {/* Project header */}
          <div className="bg-card rounded-2xl p-6 lg:p-8">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div className="min-w-0">
                <h1 className="font-serif text-2xl lg:text-3xl text-foreground mb-2">{project.name}</h1>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {project.description || t("site.no_description_provided")}
                </p>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 ${status.bg} ${status.text}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                  {t(status.label)}
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 mb-6">
              <div>
                <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5">
                  <User className="h-3 w-3" /> {t("site.project_manager")}
                </p>
                <Select
                  value={project.manager.id}
                  onValueChange={handleManagerChange}
                >
                  <SelectTrigger className="h-9 text-sm rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.firstName} {user.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">{t("site.donors")}</p>
                {project.projectDonors && project.projectDonors.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {project.projectDonors.map((pd) => {
                      const ds = donorStatusConfig[pd.status] || donorStatusConfig.pending;
                      return (
                        <span key={pd.donorId} className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium ${ds.bg} ${ds.text}`}>
                          {pd.donor.name}
                        </span>
                      );
                    })}
                  </div>
                ) : project.donor ? (
                  <p className="text-sm text-foreground">{project.donor.name}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">{t("site.none_assigned")}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5">
                  <DollarSign className="h-3 w-3" /> {t("site.budget")}
                </p>
                <p className="text-sm font-medium text-foreground">
                  {formatBudget(project.totalBudget)}
                  {project.spentBudget > 0 && (
                    <span className="text-muted-foreground font-normal ml-1.5">
                      {t("site.spent_parenthetical", { amount: formatBudget(project.spentBudget) })}
                    </span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5">
                  <Calendar className="h-3 w-3" /> {t("site.timeline")}
                </p>
                <p className="text-sm text-foreground">
                  {formatDate(project.startDate)} - {formatDate(project.endDate)}
                </p>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-2">
                <span className="text-muted-foreground">{t("site.overall_progress")}</span>
                <span className="font-medium text-foreground">{progress}%</span>
              </div>
              <div className="h-2 rounded-full bg-sage-pale overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-700"
                  style={{ width: `${progress}%`, transitionTimingFunction: "cubic-bezier(0.25, 1, 0.5, 1)" }}
                />
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-border/60 bg-muted/20 p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <div>
                    <h2 className="font-serif text-lg text-foreground">{t("site.reporting_workspace")}</h2>
                    <p className="text-sm text-muted-foreground">{t("site.reporting_workspace_desc")}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="rounded-full px-3 py-1">
                      {t("site.reporting_country")}: {project.reportingProfile?.country || t("site.not_set")}
                    </Badge>
                    <Badge variant="secondary" className="rounded-full px-3 py-1">
                      {t("site.reporting_currency")}: {project.reportingProfile?.currency || "ETB"}
                    </Badge>
                    <Badge variant="secondary" className="rounded-full px-3 py-1">
                      {t("site.reporting_year")}: {project.reportingProfile?.annualYear || reportingForm.annualYear || t("site.not_set")}
                    </Badge>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" className="rounded-xl" onClick={() => openReportGenerator("agra-budget-breakdown")}>
                    <FileText className="mr-2 h-4 w-4" />
                    {t("reports.agra_budget_breakdown")}
                  </Button>
                  <Button type="button" variant="outline" className="rounded-xl" onClick={() => openReportGenerator("eif-cpd-annex")}>
                    <FileText className="mr-2 h-4 w-4" />
                    {t("reports.eif_annex")}
                  </Button>
                  <Button type="button" variant="outline" className="rounded-xl" onClick={() => openReportGenerator("ppg-boost")}>
                    <FileText className="mr-2 h-4 w-4" />
                    {t("reports.ppg_boost")}
                  </Button>
                  <Dialog
                    open={isReportingSettingsOpen}
                    onOpenChange={(open) => {
                      setIsReportingSettingsOpen(open);
                      if (!open) {
                        setReportingSettingsError("");
                      }
                    }}
                  >
                    <DialogTrigger asChild>
                      <Button type="button" className="rounded-xl">
                        {t("site.reporting_settings")}
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle className="font-serif">{t("site.reporting_settings")}</DialogTitle>
                      </DialogHeader>

                      <div className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>{t("site.reporting_country")}</Label>
                            <Input
                              value={reportingForm.country}
                              onChange={(event) => setReportingForm((current) => ({ ...current, country: event.target.value }))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>{t("site.reporting_currency")}</Label>
                            <Select
                              value={reportingForm.currency}
                              onValueChange={(value) => setReportingForm((current) => ({ ...current, currency: value }))}
                            >
                              <SelectTrigger className="rounded-xl">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ETB">ETB</SelectItem>
                                <SelectItem value="USD">USD</SelectItem>
                                <SelectItem value="EUR">EUR</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>{t("site.start_date")}</Label>
                            <Input
                              type="date"
                              value={reportingForm.reportingStartDate}
                              onChange={(event) => setReportingForm((current) => ({ ...current, reportingStartDate: event.target.value }))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>{t("site.end_date")}</Label>
                            <Input
                              type="date"
                              value={reportingForm.reportingEndDate}
                              onChange={(event) => setReportingForm((current) => ({ ...current, reportingEndDate: event.target.value }))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>{t("site.reporting_year")}</Label>
                            <Input
                              inputMode="numeric"
                              value={reportingForm.annualYear}
                              onChange={(event) => setReportingForm((current) => ({ ...current, annualYear: event.target.value }))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>{t("site.reporting_template")}</Label>
                            <Select
                              value={reportingForm.primaryTemplate}
                              onValueChange={(value) => setReportingForm((current) => ({ ...current, primaryTemplate: value }))}
                            >
                              <SelectTrigger className="rounded-xl">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="agra_budget_breakdown">{t("reports.agra_budget_breakdown")}</SelectItem>
                                <SelectItem value="eif_cpd_annex">{t("reports.eif_annex")}</SelectItem>
                                <SelectItem value="ppg_boost">{t("reports.ppg_boost")}</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>{t("site.reporting_lead_agency")}</Label>
                            <Input
                              value={reportingForm.leadAgency}
                              onChange={(event) => setReportingForm((current) => ({ ...current, leadAgency: event.target.value }))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>{t("site.reporting_funding_facility_1")}</Label>
                            <Input
                              value={reportingForm.fundingFacility1Label}
                              onChange={(event) => setReportingForm((current) => ({ ...current, fundingFacility1Label: event.target.value }))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>{t("site.reporting_funding_facility_2")}</Label>
                            <Input
                              value={reportingForm.fundingFacility2Label}
                              onChange={(event) => setReportingForm((current) => ({ ...current, fundingFacility2Label: event.target.value }))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>{t("site.reporting_other_funding")}</Label>
                            <Input
                              value={reportingForm.otherFundingLabel}
                              onChange={(event) => setReportingForm((current) => ({ ...current, otherFundingLabel: event.target.value }))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>{t("site.reporting_partner")}</Label>
                            <Input
                              value={reportingForm.implementingPartner}
                              onChange={(event) => setReportingForm((current) => ({ ...current, implementingPartner: event.target.value }))}
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>{t("site.reporting_procurement_notes")}</Label>
                          <Textarea
                            value={reportingForm.procurementNotes}
                            onChange={(event) => setReportingForm((current) => ({ ...current, procurementNotes: event.target.value }))}
                          />
                        </div>

                        {reportingSettingsError && (
                          <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                            {reportingSettingsError}
                          </div>
                        )}

                        <div className="flex justify-end gap-2">
                          <Button type="button" variant="ghost" onClick={() => setIsReportingSettingsOpen(false)}>
                            {t("site.cancel")}
                          </Button>
                          <Button type="button" className="rounded-xl" onClick={handleSaveReportingSettings} disabled={savingReportingSettings}>
                            {savingReportingSettings ? t("site.saving_reporting_settings") : t("site.save_reporting_settings")}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </div>
          </div>

          {budgetLines.length > 0 && (
            <div className="bg-card rounded-2xl p-6 lg:p-8">
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between mb-6">
                <div>
                  <h2 className="font-serif text-xl text-foreground">{t("site.budget_structure")}</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t("site.imported_budget_lines_categories_and_quarterly_split_metadata")}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="rounded-full px-3 py-1">
                    {t("site.lines_count", { count: budgetLines.length })}
                  </Badge>
                  {importedBudgetLines.length > 0 && (
                    <Badge variant="secondary" className="rounded-full bg-primary/10 px-3 py-1 text-primary hover:bg-primary/10">
                      {t("site.imported_total_amount", { amount: formatBudget(importedTotal) })}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-5 mb-5">
                <div className="rounded-xl bg-muted/35 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{t("site.q1")}</p>
                  <p className="mt-2 text-sm font-semibold text-foreground">
                    {formatBudget(budgetLines.reduce((sum, line) => sum + (line.q1Amount ?? 0), 0))}
                  </p>
                </div>
                <div className="rounded-xl bg-muted/35 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{t("site.q2")}</p>
                  <p className="mt-2 text-sm font-semibold text-foreground">
                    {formatBudget(budgetLines.reduce((sum, line) => sum + (line.q2Amount ?? 0), 0))}
                  </p>
                </div>
                <div className="rounded-xl bg-muted/35 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{t("site.q3")}</p>
                  <p className="mt-2 text-sm font-semibold text-foreground">
                    {formatBudget(budgetLines.reduce((sum, line) => sum + (line.q3Amount ?? 0), 0))}
                  </p>
                </div>
                <div className="rounded-xl bg-muted/35 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{t("site.q4")}</p>
                  <p className="mt-2 text-sm font-semibold text-foreground">
                    {formatBudget(budgetLines.reduce((sum, line) => sum + (line.q4Amount ?? 0), 0))}
                  </p>
                </div>
                <div className="rounded-xl bg-primary/5 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-primary/70">{t("site.planned")}</p>
                  <p className="mt-2 text-sm font-semibold text-foreground">
                    {formatBudget(budgetLines.reduce((sum, line) => sum + line.plannedAmount, 0))}
                  </p>
                </div>
              </div>

              {budgetLines.length > initialVisibleBudgetLines && (
                <div className="mb-5 flex flex-col gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      {t("site.showing_budget_lines_count_of_total", {
                        shown: visibleBudgetLines.length,
                        total: budgetLines.length,
                      })}
                    </p>
                    {hiddenBudgetLineCount > 0 && !showAllBudgetLines && (
                      <p className="text-xs text-muted-foreground">
                        {t("site.more_budget_lines_hidden_count", { count: hiddenBudgetLineCount })}
                      </p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => setShowAllBudgetLines((current) => !current)}
                  >
                    {showAllBudgetLines
                      ? t("site.show_less_budget_lines")
                      : t("site.show_all_budget_lines")}
                  </Button>
                </div>
              )}

              <div className="space-y-3">
                {visibleBudgetLines.map((line) => {
                  const metadata = parseBudgetImportNotes(line.notes);
                  return (
                    <div key={line.id} className="rounded-xl border border-border/70 px-4 py-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium text-foreground">{line.activityName}</p>
                            {metadata?.rowCode && (
                              <Badge variant="secondary" className="rounded-full text-[11px]">
                                {metadata.rowCode}
                              </Badge>
                            )}
                            {metadata?.categoryName && (
                              <span className="text-xs text-muted-foreground">
                                {metadata.categoryName}
                              </span>
                            )}
                          </div>
                          {metadata?.description && (
                            <p className="mt-2 text-sm leading-6 text-muted-foreground">{metadata.description}</p>
                          )}
                          {(metadata?.unitCost || metadata?.unitCount) && (
                            <p className="mt-2 text-xs text-muted-foreground">
                              {t("site.unit_cost_amount_units_count", {
                                amount: formatBudget(metadata.unitCost ?? 0),
                                count: metadata.unitCount ?? 0,
                              })}
                            </p>
                          )}
                        </div>
                        <div className="shrink-0 rounded-full bg-muted/40 px-3 py-1.5 text-sm font-semibold text-foreground">
                          {formatBudget(line.plannedAmount)}
                        </div>
                      </div>

                      <div className="mt-4 grid gap-2 sm:grid-cols-4">
                        {[
                          { label: "Q1", value: line.q1Amount },
                          { label: "Q2", value: line.q2Amount },
                          { label: "Q3", value: line.q3Amount },
                          { label: "Q4", value: line.q4Amount },
                        ].map((quarter) => (
                          <div key={quarter.label} className="rounded-lg bg-muted/30 px-3 py-2">
                            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{t(`site.${quarter.label.toLowerCase()}`)}</p>
                            <p className="mt-1 text-sm font-medium text-foreground">
                              {formatBudget(quarter.value ?? 0)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Milestones */}
          <div className="bg-card rounded-2xl p-6 lg:p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-serif text-xl text-foreground">{t("site.work_plan_milestones")}</h2>
              <Dialog open={isAddMilestoneOpen} onOpenChange={setIsAddMilestoneOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="rounded-xl">
                    <Plus className="h-4 w-4 mr-1" /> {t("site.add")}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="font-serif">{t("site.add_new_milestone")}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleAddMilestone} className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="milestone-title">{t("site.title")}</Label>
                      <Input
                        id="milestone-title"
                        value={newMilestone.title}
                        onChange={(e) => setNewMilestone({ ...newMilestone, title: e.target.value })}
                        required
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="milestone-description">{t("site.description")}</Label>
                      <Textarea
                        id="milestone-description"
                        value={newMilestone.description}
                        onChange={(e) => setNewMilestone({ ...newMilestone, description: e.target.value })}
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="milestone-due">{t("site.due_date")}</Label>
                      <Input
                        id="milestone-due"
                        type="date"
                        value={newMilestone.dueDate}
                        onChange={(e) => setNewMilestone({ ...newMilestone, dueDate: e.target.value })}
                        className="rounded-xl"
                      />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button type="button" variant="ghost" onClick={() => setIsAddMilestoneOpen(false)}>
                        {t("site.cancel")}
                      </Button>
                      <Button type="submit" className="rounded-xl">{t("site.add_milestone")}</Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {project.milestones.length === 0 ? (
              <div className="py-10 text-center">
                <Leaf className="h-8 w-8 mx-auto mb-2 text-primary/20" />
                <p className="text-sm text-muted-foreground">{t("site.no_milestones_defined_yet")}</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {project.milestones.map((milestone) => {
                  const ms = milestoneStatusConfig[milestone.status] || milestoneStatusConfig.pending;
                  return (
                    <div key={milestone.id} className={`flex items-start gap-3 p-4 rounded-xl transition-colors ${ms.bg}`}>
                      <div className={`mt-0.5 ${ms.text}`}>
                        {ms.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-medium text-sm text-foreground">{milestone.title}</h4>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${ms.bg} ${ms.text}`}>
                            {getEnumLabel(milestoneStatusLabels[milestone.status], milestone.status)}
                          </span>
                        </div>
                        {milestone.description && (
                          <p className="text-sm text-muted-foreground mt-1">{milestone.description}</p>
                        )}
                        {milestone.dueDate && (
                          <p className="text-xs text-muted-foreground mt-1.5">
                            {t("site.due")} {formatDate(milestone.dueDate)}
                          </p>
                        )}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground"
                            aria-label={t("site.more_milestone_options")}
                          >
                            <MoreVertical className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleMilestoneStatusChange(milestone.id, "in_progress")}>
                            {t("site.set_in_progress")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleMilestoneStatusChange(milestone.id, "completed")}>
                            {t("site.set_completed")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleMilestoneStatusChange(milestone.id, "cancelled")}>
                            {t("site.set_cancelled")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDeleteMilestone(milestone.id)} className="text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" /> {t("site.delete")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Tasks */}
          <div className="bg-card rounded-2xl p-6 lg:p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-serif text-xl text-foreground">{t("site.tasks_and_activities")}</h2>
              <Dialog open={isAddTaskOpen} onOpenChange={setIsAddTaskOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="rounded-xl">
                    <Plus className="h-4 w-4 mr-1" /> {t("site.add")}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="font-serif">{t("site.add_new_task")}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleAddTask} className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="task-title">{t("site.title")}</Label>
                      <Input
                        id="task-title"
                        value={newTask.title}
                        onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                        placeholder={t("site.task_title")}
                        required
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="task-description">{t("site.description")}</Label>
                      <Textarea
                        id="task-description"
                        value={newTask.description}
                        onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                        placeholder={t("site.what_needs_to_be_done")}
                        rows={2}
                        className="rounded-xl"
                      />
                    </div>
                    <div className="grid gap-4 grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="task-priority">{t("site.priority")}</Label>
                        <Select
                          value={newTask.priority}
                          onValueChange={(value) => setNewTask({ ...newTask, priority: value })}
                        >
                          <SelectTrigger className="rounded-xl">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">{t("site.low")}</SelectItem>
                            <SelectItem value="medium">{t("site.medium")}</SelectItem>
                            <SelectItem value="high">{t("site.high")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="task-due">{t("site.due_date")}</Label>
                        <Input
                          id="task-due"
                          type="date"
                          value={newTask.dueDate}
                          onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                          className="rounded-xl"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="task-assignee">{t("site.assign_to")}</Label>
                      <Select
                        value={newTask.assignedTo}
                        onValueChange={(value) => setNewTask({ ...newTask, assignedTo: value === "_none" ? "" : value })}
                      >
                        <SelectTrigger className="rounded-xl">
                          <SelectValue placeholder={t("site.select_assignee")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">{t("site.unassigned")}</SelectItem>
                          {users.map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.firstName} {user.lastName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button type="button" variant="ghost" onClick={() => setIsAddTaskOpen(false)}>
                        {t("site.cancel")}
                      </Button>
                      <Button type="submit" className="rounded-xl">{t("site.add_task")}</Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {project.tasks.length === 0 ? (
              <div className="py-10 text-center">
                <ListTodo className="h-8 w-8 mx-auto mb-2 text-primary/20" />
                <p className="text-sm text-muted-foreground">{t("site.no_tasks_created_yet")}</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {project.tasks.map((task) => {
                  const ts = taskStatusConfig[task.status] || taskStatusConfig.pending;
                  const tp = taskPriorityConfig[task.priority] || taskPriorityConfig.medium;
                  return (
                    <div key={task.id} className="flex items-start gap-3 p-4 rounded-xl hover:bg-muted/30 transition-colors">
                      <div className="mt-0.5">
                        {task.status === "completed" ? (
                          <CheckCircle className="h-4 w-4 text-primary" />
                        ) : task.status === "in_progress" ? (
                          <Clock className="h-4 w-4 text-lavender" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className={`font-medium text-sm ${task.status === "completed" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                            {task.title}
                          </h4>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${ts.bg} ${ts.text}`}>
                            {getEnumLabel(taskStatusLabels[task.status], task.status)}
                          </span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${tp.bg} ${tp.text}`}>
                            {getEnumLabel(taskPriorityLabels[task.priority], task.priority)}
                          </span>
                        </div>
                        {task.description && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{task.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          {task.assignee && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {task.assignee.firstName} {task.assignee.lastName}
                            </span>
                          )}
                          {task.dueDate && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDate(task.dueDate)}
                            </span>
                          )}
                          {task.progress > 0 && (
                            <span>{t("site.percent_done", { percent: task.progress })}</span>
                          )}
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground"
                            aria-label={t("site.more_task_options")}
                          >
                            <MoreVertical className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleTaskStatusChange(task.id, "pending")}>
                            {t("site.set_pending")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleTaskStatusChange(task.id, "in_progress")}>
                            {t("site.set_in_progress")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleTaskStatusChange(task.id, "completed")}>
                            {t("site.set_completed")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDeleteTask(task.id)} className="text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" /> {t("site.delete")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar column */}
        <div className="space-y-6">
          {/* Documents */}
          <div className="bg-card rounded-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-serif text-lg text-foreground">{t("site.documents")}</h2>
              <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} className="rounded-xl">
                <Upload className="h-3.5 w-3.5 mr-1.5" /> {t("site.upload")}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>

            <div className="mb-4 rounded-xl border border-border/70 bg-muted/20 p-4">
              <div className="space-y-3">
                <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                  <div className="space-y-2">
                  <Label htmlFor="project-document-location">{t("site.location_label")}</Label>
                  <Input
                    id="project-document-location"
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
                    <LocateFixed className="h-3.5 w-3.5 mr-1.5" />
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

            {uploadingFiles.length > 0 && (
              <div className="space-y-2 mb-4">
                {uploadingFiles.map((file, index) => (
                  <div key={index} className="flex items-center gap-2.5 p-3 bg-lavender-pale rounded-xl">
                    <Loader2 className="h-4 w-4 animate-spin text-lavender" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{file.name}</p>
                      <div className="h-1 bg-lavender/20 rounded-full overflow-hidden mt-1.5">
                        <div
                          className="h-full bg-lavender rounded-full transition-all duration-300"
                          style={{ width: `${file.progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {project.documents.length === 0 && uploadingFiles.length === 0 ? (
              <div className="py-8 text-center">
                <FileText className="h-7 w-7 mx-auto mb-2 text-primary/20" />
                <p className="text-xs text-muted-foreground">{t("site.no_documents_uploaded_yet")}</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {project.documents.map((doc) => {
                  const location = getDocumentLocation(doc);
                  const locationName = getDocumentLocationDisplayName(location);
                  const mapUrl = location ? buildDocumentLocationMapUrl(location) : null;

                  return (
                  <div key={doc.id} className="flex items-start gap-2.5 p-2.5 hover:bg-muted/40 rounded-xl group transition-colors">
                    <FileText className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      {isValidExternalUrl(doc.url) ? (
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-foreground truncate hover:text-primary block transition-colors"
                        >
                          {doc.name}
                        </a>
                      ) : (
                        <span className="text-sm font-medium text-foreground truncate block">
                          {doc.name}
                        </span>
                      )}
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
                      className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity h-6 w-6 text-destructive focus-visible:ring-2 focus-visible:ring-destructive/40 focus-visible:ring-offset-2"
                      onClick={() => handleDeleteDocument(doc.id)}
                      aria-label={t("site.delete")}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                );})}
              </div>
            )}
          </div>

          {/* Donors */}
          <div className="bg-card rounded-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-serif text-lg text-foreground">{t("site.donors")}</h2>
              <Dialog open={isAddDonorOpen} onOpenChange={setIsAddDonorOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="rounded-xl">
                    <Plus className="h-3.5 w-3.5 mr-1.5" /> {t("site.add")}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="font-serif">{t("site.add_donor_to_project")}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label>{t("site.select_donor_2")}</Label>
                      <Select
                        value={addingDonorId}
                        onValueChange={setAddingDonorId}
                      >
                        <SelectTrigger className="rounded-xl">
                          <SelectValue placeholder={t("site.choose_a_donor")} />
                        </SelectTrigger>
                        <SelectContent>
                          {allDonors
                            .filter(
                              (d) =>
                                d.isActive &&
                                !project?.projectDonors?.some(
                                  (pd) => pd.donorId === d.id
                                )
                            )
                            .map((donor) => (
                              <SelectItem key={donor.id} value={donor.id}>
                                {donor.name} ({donor.type})
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setIsAddDonorOpen(false);
                          setAddingDonorId("");
                        }}
                      >
                        {t("site.cancel")}
                      </Button>
                      <Button
                        type="button"
                        onClick={handleAddDonor}
                        disabled={!addingDonorId}
                        className="rounded-xl"
                      >
                        {t("site.add_donor")}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {(!project.projectDonors || project.projectDonors.length === 0) ? (
              <div className="py-8 text-center">
                <HandCoins className="h-7 w-7 mx-auto mb-2 text-primary/20" />
                <p className="text-xs text-muted-foreground">{t("site.no_donors_linked_yet")}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {project.projectDonors.map((pd) => {
                  const ds = donorStatusConfig[pd.status] || donorStatusConfig.pending;
                  return (
                    <div
                      key={pd.donorId}
                      className={`flex items-start gap-2.5 p-3.5 rounded-xl ${ds.bg} group`}
                    >
                      <HandCoins className={`h-4 w-4 mt-0.5 shrink-0 ${ds.text}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-foreground">{pd.donor.name}</p>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${ds.text}`}>
                            {getEnumLabel(donorStatusLabels[pd.status], pd.status)}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground capitalize mt-0.5">
                          {pd.donor.type}
                          {pd.donor.contactPerson && ` · ${pd.donor.contactPerson}`}
                        </p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground"
                            aria-label={t("site.more_donor_options")}
                          >
                            <MoreVertical className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleDonorStatusChange(pd.donorId, "active")}>
                            {t("site.set_active")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDonorStatusChange(pd.donorId, "pending")}>
                            {t("site.set_pending")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDonorStatusChange(pd.donorId, "completed")}>
                            {t("site.set_completed")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDonorStatusChange(pd.donorId, "withdrawn")}>
                            {t("site.set_withdrawn")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleSendPortalInvite(pd.donorId)}
                            disabled={sendingInvites.has(pd.donorId) || !pd.donor.email}
                          >
                            <Send className="h-4 w-4 mr-2" />
                            {sendingInvites.has(pd.donorId) ? t("site.sending") : t("site.send_portal_invite")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleRemoveDonor(pd.donorId)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> {t("site.remove")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Team */}
          <div className="bg-card rounded-2xl p-6">
            <h2 className="font-serif text-lg text-foreground mb-5">{t("site.team_members")}</h2>

            {project.members.length === 0 ? (
              <div className="py-8 text-center">
                <User className="h-7 w-7 mx-auto mb-2 text-primary/20" />
                <p className="text-xs text-muted-foreground">{t("site.no_team_members_assigned")}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {project.members.map((member) => (
                  <div key={member.user.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/30 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-sage-pale text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                      {member.user.firstName[0]}
                      {member.user.lastName[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {member.user.firstName} {member.user.lastName}
                      </p>
                      <p className="text-[11px] text-muted-foreground capitalize">{getRoleLabel(member.role)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
