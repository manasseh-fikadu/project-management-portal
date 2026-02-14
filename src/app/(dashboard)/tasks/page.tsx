"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";

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

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
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
};

const priorityColors: Record<string, string> = {
  low: "bg-gray-100 text-gray-600",
  medium: "bg-yellow-100 text-yellow-700",
  high: "bg-red-100 text-red-700",
};

const statusColors: Record<string, string> = {
  pending: "bg-gray-100 text-gray-700",
  in_progress: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [filterProject, setFilterProject] = useState<string>("all");
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFiles, setUploadingFiles] = useState<{ name: string; progress: number }[]>([]);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    projectId: "",
    status: "pending",
    priority: "medium",
    dueDate: "",
    assignedTo: "",
  });

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
      status: "pending",
      priority: "medium",
      dueDate: "",
      assignedTo: "",
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
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

  async function handleStatusChange(taskId: string, newStatus: string) {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.task) {
        setTasks(tasks.map((t) => (t.id === data.task.id ? data.task : t)));
        if (selectedTask?.id === taskId) {
          setSelectedTask(data.task);
        }
      }
    } catch (error) {
      console.error("Error updating task:", error);
    }
  }

  async function handleDelete(taskId: string) {
    if (!confirm("Are you sure you want to delete this task?")) return;

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
    setFormData({
      title: selectedTask.title,
      description: selectedTask.description || "",
      projectId: selectedTask.project.id,
      status: selectedTask.status,
      priority: selectedTask.priority,
      dueDate: selectedTask.dueDate ? selectedTask.dueDate.split("T")[0] : "",
      assignedTo: selectedTask.assignee?.id || "",
    });
    setIsEditing(true);
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTask) return;

    try {
      const res = await fetch(`/api/tasks/${selectedTask.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description || null,
          projectId: formData.projectId,
          status: formData.status,
          priority: formData.priority,
          dueDate: formData.dueDate || null,
          assignedTo: formData.assignedTo || null,
        }),
      });
      const data = await res.json();
      if (data.task) {
        setTasks(tasks.map((t) => (t.id === data.task.id ? data.task : t)));
        setSelectedTask(data.task);
        setIsEditing(false);
      }
    } catch (error) {
      console.error("Error updating task:", error);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0 || !selectedTask) return;

    const newUploads = files.map((f) => ({ name: f.name, progress: 0 }));
    setUploadingFiles(newUploads);

    for (const file of files) {
      const uploadFormData = new FormData();
      uploadFormData.append("file", file);

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

  async function handleDeleteDocument(documentId: string) {
    if (!selectedTask || !confirm("Delete this document?")) return;

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
    setIsDetailDialogOpen(true);
  }

  function handleDragStart(e: React.DragEvent, task: Task) {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragEnd() {
    setDraggedTask(null);
    setDragOverColumn(null);
  }

  function handleDragOver(e: React.DragEvent, columnId: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverColumn(columnId);
  }

  function handleDragLeave() {
    setDragOverColumn(null);
  }

  function handleDrop(e: React.DragEvent, newStatus: string) {
    e.preventDefault();
    setDragOverColumn(null);
    
    if (draggedTask && draggedTask.status !== newStatus) {
      handleStatusChange(draggedTask.id, newStatus);
    }
    setDraggedTask(null);
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
    { id: "pending", title: "Pending", tasks: tasks.filter((t) => t.status === "pending") },
    { id: "in_progress", title: "In Progress", tasks: tasks.filter((t) => t.status === "in_progress") },
    { id: "completed", title: "Completed", tasks: tasks.filter((t) => t.status === "completed") },
  ];

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
          <h1 className="text-2xl font-semibold">Task Board</h1>
          <p className="text-muted-foreground">Drag tasks between columns to update status</p>
        </div>
        <div className="flex gap-3">
          <Select value={filterProject} onValueChange={setFilterProject}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog open={isAddDialogOpen} onOpenChange={(open) => { setIsAddDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" /> New Task
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Create New Task</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="projectId">Project *</Label>
                  <Select
                    value={formData.projectId}
                    onValueChange={(value) => setFormData({ ...formData, projectId: value })}
                    required
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

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="priority">Priority</Label>
                    <Select
                      value={formData.priority}
                      onValueChange={(value) => setFormData({ ...formData, priority: value })}
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
                    <Label htmlFor="dueDate">Due Date</Label>
                    <Input
                      id="dueDate"
                      type="date"
                      value={formData.dueDate}
                      onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="assignedTo">Assignee</Label>
                  <Select
                    value={formData.assignedTo}
                    onValueChange={(value) => setFormData({ ...formData, assignedTo: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select assignee" />
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

                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={() => { setIsAddDialogOpen(false); resetForm(); }}>
                    Cancel
                  </Button>
                  <Button type="submit">Create Task</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {columns.map((column) => (
          <div
            key={column.id}
            className={`rounded-lg transition-colors ${
              dragOverColumn === column.id ? "bg-blue-50 ring-2 ring-blue-300" : "bg-gray-50"
            }`}
            onDragOver={(e) => handleDragOver(e, column.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, column.id)}
          >
            <div className="flex items-center justify-between p-3 border-b bg-white rounded-t-lg">
              <h2 className="font-medium text-sm">{column.title}</h2>
              <Badge variant="secondary" className="text-xs">{column.tasks.length}</Badge>
            </div>
            <div className="p-2 min-h-[200px] space-y-2">
              {column.tasks.map((task) => (
                <Card
                  key={task.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, task)}
                  onDragEnd={handleDragEnd}
                  className={`cursor-pointer hover:shadow-md transition-shadow ${
                    draggedTask?.id === task.id ? "opacity-50" : ""
                  }`}
                  onClick={() => openTaskDetail(task)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="text-sm font-medium line-clamp-2">{task.title}</h3>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
                            <MoreVertical className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleStatusChange(task.id, "pending"); }}>
                            Move to Pending
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleStatusChange(task.id, "in_progress"); }}>
                            Move to In Progress
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleStatusChange(task.id, "completed"); }}>
                            Move to Completed
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDelete(task.id); }} className="text-red-600">
                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={`${priorityColors[task.priority]} text-xs`}>
                        {task.priority}
                      </Badge>
                      {task.documents?.length ? (
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <FileText className="h-3 w-3" />
                          {task.documents.length}
                        </span>
                      ) : null}
                      {task.dueDate && (
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <Calendar className="h-3 w-3" />
                          {formatDate(task.dueDate)}
                        </span>
                      )}
                      {task.assignee && (
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <User className="h-3 w-3" />
                          {task.assignee.firstName.charAt(0)}{task.assignee.lastName.charAt(0)}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {column.tasks.length === 0 && (
                <div className="text-center py-6 text-sm text-gray-400">
                  Drop tasks here
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={isDetailDialogOpen} onOpenChange={(open) => { setIsDetailDialogOpen(open); if (!open) setIsEditing(false); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedTask && (
            <>
              <DialogHeader>
                <DialogTitle>{isEditing ? "Edit Task" : selectedTask.title}</DialogTitle>
              </DialogHeader>
              
              {isEditing ? (
                <form onSubmit={handleEditSubmit} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-title">Title *</Label>
                    <Input
                      id="edit-title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-project">Project *</Label>
                    <Select
                      value={formData.projectId}
                      onValueChange={(value) => setFormData({ ...formData, projectId: value })}
                      required
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

                  <div className="space-y-2">
                    <Label htmlFor="edit-description">Description</Label>
                    <Textarea
                      id="edit-description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="edit-status">Status</Label>
                      <Select
                        value={formData.status}
                        onValueChange={(value) => setFormData({ ...formData, status: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-priority">Priority</Label>
                      <Select
                        value={formData.priority}
                        onValueChange={(value) => setFormData({ ...formData, priority: value })}
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
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="edit-dueDate">Due Date</Label>
                      <Input
                        id="edit-dueDate"
                        type="date"
                        value={formData.dueDate}
                        onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-assignedTo">Assignee</Label>
                      <Select
                        value={formData.assignedTo}
                        onValueChange={(value) => setFormData({ ...formData, assignedTo: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select assignee" />
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

                  <div className="flex gap-2 justify-end">
                    <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">Save Changes</Button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4 mt-4">
                  <div className="flex items-center gap-2">
                    <Badge className={priorityColors[selectedTask.priority]}>{selectedTask.priority}</Badge>
                    <Badge className={statusColors[selectedTask.status]}>
                      {selectedTask.status.replace("_", " ")}
                    </Badge>
                  </div>

                  {selectedTask.description && (
                    <div>
                      <h4 className="text-sm font-medium mb-1">Description</h4>
                      <p className="text-sm text-gray-600">{selectedTask.description}</p>
                    </div>
                  )}

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <h4 className="text-sm font-medium mb-1">Project</h4>
                      <p className="text-sm text-gray-600">{selectedTask.project.name}</p>
                    </div>
                    {selectedTask.assignee && (
                      <div>
                        <h4 className="text-sm font-medium mb-1">Assignee</h4>
                        <p className="text-sm text-gray-600">
                          {selectedTask.assignee.firstName} {selectedTask.assignee.lastName}
                        </p>
                      </div>
                    )}
                    {selectedTask.dueDate && (
                      <div>
                        <h4 className="text-sm font-medium mb-1">Due Date</h4>
                        <p className="text-sm text-gray-600">{formatDate(selectedTask.dueDate)}</p>
                      </div>
                    )}
                    <div>
                      <h4 className="text-sm font-medium mb-1">Created By</h4>
                      <p className="text-sm text-gray-600">
                        {selectedTask.creator.firstName} {selectedTask.creator.lastName}
                      </p>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium">Documents</h4>
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

                    {selectedTask.documents?.length === 0 && uploadingFiles.length === 0 ? (
                      <p className="text-sm text-gray-500">No documents attached.</p>
                    ) : (
                      <div className="space-y-2">
                        {selectedTask.documents?.map((doc) => (
                          <div key={doc.id} className="flex items-center gap-2 p-2 border rounded hover:bg-gray-50 group">
                            <FileText className="h-4 w-4 text-gray-400" />
                            <div className="flex-1 min-w-0">
                              <a
                                href={doc.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm font-medium hover:underline truncate block"
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
                              className="opacity-0 group-hover:opacity-100 h-6 w-6"
                              onClick={() => handleDeleteDocument(doc.id)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 pt-4 border-t">
                    <Button variant="outline" size="sm" onClick={startEditing}>
                      <Edit className="h-4 w-4 mr-1" /> Edit
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          <MoreVertical className="h-4 w-4 mr-1" /> Status
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuItem onClick={() => handleStatusChange(selectedTask.id, "pending")}>
                          Move to Pending
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleStatusChange(selectedTask.id, "in_progress")}>
                          Move to In Progress
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleStatusChange(selectedTask.id, "completed")}>
                          Move to Completed
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(selectedTask.id)} className="ml-auto">
                      <Trash2 className="h-4 w-4 mr-1" /> Delete
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
