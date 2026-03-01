"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
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
} from "lucide-react";

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

const statusColors: Record<string, string> = {
  planning: "bg-yellow-100 text-yellow-800",
  active: "bg-green-100 text-green-800",
  on_hold: "bg-orange-100 text-orange-800",
  completed: "bg-blue-100 text-blue-800",
  cancelled: "bg-red-100 text-red-800",
};

const milestoneStatusColors: Record<string, string> = {
  pending: "bg-gray-100 text-gray-800",
  in_progress: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

const milestoneStatusIcons: Record<string, React.ReactNode> = {
  pending: <Clock className="h-4 w-4" />,
  in_progress: <Clock className="h-4 w-4" />,
  completed: <CheckCircle className="h-4 w-4" />,
  cancelled: <XCircle className="h-4 w-4" />,
};

const taskStatusColors: Record<string, string> = {
  pending: "bg-gray-100 text-gray-700",
  in_progress: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
};

const taskPriorityColors: Record<string, string> = {
  low: "bg-gray-100 text-gray-600",
  medium: "bg-yellow-100 text-yellow-700",
  high: "bg-red-100 text-red-700",
};

const donorStatusColors: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  pending: "bg-yellow-100 text-yellow-700",
  completed: "bg-blue-100 text-blue-700",
  withdrawn: "bg-red-100 text-red-700",
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
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "ETB" }).format(amount);
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

  if (loading) {
    return (
      <div className="p-6">
        <p>Loading...</p>
      </div>
    );
  }

  if (!project) {
    return null;
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <Button variant="ghost" onClick={() => router.push("/projects")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Projects
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
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
            <Separator className="my-1" />
            <DropdownMenuItem onClick={handleDeleteProject} className="text-red-600">
              <Trash2 className="h-4 w-4 mr-2" /> Delete Project
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-2xl">{project.name}</CardTitle>
                  <CardDescription className="mt-2">
                    {project.description || "No description provided"}
                  </CardDescription>
                </div>
                <Badge className={statusColors[project.status]}>
                  {project.status.replace("_", " ")}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-gray-500">Project Manager</span>
                  </div>
                  <Select
                    value={project.manager.id}
                    onValueChange={handleManagerChange}
                  >
                    <SelectTrigger className="h-8 text-sm">
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
                <div className="text-sm">
                  <span className="text-gray-500">Donors:</span>{" "}
                  {project.projectDonors && project.projectDonors.length > 0 ? (
                    <span className="inline-flex flex-wrap gap-1 ml-1">
                      {project.projectDonors.map((pd) => (
                        <Badge key={pd.donorId} variant="outline" className={`text-xs ${donorStatusColors[pd.status] || ""}`}>
                          {pd.donor.name}
                        </Badge>
                      ))}
                    </span>
                  ) : project.donor ? (
                    <span>{project.donor.name}</span>
                  ) : (
                    <span className="text-gray-400">None assigned</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-gray-500" />
                  <span className="text-sm">
                    Budget: {formatBudget(project.totalBudget)}
                    {project.spentBudget > 0 && (
                      <span className="text-gray-500 ml-1">
                        ({formatBudget(project.spentBudget)} spent)
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <span className="text-sm">
                    {formatDate(project.startDate)} - {formatDate(project.endDate)}
                  </span>
                </div>
              </div>

              <div className="mt-6">
                <div className="flex justify-between text-sm mb-2">
                  <span>Overall Progress</span>
                  <span>{getProgress()}%</span>
                </div>
                <Progress value={getProgress()} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Work Plan / Milestones</CardTitle>
                <Dialog open={isAddMilestoneOpen} onOpenChange={setIsAddMilestoneOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-1" /> Add Milestone
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Milestone</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleAddMilestone} className="space-y-4 mt-4">
                      <div className="space-y-2">
                        <Label htmlFor="milestone-title">Title *</Label>
                        <Input
                          id="milestone-title"
                          value={newMilestone.title}
                          onChange={(e) => setNewMilestone({ ...newMilestone, title: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="milestone-description">Description</Label>
                        <Textarea
                          id="milestone-description"
                          value={newMilestone.description}
                          onChange={(e) => setNewMilestone({ ...newMilestone, description: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="milestone-due">Due Date</Label>
                        <Input
                          id="milestone-due"
                          type="date"
                          value={newMilestone.dueDate}
                          onChange={(e) => setNewMilestone({ ...newMilestone, dueDate: e.target.value })}
                        />
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button type="button" variant="outline" onClick={() => setIsAddMilestoneOpen(false)}>
                          Cancel
                        </Button>
                        <Button type="submit">Add Milestone</Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {project.milestones.length === 0 ? (
                <p className="text-sm text-gray-500">No milestones defined yet.</p>
              ) : (
                <div className="space-y-3">
                  {project.milestones.map((milestone) => (
                    <div key={milestone.id} className="flex items-start gap-3 p-3 border rounded-lg">
                      <div className={`mt-0.5 ${milestoneStatusColors[milestone.status]}`}>
                        {milestoneStatusIcons[milestone.status]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{milestone.title}</h4>
                          <Badge variant="outline" className={milestoneStatusColors[milestone.status]}>
                            {milestone.status.replace("_", " ")}
                          </Badge>
                        </div>
                        {milestone.description && (
                          <p className="text-sm text-gray-500 mt-1">{milestone.description}</p>
                        )}
                        {milestone.dueDate && (
                          <p className="text-xs text-gray-400 mt-1">
                            Due: {formatDate(milestone.dueDate)}
                          </p>
                        )}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
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
                          <Separator className="my-1" />
                          <DropdownMenuItem onClick={() => handleDeleteMilestone(milestone.id)} className="text-red-600">
                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tasks Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Tasks & Activities</CardTitle>
                <Dialog open={isAddTaskOpen} onOpenChange={setIsAddTaskOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-1" /> Add Task
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Task</DialogTitle>
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
                        />
                      </div>
                      <div className="grid gap-4 grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="task-priority">Priority</Label>
                          <Select
                            value={newTask.priority}
                            onValueChange={(value) => setNewTask({ ...newTask, priority: value })}
                          >
                            <SelectTrigger>
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
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="task-assignee">Assign To</Label>
                        <Select
                          value={newTask.assignedTo}
                          onValueChange={(value) => setNewTask({ ...newTask, assignedTo: value === "_none" ? "" : value })}
                        >
                          <SelectTrigger>
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
                        <Button type="button" variant="outline" onClick={() => setIsAddTaskOpen(false)}>
                          Cancel
                        </Button>
                        <Button type="submit">Add Task</Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {project.tasks.length === 0 ? (
                <div className="text-center py-8">
                  <ListTodo className="h-10 w-10 mx-auto text-gray-300 mb-2" />
                  <p className="text-sm text-gray-500">No tasks created yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {project.tasks.map((task) => (
                    <div key={task.id} className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/30 transition-colors">
                      <div className="mt-1">
                        {task.status === "completed" ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : task.status === "in_progress" ? (
                          <Clock className="h-4 w-4 text-blue-500" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className={`font-medium text-sm ${task.status === "completed" ? "line-through text-gray-400" : ""}`}>
                            {task.title}
                          </h4>
                          <Badge variant="outline" className={`text-xs ${taskStatusColors[task.status] || ""}`}>
                            {task.status.replace("_", " ")}
                          </Badge>
                          <Badge variant="outline" className={`text-xs ${taskPriorityColors[task.priority] || ""}`}>
                            {task.priority}
                          </Badge>
                        </div>
                        {task.description && (
                          <p className="text-sm text-gray-500 mt-1 line-clamp-2">{task.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
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
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
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
                          <Separator className="my-1" />
                          <DropdownMenuItem onClick={() => handleDeleteTask(task.id)} className="text-red-600">
                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Documents</CardTitle>
                <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-4 w-4 mr-1" /> Upload
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </div>
            </CardHeader>
            <CardContent>
              {uploadingFiles.length > 0 && (
                <div className="space-y-2 mb-3">
                  {uploadingFiles.map((file, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded">
                      <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{file.name}</p>
                        <div className="h-1.5 bg-blue-100 rounded-full overflow-hidden mt-1">
                          <div
                            className="h-full bg-blue-500 transition-all duration-300"
                            style={{ width: `${file.progress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {project.documents.length === 0 && uploadingFiles.length === 0 ? (
                <p className="text-sm text-gray-500">No documents uploaded yet.</p>
              ) : (
                <div className="space-y-2">
                  {project.documents.map((doc) => (
                    <div key={doc.id} className="flex items-start gap-2 p-2 hover:bg-gray-50 rounded border group">
                      <FileText className="h-4 w-4 mt-0.5 text-gray-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium truncate hover:underline block"
                        >
                          {doc.name}
                        </a>
                        <p className="text-xs text-gray-400">
                          {formatFileSize(doc.size)} • {formatDate(doc.createdAt)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6"
                        onClick={() => handleDeleteDocument(doc.id)}
                      >
                        <Trash2 className="h-3 w-3 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Donors</CardTitle>
                <Dialog open={isAddDonorOpen} onOpenChange={setIsAddDonorOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline">
                      <Plus className="h-4 w-4 mr-1" /> Add
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Donor to Project</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                      <div className="space-y-2">
                        <Label>Select Donor</Label>
                        <Select
                          value={addingDonorId}
                          onValueChange={setAddingDonorId}
                        >
                          <SelectTrigger>
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
                          variant="outline"
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
                        >
                          Add Donor
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {(!project.projectDonors || project.projectDonors.length === 0) ? (
                <p className="text-sm text-gray-500">No donors linked to this project.</p>
              ) : (
                <div className="space-y-3">
                  {project.projectDonors.map((pd) => (
                    <div
                      key={pd.donorId}
                      className="flex items-start gap-2 p-3 border rounded-lg group"
                    >
                      <HandCoins className="h-4 w-4 mt-0.5 text-gray-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium">{pd.donor.name}</p>
                          <Badge
                            variant="outline"
                            className={`text-xs ${donorStatusColors[pd.status] || ""}`}
                          >
                            {pd.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-400 capitalize mt-0.5">
                          {pd.donor.type}
                          {pd.donor.contactPerson && ` · ${pd.donor.contactPerson}`}
                        </p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
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
                          <Separator className="my-1" />
                          <DropdownMenuItem
                            onClick={() => handleRemoveDonor(pd.donorId)}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> Remove
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Team Members</CardTitle>
            </CardHeader>
            <CardContent>
              {project.members.length === 0 ? (
                <p className="text-sm text-gray-500">No team members assigned.</p>
              ) : (
                <div className="space-y-2">
                  {project.members.map((member) => (
                    <div key={member.user.id} className="flex items-center gap-2 p-2 border rounded">
                      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium">
                        {member.user.firstName[0]}
                        {member.user.lastName[0]}
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {member.user.firstName} {member.user.lastName}
                        </p>
                        <p className="text-xs text-gray-500 capitalize">{member.role}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
