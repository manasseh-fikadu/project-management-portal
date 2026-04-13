"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
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
  MoreVertical,
  Trash2,
  Calendar,
  User,
  FileText,
  Upload,
  X,
  Loader2,
  Edit,
  Leaf,
  CheckSquare,
  LocateFixed,
  MapPin,
} from "lucide-react";
import {
  buildDocumentLocationMapUrl,
  DOCUMENT_LOCATION_TIMEOUT_MS,
  getDocumentLocationDisplayName,
  getGeolocationErrorMessage,
  parseDocumentMetadata,
  resolveLocationLabelFromCoordinates,
  type DocumentMetadata,
} from "@/lib/document-location";

type User = {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
};

type Project = {
  id: string;
  name: string;
};

type MilestoneSummary = {
  id: string;
  title: string;
  status: string;
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

function getDocumentLocation(document: Document) {
  return parseDocumentMetadata(document.metadata)?.location ?? null;
}

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
  project: Project;
  assignee: User | null;
  creator: {
    id: string;
    firstName: string;
    lastName: string;
  };
  documents?: Document[];
  taskMilestones: Array<{
    milestone: MilestoneSummary;
  }>;
};

const priorityConfig: Record<string, { bg: string; text: string; label: string }> = {
  low: { bg: "bg-muted", text: "text-muted-foreground", label: "site.low" },
  medium: { bg: "bg-amber-pale", text: "text-amber-warm", label: "site.medium" },
  high: { bg: "bg-rose-pale", text: "text-rose-muted", label: "site.high" },
};

const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: "bg-muted", text: "text-muted-foreground", label: "site.pending" },
  in_progress: { bg: "bg-lavender-pale", text: "text-lavender", label: "site.in_progress" },
  completed: { bg: "bg-sage-pale", text: "text-primary", label: "site.completed" },
};

const columnConfig: Record<string, { bg: string; headerBg: string; dotColor: string; title: string }> = {
  pending: {
    bg: "bg-muted/50",
    headerBg: "bg-card",
    dotColor: "bg-muted-foreground",
    title: "site.pending",
  },
  in_progress: {
    bg: "bg-lavender-pale/30",
    headerBg: "bg-card",
    dotColor: "bg-lavender",
    title: "site.in_progress",
  },
  completed: {
    bg: "bg-sage-pale/30",
    headerBg: "bg-card",
    dotColor: "bg-primary",
    title: "site.completed",
  },
};

function getLinkedMilestones(task: Task) {
  return task.taskMilestones.map((link) => link.milestone);
}

function toggleSelection(currentIds: string[], id: string) {
  return currentIds.includes(id)
    ? currentIds.filter((currentId) => currentId !== id)
    : [...currentIds, id];
}

export default function TasksPage() {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [filterProject, setFilterProject] = useState<string>("all");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFiles, setUploadingFiles] = useState<{ name: string; progress: number }[]>([]);
  const [uploadLocation, setUploadLocation] = useState<UploadLocationState>(createEmptyUploadLocation());
  const [capturingUploadLocation, setCapturingUploadLocation] = useState(false);
  const [uploadLocationError, setUploadLocationError] = useState("");
  const [milestonesByProject, setMilestonesByProject] = useState<Record<string, MilestoneSummary[]>>({});
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    projectId: "",
    priority: "medium",
    progress: 0,
    dueDate: "",
    assignedTo: "",
    milestoneIds: [] as string[],
  });
  const [projectIdError, setProjectIdError] = useState<string | null>(null);
  const [milestoneError, setMilestoneError] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    try {
      const url = filterProject !== "all" ? `/api/tasks?projectId=${filterProject}` : "/api/tasks";
      const res = await fetch(url);
      const data = await res.json();
      if (data.tasks) {
        setTasks(data.tasks);
      }
    } finally {
      setLoading(false);
    }
  }, [filterProject]);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/projects");
      const data = await res.json();
      if (data.projects) {
        setProjects(data.projects);
      }
    } catch (error) {
      console.error("Error fetching projects:", error);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      if (data.users) {
        setUsers(data.users);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  }, []);

  const loadProjectMilestones = useCallback(async (projectId: string): Promise<MilestoneSummary[]> => {
    if (!projectId) {
      return [];
    }

    const cachedMilestones = milestonesByProject[projectId];
    if (cachedMilestones) {
      return cachedMilestones;
    }

    try {
      const res = await fetch(`/api/projects/${projectId}/milestones`);
      const data = await res.json();
      const projectMilestones: MilestoneSummary[] = Array.isArray(data.milestones) ? data.milestones : [];
      setMilestonesByProject((current) => (
        current[projectId]
          ? current
          : { ...current, [projectId]: projectMilestones }
      ));
      return projectMilestones;
    } catch (error) {
      console.error("Error fetching milestones:", error);
      return [];
    }
  }, [milestonesByProject]);

  useEffect(() => {
    fetchTasks();
    fetchProjects();
    fetchUsers();
  }, [fetchTasks, fetchProjects, fetchUsers]);

  useEffect(() => {
    fetchTasks();
  }, [filterProject, fetchTasks]);

  function resetForm() {
    setFormData({
      title: "",
      description: "",
      projectId: "",
      priority: "medium",
      progress: 0,
      dueDate: "",
      assignedTo: "",
      milestoneIds: [],
    });
    setProjectIdError(null);
    setMilestoneError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.projectId) {
      setProjectIdError(t("reports.error_select_project"));
      return;
    }

    if (formData.milestoneIds.length === 0) {
      setMilestoneError(t("site.link_at_least_one_milestone"));
      return;
    }

    await loadProjectMilestones(formData.projectId);

    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          progress: formData.progress,
          assignedTo: formData.assignedTo || null,
          dueDate: formData.dueDate || null,
        }),
      });
      const data = await res.json();
      if (data.task) {
        setTasks([data.task, ...tasks]);
        resetForm();
        setIsAddDialogOpen(false);
      }
    } catch (error) {
      console.error("Error creating task:", error);
    }
  }

  async function handleDelete(taskId: string) {
    if (!confirm(t("site.are_you_sure_you_want_to_delete_this_task"))) return;

    try {
      await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
      setTasks(tasks.filter((t) => t.id !== taskId));
      setIsDetailDialogOpen(false);
      setSelectedTask(null);
    } catch (error) {
      console.error("Error deleting task:", error);
    }
  }

  function startEditing() {
    if (!selectedTask) return;
    loadProjectMilestones(selectedTask.project.id);
    setFormData({
      title: selectedTask.title,
      description: selectedTask.description || "",
      projectId: selectedTask.project.id,
      priority: selectedTask.priority,
      progress: selectedTask.progress ?? 0,
      dueDate: selectedTask.dueDate ? selectedTask.dueDate.split("T")[0] : "",
      assignedTo: selectedTask.assignee?.id || "",
      milestoneIds: getLinkedMilestones(selectedTask).map((milestone) => milestone.id),
    });
    setMilestoneError(null);
    setIsEditing(true);
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTask) return;
    if (formData.milestoneIds.length === 0) {
      setMilestoneError(t("site.link_at_least_one_milestone"));
      return;
    }

    try {
      const res = await fetch(`/api/tasks/${selectedTask.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description || null,
          projectId: formData.projectId,
          priority: formData.priority,
          progress: formData.progress,
          dueDate: formData.dueDate || null,
          assignedTo: formData.assignedTo || null,
          milestoneIds: formData.milestoneIds,
        }),
      });
      const data = await res.json();
      if (data.task) {
        setTasks(tasks.map((t) => (t.id === data.task.id ? data.task : t)));
        setSelectedTask(data.task);
        setMilestoneError(null);
        setIsEditing(false);
      }
    } catch (error) {
      console.error("Error updating task:", error);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0 || !selectedTask) return;
    const locationPayload = buildUploadLocationPayload(uploadLocation);

    const newUploads = files.map((f) => ({ name: f.name, progress: 0 }));
    setUploadingFiles(newUploads);

    for (const file of files) {
      const uploadFormData = new FormData();
      uploadFormData.append("file", file);
      if (locationPayload) {
        uploadFormData.append("locationMetadata", locationPayload);
      }

      setUploadingFiles((prev) =>
        prev.map((u) => (u.name === file.name ? { ...u, progress: 50 } : u))
      );

      try {
        const res = await fetch(`/api/tasks/${selectedTask.id}/documents`, {
          method: "POST",
          body: uploadFormData,
        });
        const data = await res.json();
        if (data.document) {
          setSelectedTask((prev) =>
            prev ? { ...prev, documents: [...(prev.documents || []), data.document] } : prev
          );
          setTasks((prev) =>
            prev.map((t) =>
              t.id === selectedTask.id
                ? { ...t, documents: [...(t.documents || []), data.document] }
                : t
            )
          );
        }
      } catch (error) {
        console.error("Error uploading document:", error);
      }

      setUploadingFiles((prev) =>
        prev.map((u) => (u.name === file.name ? { ...u, progress: 100 } : u))
      );
    }

    setTimeout(() => {
      setUploadingFiles([]);
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
    if (!selectedTask || !confirm(t("site.delete_this_document"))) return;

    try {
      await fetch(`/api/documents/${documentId}`, { method: "DELETE" });
      setSelectedTask((prev) =>
        prev
          ? { ...prev, documents: (prev.documents || []).filter((d) => d.id !== documentId) }
          : prev
      );
      setTasks((prev) =>
        prev.map((t) =>
          t.id === selectedTask.id
            ? { ...t, documents: (t.documents || []).filter((d) => d.id !== documentId) }
            : t
        )
      );
    } catch (error) {
      console.error("Error deleting document:", error);
    }
  }

  function openTaskDetail(task: Task) {
    setSelectedTask(task);
    setMilestoneError(null);
    setIsDetailDialogOpen(true);
  }

  function formatDate(date: string | null) {
    if (!date) return null;
    return new Date(date).toLocaleDateString();
  }

  function formatFileSize(bytes: number) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  const columns = [
    { id: "pending", tasks: tasks.filter((t) => t.status === "pending") },
    { id: "in_progress", tasks: tasks.filter((t) => t.status === "in_progress") },
    { id: "completed", tasks: tasks.filter((t) => t.status === "completed") },
  ];
  const availableMilestones = formData.projectId ? (milestonesByProject[formData.projectId] ?? []) : [];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Leaf className="h-6 w-6 animate-pulse text-primary" />
          <p className="text-sm text-muted-foreground">{t("site.loading_tasks")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10">
      <header className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl lg:text-4xl text-foreground mb-2">{t("site.task_board")}</h1>
            <p className="text-sm text-muted-foreground">
              {t("site.task_status_is_driven_by_linked_milestones")}
            </p>
          </div>
          <div className="flex gap-3 shrink-0">
            <Select value={filterProject} onValueChange={setFilterProject}>
              <SelectTrigger className="w-48 rounded-xl">
                <SelectValue placeholder={t("site.filter_by_project")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("site.all_projects")}</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Dialog open={isAddDialogOpen} onOpenChange={(open) => { setIsAddDialogOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button className="rounded-xl">
                  <Plus className="h-4 w-4 mr-2" /> {t("site.create_new_task")}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle className="font-serif text-xl">{t("site.create_new_task")}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-5 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">{t("site.title")}</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      required
                      className="rounded-xl"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="projectId">{t("site.project_2")}</Label>
                    <Select
                      value={formData.projectId}
                      onValueChange={async (value) => {
                        setFormData({ ...formData, projectId: value, milestoneIds: [] });
                        setProjectIdError(null);
                        setMilestoneError(null);
                        await loadProjectMilestones(value);
                      }}
                      required
                    >
                      <SelectTrigger className={`rounded-xl ${projectIdError ? "border-destructive" : ""}`}>
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
                    {projectIdError && (
                      <p className="text-xs text-destructive">{projectIdError}</p>
                    )}
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

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="priority">{t("site.priority")}</Label>
                      <Select
                        value={formData.priority}
                        onValueChange={(value) => setFormData({ ...formData, priority: value })}
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
                      <Label htmlFor="dueDate">{t("site.due_date")}</Label>
                      <Input
                        id="dueDate"
                        type="date"
                        value={formData.dueDate}
                        onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                        className="rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="progress">{t("site.progress")} ({formData.progress}%)</Label>
                    <div className="flex items-center gap-3">
                      <input
                        id="progress"
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={formData.progress}
                        onChange={(e) => setFormData({ ...formData, progress: Number(e.target.value) })}
                        className="flex-1 h-2 accent-primary"
                      />
                      <span className="text-sm font-medium text-foreground w-10 text-right">{formData.progress}%</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="assignedTo">{t("site.assignee")}</Label>
                    <Select
                      value={formData.assignedTo}
                      onValueChange={(value) => setFormData({ ...formData, assignedTo: value })}
                    >
                      <SelectTrigger className="rounded-xl">
                        <SelectValue placeholder={t("site.select_assignee")} />
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
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <Label>{t("site.linked_milestones")}</Label>
                      <span className="text-xs text-muted-foreground">{t("site.task_status_is_driven_by_linked_milestones")}</span>
                    </div>
                    {formData.projectId ? (
                      availableMilestones.length > 0 ? (
                        <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                          <div className="flex flex-wrap gap-2">
                            {availableMilestones.map((milestone) => {
                              const selected = formData.milestoneIds.includes(milestone.id);
                              return (
                                <button
                                  key={milestone.id}
                                  type="button"
                                  onClick={() => {
                                    setFormData((current) => ({
                                      ...current,
                                      milestoneIds: toggleSelection(current.milestoneIds, milestone.id),
                                    }));
                                    setMilestoneError(null);
                                  }}
                                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                                    selected
                                      ? "border-primary bg-sage-pale text-primary"
                                      : "border-border bg-background text-muted-foreground hover:text-foreground"
                                  }`}
                                >
                                  {milestone.title}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <p className="rounded-xl border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">
                          {t("site.no_milestones_available_create_one_first")}
                        </p>
                      )
                    ) : (
                      <p className="rounded-xl border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">
                        {t("site.select_project_to_load_milestones")}
                      </p>
                    )}
                    {milestoneError ? (
                      <p className="text-xs text-destructive">{milestoneError}</p>
                    ) : null}
                  </div>

                  <div className="flex gap-2 justify-end">
                    <Button type="button" variant="ghost" onClick={() => { setIsAddDialogOpen(false); resetForm(); }}>
                      {t("site.cancel")}
                    </Button>
                    <Button
                      type="submit"
                      className="rounded-xl"
                      disabled={!formData.projectId || availableMilestones.length === 0}
                    >
                      {t("site.create_task")}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      {/* Kanban Board */}
      <div className="grid gap-5 md:grid-cols-3">
        {columns.map((column) => {
          const config = columnConfig[column.id];

          return (
            <div
              key={column.id}
              className={`rounded-2xl transition-all duration-200 ${config.bg}`}
            >
              <div className={`flex items-center justify-between p-4 ${config.headerBg} rounded-t-2xl`}>
                <div className="flex items-center gap-2.5">
                  <span className={`h-2 w-2 rounded-full ${config.dotColor}`} />
                  <h2 className="font-medium text-sm text-foreground">{t(config.title)}</h2>
                </div>
                <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {column.tasks.length}
                </span>
              </div>

              <div className="p-2.5 min-h-[220px] space-y-2.5">
                {column.tasks.map((task) => {
                  const pc = priorityConfig[task.priority] || priorityConfig.medium;
                  const linkedMilestones = getLinkedMilestones(task);
                  return (
                    <div
                      key={task.id}
                      className="bg-card rounded-xl p-3.5 cursor-pointer transition-all duration-150 hover:shadow-md hover:-translate-y-0.5"
                      onClick={() => openTaskDetail(task)}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2.5">
                        <h3 className="text-sm font-medium text-foreground line-clamp-2 leading-snug">{task.title}</h3>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 shrink-0 text-muted-foreground"
                            >
                              <MoreVertical className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDelete(task.id); }} className="text-destructive">
                              <Trash2 className="h-4 w-4 mr-2" /> {t("site.delete")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* Progress bar */}
                      <div className="flex items-center gap-2 mb-2.5">
                        <div className="flex-1 h-1.5 rounded-full bg-sage-pale overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary transition-all duration-300"
                            style={{ width: `${task.progress}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-semibold text-muted-foreground w-7 text-right">{task.progress}%</span>
                      </div>

                      {/* Meta row */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${pc.bg} ${pc.text}`}>
                          {t(pc.label)}
                        </span>
                        {task.documents?.length ? (
                          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <FileText className="h-3 w-3" />
                            {task.documents.length}
                          </span>
                        ) : null}
                        {task.dueDate && (
                          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {formatDate(task.dueDate)}
                          </span>
                        )}
                        {task.assignee && (
                          <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-sage-pale text-primary text-[10px] font-semibold ml-auto shrink-0">
                            {task.assignee.firstName.charAt(0)}{task.assignee.lastName.charAt(0)}
                          </span>
                        )}
                      </div>
                      {linkedMilestones.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {linkedMilestones.slice(0, 2).map((milestone) => (
                            <Badge key={milestone.id} variant="secondary" className="rounded-full text-[10px]">
                              {milestone.title}
                            </Badge>
                          ))}
                          {linkedMilestones.length > 2 ? (
                            <Badge variant="outline" className="rounded-full text-[10px]">
                              +{linkedMilestones.length - 2}
                            </Badge>
                          ) : null}
                        </div>
                      ) : (
                        <p className="mt-2 text-[11px] text-amber-warm">{t("site.link_milestones_to_enable_status_automation")}</p>
                      )}
                    </div>
                  );
                })}

                {column.tasks.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <CheckSquare className="h-6 w-6 text-primary/15 mb-2" />
                    <p className="text-xs text-muted-foreground">{t("site.no_tasks_in_this_status")}</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Task Detail Dialog */}
      <Dialog
        open={isDetailDialogOpen}
        onOpenChange={(open) => {
          setIsDetailDialogOpen(open);
          if (!open) {
            setIsEditing(false);
            setMilestoneError(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedTask && (
            <>
              <DialogHeader>
                <DialogTitle className="font-serif text-xl">
                  {isEditing ? t("site.edit_task") : selectedTask.title}
                </DialogTitle>
              </DialogHeader>
              
              {isEditing ? (
                <form onSubmit={handleEditSubmit} className="space-y-5 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-title">{t("site.title")}</Label>
                    <Input
                      id="edit-title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      required
                      className="rounded-xl"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-project">{t("site.project_2")}</Label>
                    <Select
                      value={formData.projectId}
                      onValueChange={async (value) => {
                        setFormData({ ...formData, projectId: value, milestoneIds: [] });
                        setMilestoneError(null);
                        await loadProjectMilestones(value);
                      }}
                      required
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

                  <div className="space-y-2">
                    <Label htmlFor="edit-description">{t("site.description")}</Label>
                    <Textarea
                      id="edit-description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                      className="rounded-xl"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-priority">{t("site.priority")}</Label>
                    <Select
                      value={formData.priority}
                      onValueChange={(value) => setFormData({ ...formData, priority: value })}
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
                    <Label htmlFor="edit-progress">{t("site.progress")} ({formData.progress}%)</Label>
                    <div className="flex items-center gap-3">
                      <input
                        id="edit-progress"
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={formData.progress}
                        onChange={(e) => setFormData({ ...formData, progress: Number(e.target.value) })}
                        className="flex-1 h-2 accent-primary"
                      />
                      <span className="text-sm font-medium text-foreground w-10 text-right">{formData.progress}%</span>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="edit-dueDate">{t("site.due_date")}</Label>
                      <Input
                        id="edit-dueDate"
                        type="date"
                        value={formData.dueDate}
                        onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-assignedTo">{t("site.assignee")}</Label>
                      <Select
                        value={formData.assignedTo}
                        onValueChange={(value) => setFormData({ ...formData, assignedTo: value })}
                      >
                        <SelectTrigger className="rounded-xl">
                          <SelectValue placeholder={t("site.select_assignee")} />
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
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <Label>{t("site.linked_milestones")}</Label>
                      <span className="text-xs text-muted-foreground">{t("site.task_status_is_driven_by_linked_milestones")}</span>
                    </div>
                    {formData.projectId ? (
                      availableMilestones.length > 0 ? (
                        <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                          <div className="flex flex-wrap gap-2">
                            {availableMilestones.map((milestone) => {
                              const selected = formData.milestoneIds.includes(milestone.id);
                              return (
                                <button
                                  key={milestone.id}
                                  type="button"
                                  onClick={() => {
                                    setFormData((current) => ({
                                      ...current,
                                      milestoneIds: toggleSelection(current.milestoneIds, milestone.id),
                                    }));
                                    setMilestoneError(null);
                                  }}
                                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                                    selected
                                      ? "border-primary bg-sage-pale text-primary"
                                      : "border-border bg-background text-muted-foreground hover:text-foreground"
                                  }`}
                                >
                                  {milestone.title}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <p className="rounded-xl border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">
                          {t("site.no_milestones_available_create_one_first")}
                        </p>
                      )
                    ) : null}
                    {milestoneError ? (
                      <p className="text-xs text-destructive">{milestoneError}</p>
                    ) : null}
                  </div>

                  <div className="flex gap-2 justify-end">
                    <Button type="button" variant="ghost" onClick={() => { setIsEditing(false); setMilestoneError(null); }}>
                      {t("site.cancel")}
                    </Button>
                    <Button
                      type="submit"
                      className="rounded-xl"
                      disabled={!formData.projectId || availableMilestones.length === 0}
                    >
                      {t("site.save_changes")}
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="space-y-6 mt-4">
                  {/* Status & priority pills */}
                  <div className="flex items-center gap-2">
                    {(() => {
                      const pc = priorityConfig[selectedTask.priority] || priorityConfig.medium;
                      return (
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${pc.bg} ${pc.text}`}>
                          {t(pc.label)}
                        </span>
                      );
                    })()}
                    {(() => {
                      const sc = statusConfig[selectedTask.status] || statusConfig.pending;
                      return (
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${sc.bg} ${sc.text}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${sc.text.replace("text-", "bg-")}`} />
                          {t(sc.label)}
                        </span>
                      );
                    })()}
                  </div>

                  {/* Progress */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">{t("site.progress")}</p>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 rounded-full bg-sage-pale overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all duration-500"
                          style={{ width: `${selectedTask.progress}%` }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-foreground">{selectedTask.progress}%</span>
                    </div>
                  </div>

                  {/* Description */}
                  {selectedTask.description && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1.5">{t("site.description")}</p>
                      <p className="text-sm text-foreground leading-relaxed">{selectedTask.description}</p>
                    </div>
                  )}

                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">{t("site.linked_milestones")}</p>
                    {getLinkedMilestones(selectedTask).length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {getLinkedMilestones(selectedTask).map((milestone) => (
                          <Badge key={milestone.id} variant="secondary" className="rounded-full text-xs">
                            {milestone.title}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-amber-warm">{t("site.link_milestones_to_enable_status_automation")}</p>
                    )}
                  </div>

                  {/* Metadata grid */}
                  <div className="grid gap-4 sm:grid-cols-2 p-4 bg-muted/30 rounded-xl">
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">{t("site.project")}</p>
                      <p className="text-sm font-medium text-foreground">{selectedTask.project.name}</p>
                    </div>
                    {selectedTask.assignee && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">{t("site.assignee")}</p>
                        <p className="text-sm font-medium text-foreground">
                          {selectedTask.assignee.firstName} {selectedTask.assignee.lastName}
                        </p>
                      </div>
                    )}
                    {selectedTask.dueDate && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">{t("site.due_date")}</p>
                        <p className="text-sm text-foreground">{formatDate(selectedTask.dueDate)}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">{t("site.created_by")}</p>
                      <p className="text-sm text-foreground">
                        {selectedTask.creator.firstName} {selectedTask.creator.lastName}
                      </p>
                    </div>
                  </div>

                  {/* Documents */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("site.documents")}</p>
                      <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} className="rounded-xl h-7 text-xs">
                        <Upload className="h-3 w-3 mr-1.5" /> {t("site.upload")}
                      </Button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={handleFileUpload}
                      />
                    </div>

                    <div className="mb-3 rounded-xl border border-border/70 bg-muted/20 p-3">
                      <div className="space-y-3">
                        <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                          <div className="space-y-2">
                          <Label htmlFor="task-document-location">{t("site.location_label")}</Label>
                          <Input
                            id="task-document-location"
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

                    {uploadingFiles.length > 0 && (
                      <div className="space-y-2 mb-3">
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

                    {selectedTask.documents?.length === 0 && uploadingFiles.length === 0 ? (
                      <div className="py-6 text-center">
                        <FileText className="h-6 w-6 mx-auto mb-1.5 text-primary/15" />
                        <p className="text-xs text-muted-foreground">{t("site.no_documents_attached")}</p>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {selectedTask.documents?.map((doc) => {
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

                  {/* Actions */}
                  <div className="flex gap-2 pt-4 border-t border-border">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={startEditing}
                      className="rounded-xl"
                    >
                      <Edit className="h-3.5 w-3.5 mr-1.5" /> {t("site.edit")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(selectedTask.id)}
                      className="ml-auto text-destructive hover:text-destructive hover:bg-rose-pale rounded-xl"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" /> {t("site.delete")}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
