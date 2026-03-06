"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
  X,
  Send,
  Leaf,
} from "lucide-react";
import { formatCurrency } from "@/lib/currency";

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

const statusConfig: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  planning: { bg: "bg-amber-pale", text: "text-amber-warm", dot: "bg-amber-warm", label: "Planning" },
  active: { bg: "bg-sage-pale", text: "text-primary", dot: "bg-primary", label: "Active" },
  on_hold: { bg: "bg-rose-pale", text: "text-rose-muted", dot: "bg-rose-muted", label: "On Hold" },
  completed: { bg: "bg-lavender-pale", text: "text-lavender", dot: "bg-lavender", label: "Completed" },
  cancelled: { bg: "bg-destructive/10", text: "text-destructive", dot: "bg-destructive", label: "Cancelled" },
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

export default function ProjectProfilePage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [isAddMilestoneOpen, setIsAddMilestoneOpen] = useState(false);
  const [newMilestone, setNewMilestone] = useState({ title: "", description: "", dueDate: "" });
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
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
  const [sendingInvites, setSendingInvites] = useState<Set<string>>(new Set());

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      if (data.users) setUsers(data.users);
    } catch (err) {
      console.error("Error fetching users:", err);
    }
  }, []);

  const fetchDonors = useCallback(async () => {
    try {
      const res = await fetch("/api/donors");
      const data = await res.json();
      if (data.donors) setAllDonors(data.donors);
    } catch (err) {
      console.error("Error fetching donors:", err);
    }
  }, []);

  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      const data = await res.json();
      if (data.project) {
        setProject(data.project);
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
    fetchProject();
    fetchUsers();
    fetchDonors();
  }, [fetchProject, fetchUsers, fetchDonors]);

  function formatDate(date: string | null) {
    if (!date) return "Not set";
    return new Date(date).toLocaleDateString();
  }

  function formatBudget(amount: number) {
    return formatCurrency(amount, "ETB");
  }

  function formatFileSize(bytes: number) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  function getProgress() {
    if (!project || project.milestones.length === 0) return 0;
    const completed = project.milestones.filter((m) => m.status === "completed").length;
    return Math.round((completed / project.milestones.length) * 100);
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
      console.error("Failed to update manager:", error);
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
      console.error("Failed to update milestone:", error);
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
      console.error("Failed to add milestone:", error);
    }
  }

  async function handleDeleteMilestone(milestoneId: string) {
    if (!project || !confirm("Are you sure you want to delete this milestone?")) return;

    try {
      await fetch(`/api/milestones/${milestoneId}`, { method: "DELETE" });
      setProject({
        ...project,
        milestones: project.milestones.filter((m) => m.id !== milestoneId),
      });
    } catch (error) {
      console.error("Failed to delete milestone:", error);
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
      console.error("Failed to add task:", error);
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
      console.error("Failed to update task:", error);
    }
  }

  async function handleDeleteTask(taskId: string) {
    if (!project || !confirm("Are you sure you want to delete this task?")) return;
    try {
      await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
      setProject({
        ...project,
        tasks: project.tasks.filter((t) => t.id !== taskId),
      });
    } catch (error) {
      console.error("Failed to delete task:", error);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0 || !project) return;

    const newUploads: UploadingFile[] = files.map((f) => ({ name: f.name, progress: 0 }));
    setUploadingFiles((prev) => [...prev, ...newUploads]);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const formData = new FormData();
      formData.append("file", file);

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
        console.error("Failed to upload document:", error);
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

  async function handleDeleteDocument(documentId: string) {
    if (!project || !confirm("Are you sure you want to delete this document?")) return;

    try {
      await fetch(`/api/documents/${documentId}`, { method: "DELETE" });
      setProject({
        ...project,
        documents: project.documents.filter((d) => d.id !== documentId),
      });
    } catch (error) {
      console.error("Failed to delete document:", error);
    }
  }

  async function handleDeleteProject() {
    if (!confirm("Are you sure you want to delete this project? This action cannot be undone.")) return;

    try {
      await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
      router.push("/projects");
    } catch (error) {
      console.error("Failed to delete project:", error);
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
      console.error("Failed to add donor:", error);
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
      console.error("Failed to update donor status:", error);
    }
  }

  async function handleRemoveDonor(donorId: string) {
    if (!project || !confirm("Remove this donor from the project?")) return;
    try {
      await fetch(`/api/projects/${projectId}/donors?donorId=${donorId}`, {
        method: "DELETE",
      });
      setProject({
        ...project,
        projectDonors: project.projectDonors.filter((pd) => pd.donorId !== donorId),
      });
    } catch (error) {
      console.error("Failed to remove donor:", error);
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
      const data = await res.json();
      if (res.ok) {
        alert("Portal invite sent successfully! The donor will receive an email with access instructions.");
      } else {
        alert(data.error || "Failed to send invite");
      }
    } catch (error) {
      console.error("Failed to send portal invite:", error);
      alert("Failed to send portal invite");
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
          <p className="text-sm text-muted-foreground">Loading project…</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return null;
  }

  const status = statusConfig[project.status] || statusConfig.planning;
  const progress = getProgress();

  return (
    <div className="p-6 lg:p-10">
      {/* Top bar */}
      <div className="mb-8 flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => router.push("/projects")}
          className="text-muted-foreground hover:text-foreground -ml-3"
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Projects
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="text-muted-foreground">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleStatusChange("active")}>
              Set Active
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleStatusChange("on_hold")}>
              Set On Hold
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleStatusChange("completed")}>
              Set Completed
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleStatusChange("cancelled")}>
              Set Cancelled
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDeleteProject} className="text-destructive">
              <Trash2 className="h-4 w-4 mr-2" /> Delete Project
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
                  {project.description || "No description provided"}
                </p>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 ${status.bg} ${status.text}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                {status.label}
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 mb-6">
              <div>
                <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5">
                  <User className="h-3 w-3" /> Project Manager
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
                <p className="text-xs text-muted-foreground mb-1.5">Donors</p>
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
                  <p className="text-sm text-muted-foreground">None assigned</p>
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5">
                  <DollarSign className="h-3 w-3" /> Budget
                </p>
                <p className="text-sm font-medium text-foreground">
                  {formatBudget(project.totalBudget)}
                  {project.spentBudget > 0 && (
                    <span className="text-muted-foreground font-normal ml-1.5">
                      ({formatBudget(project.spentBudget)} spent)
                    </span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5">
                  <Calendar className="h-3 w-3" /> Timeline
                </p>
                <p className="text-sm text-foreground">
                  {formatDate(project.startDate)} — {formatDate(project.endDate)}
                </p>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-2">
                <span className="text-muted-foreground">Overall Progress</span>
                <span className="font-medium text-foreground">{progress}%</span>
              </div>
              <div className="h-2 rounded-full bg-sage-pale overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-700"
                  style={{ width: `${progress}%`, transitionTimingFunction: "cubic-bezier(0.25, 1, 0.5, 1)" }}
                />
              </div>
            </div>
          </div>

          {/* Milestones */}
          <div className="bg-card rounded-2xl p-6 lg:p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-serif text-xl text-foreground">Work Plan / Milestones</h2>
              <Dialog open={isAddMilestoneOpen} onOpenChange={setIsAddMilestoneOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="rounded-xl">
                    <Plus className="h-4 w-4 mr-1" /> Add
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="font-serif">Add New Milestone</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleAddMilestone} className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="milestone-title">Title *</Label>
                      <Input
                        id="milestone-title"
                        value={newMilestone.title}
                        onChange={(e) => setNewMilestone({ ...newMilestone, title: e.target.value })}
                        required
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="milestone-description">Description</Label>
                      <Textarea
                        id="milestone-description"
                        value={newMilestone.description}
                        onChange={(e) => setNewMilestone({ ...newMilestone, description: e.target.value })}
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="milestone-due">Due Date</Label>
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
                        Cancel
                      </Button>
                      <Button type="submit" className="rounded-xl">Add Milestone</Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {project.milestones.length === 0 ? (
              <div className="py-10 text-center">
                <Leaf className="h-8 w-8 mx-auto mb-2 text-primary/20" />
                <p className="text-sm text-muted-foreground">No milestones defined yet</p>
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
                            {milestone.status.replace("_", " ")}
                          </span>
                        </div>
                        {milestone.description && (
                          <p className="text-sm text-muted-foreground mt-1">{milestone.description}</p>
                        )}
                        {milestone.dueDate && (
                          <p className="text-xs text-muted-foreground mt-1.5">
                            Due {formatDate(milestone.dueDate)}
                          </p>
                        )}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground">
                            <MoreVertical className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleMilestoneStatusChange(milestone.id, "in_progress")}>
                            Set In Progress
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleMilestoneStatusChange(milestone.id, "completed")}>
                            Set Completed
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleMilestoneStatusChange(milestone.id, "cancelled")}>
                            Set Cancelled
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDeleteMilestone(milestone.id)} className="text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" /> Delete
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
              <h2 className="font-serif text-xl text-foreground">Tasks & Activities</h2>
              <Dialog open={isAddTaskOpen} onOpenChange={setIsAddTaskOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="rounded-xl">
                    <Plus className="h-4 w-4 mr-1" /> Add
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="font-serif">Add New Task</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleAddTask} className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="task-title">Title *</Label>
                      <Input
                        id="task-title"
                        value={newTask.title}
                        onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                        placeholder="Task title"
                        required
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="task-description">Description</Label>
                      <Textarea
                        id="task-description"
                        value={newTask.description}
                        onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                        placeholder="What needs to be done?"
                        rows={2}
                        className="rounded-xl"
                      />
                    </div>
                    <div className="grid gap-4 grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="task-priority">Priority</Label>
                        <Select
                          value={newTask.priority}
                          onValueChange={(value) => setNewTask({ ...newTask, priority: value })}
                        >
                          <SelectTrigger className="rounded-xl">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="task-due">Due Date</Label>
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
                      <Label htmlFor="task-assignee">Assign To</Label>
                      <Select
                        value={newTask.assignedTo}
                        onValueChange={(value) => setNewTask({ ...newTask, assignedTo: value === "_none" ? "" : value })}
                      >
                        <SelectTrigger className="rounded-xl">
                          <SelectValue placeholder="Select assignee" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">Unassigned</SelectItem>
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
                        Cancel
                      </Button>
                      <Button type="submit" className="rounded-xl">Add Task</Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {project.tasks.length === 0 ? (
              <div className="py-10 text-center">
                <ListTodo className="h-8 w-8 mx-auto mb-2 text-primary/20" />
                <p className="text-sm text-muted-foreground">No tasks created yet</p>
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
                            {task.status.replace("_", " ")}
                          </span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${tp.bg} ${tp.text}`}>
                            {task.priority}
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
                            <span>{task.progress}% done</span>
                          )}
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground">
                            <MoreVertical className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleTaskStatusChange(task.id, "pending")}>
                            Set Pending
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleTaskStatusChange(task.id, "in_progress")}>
                            Set In Progress
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleTaskStatusChange(task.id, "completed")}>
                            Set Completed
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDeleteTask(task.id)} className="text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" /> Delete
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
              <h2 className="font-serif text-lg text-foreground">Documents</h2>
              <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} className="rounded-xl">
                <Upload className="h-3.5 w-3.5 mr-1.5" /> Upload
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileUpload}
              />
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
                <p className="text-xs text-muted-foreground">No documents yet</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {project.documents.map((doc) => (
                  <div key={doc.id} className="flex items-start gap-2.5 p-2.5 hover:bg-muted/40 rounded-xl group transition-colors">
                    <FileText className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-foreground truncate hover:text-primary block transition-colors"
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
                      className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 text-destructive"
                      onClick={() => handleDeleteDocument(doc.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Donors */}
          <div className="bg-card rounded-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-serif text-lg text-foreground">Donors</h2>
              <Dialog open={isAddDonorOpen} onOpenChange={setIsAddDonorOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="rounded-xl">
                    <Plus className="h-3.5 w-3.5 mr-1.5" /> Add
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="font-serif">Add Donor to Project</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label>Select Donor</Label>
                      <Select
                        value={addingDonorId}
                        onValueChange={setAddingDonorId}
                      >
                        <SelectTrigger className="rounded-xl">
                          <SelectValue placeholder="Choose a donor" />
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
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        onClick={handleAddDonor}
                        disabled={!addingDonorId}
                        className="rounded-xl"
                      >
                        Add Donor
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {(!project.projectDonors || project.projectDonors.length === 0) ? (
              <div className="py-8 text-center">
                <HandCoins className="h-7 w-7 mx-auto mb-2 text-primary/20" />
                <p className="text-xs text-muted-foreground">No donors linked yet</p>
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
                            {pd.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground capitalize mt-0.5">
                          {pd.donor.type}
                          {pd.donor.contactPerson && ` · ${pd.donor.contactPerson}`}
                        </p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground">
                            <MoreVertical className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleDonorStatusChange(pd.donorId, "active")}>
                            Set Active
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDonorStatusChange(pd.donorId, "pending")}>
                            Set Pending
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDonorStatusChange(pd.donorId, "completed")}>
                            Set Completed
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDonorStatusChange(pd.donorId, "withdrawn")}>
                            Set Withdrawn
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleSendPortalInvite(pd.donorId)}
                            disabled={sendingInvites.has(pd.donorId) || !pd.donor.email}
                          >
                            <Send className="h-4 w-4 mr-2" />
                            {sendingInvites.has(pd.donorId) ? "Sending…" : "Send Portal Invite"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleRemoveDonor(pd.donorId)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> Remove
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
            <h2 className="font-serif text-lg text-foreground mb-5">Team Members</h2>

            {project.members.length === 0 ? (
              <div className="py-8 text-center">
                <User className="h-7 w-7 mx-auto mb-2 text-primary/20" />
                <p className="text-xs text-muted-foreground">No team members assigned</p>
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
                      <p className="text-[11px] text-muted-foreground capitalize">{member.role}</p>
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
