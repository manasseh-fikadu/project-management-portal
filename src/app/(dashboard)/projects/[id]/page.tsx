"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Edit,
  Trash2,
  Upload,
  FileText,
  CheckCircle,
  Clock,
  XCircle,
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

type Project = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  donorId: string | null;
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

export default function ProjectProfilePage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAddMilestoneOpen, setIsAddMilestoneOpen] = useState(false);
  const [newMilestone, setNewMilestone] = useState({ title: "", description: "", dueDate: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchProject();
  }, [projectId]);

  async function fetchProject() {
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
  }

  function formatDate(date: string | null) {
    if (!date) return "Not set";
    return new Date(date).toLocaleDateString();
  }

  function formatBudget(amount: number) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
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

  async function handleStatusChange(newStatus: string) {
    if (!project) return;
    setSaving(true);
    try {
      await fetch(`/api/projects/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      setProject({ ...project, status: newStatus });
    } finally {
      setSaving(false);
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

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0 || !project) return;

    for (const file of files) {
      const formData = new FormData();
      formData.append("file", file);
      try {
        const res = await fetch(`/api/projects/${projectId}/documents`, {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (data.document) {
          setProject({
            ...project,
            documents: [...project.documents, data.document],
          });
        }
      } catch (error) {
        console.error("Failed to upload document:", error);
      }
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (!project) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => router.push("/projects")}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to Projects
            </Button>
          </div>
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
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
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
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-500" />
                    <span className="text-sm">
                      <span className="text-gray-500">Manager:</span>{" "}
                      {project.manager.firstName} {project.manager.lastName}
                    </span>
                  </div>
                  {project.donorId && (
                    <div className="text-sm">
                      <span className="text-gray-500">Donor ID:</span> {project.donorId}
                    </div>
                  )}
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
                {project.documents.length === 0 ? (
                  <p className="text-sm text-gray-500">No documents uploaded yet.</p>
                ) : (
                  <div className="space-y-2">
                    {project.documents.map((doc) => (
                      <a
                        key={doc.id}
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start gap-2 p-2 hover:bg-gray-50 rounded border"
                      >
                        <FileText className="h-4 w-4 mt-0.5 text-gray-400" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{doc.name}</p>
                          <p className="text-xs text-gray-400">
                            {formatFileSize(doc.size)} • {formatDate(doc.createdAt)}
                          </p>
                        </div>
                      </a>
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
      </main>
    </div>
  );
}
