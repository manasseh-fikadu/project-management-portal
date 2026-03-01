"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Trash2,
  Upload,
  X,
  ChevronRight,
  ChevronLeft,
  Check,
  ClipboardList,
  ListTodo,
  Users,
  Eye,
  Loader2,
} from "lucide-react";

type MilestoneInput = {
  title: string;
  description: string;
  dueDate: string;
};

type TaskInput = {
  title: string;
  description: string;
  priority: string;
  dueDate: string;
  assignedTo: string;
};

type Donor = {
  id: string;
  name: string;
  type: string;
};

type UserOption = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
};

const STEPS = [
  { id: 0, label: "Project Details", icon: ClipboardList },
  { id: 1, label: "Tasks & Activities", icon: ListTodo },
  { id: 2, label: "Donor & Documents", icon: Users },
  { id: 3, label: "Review & Submit", icon: Eye },
];

const priorityLabels: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

const statusLabels: Record<string, string> = {
  planning: "Planning",
  active: "Active",
  on_hold: "On Hold",
  completed: "Completed",
  cancelled: "Cancelled",
};

export default function NewProjectPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [milestones, setMilestones] = useState<MilestoneInput[]>([]);
  const [taskInputs, setTaskInputs] = useState<TaskInput[]>([]);
  const [donors, setDonors] = useState<Donor[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);

  const [selectedDonorIds, setSelectedDonorIds] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    managerId: "",
    totalBudget: "",
    status: "planning",
    startDate: "",
    endDate: "",
  });

  const fetchDonors = useCallback(async () => {
    try {
      const res = await fetch("/api/donors");
      const data = await res.json();
      if (data.donors) setDonors(data.donors);
    } catch (err) {
      console.error("Error fetching donors:", err);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      if (data.users) setUsers(data.users);
    } catch (err) {
      console.error("Error fetching users:", err);
    }
  }, []);

  useEffect(() => {
    fetchDonors();
    fetchUsers();
  }, [fetchDonors, fetchUsers]);

  function handleInputChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(e.target.files || []);
    setFiles((prev) => [...prev, ...selectedFiles]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  // Milestones
  function addMilestone() {
    setMilestones((prev) => [
      ...prev,
      { title: "", description: "", dueDate: "" },
    ]);
  }
  function removeMilestone(index: number) {
    setMilestones((prev) => prev.filter((_, i) => i !== index));
  }
  function updateMilestone(
    index: number,
    field: keyof MilestoneInput,
    value: string
  ) {
    setMilestones((prev) =>
      prev.map((m, i) => (i === index ? { ...m, [field]: value } : m))
    );
  }

  // Tasks
  function addTask() {
    setTaskInputs((prev) => [
      ...prev,
      {
        title: "",
        description: "",
        priority: "medium",
        dueDate: "",
        assignedTo: "",
      },
    ]);
  }
  function removeTask(index: number) {
    setTaskInputs((prev) => prev.filter((_, i) => i !== index));
  }
  function updateTask(index: number, field: keyof TaskInput, value: string) {
    setTaskInputs((prev) =>
      prev.map((t, i) => (i === index ? { ...t, [field]: value } : t))
    );
  }

  function canProceed(): boolean {
    if (currentStep === 0) {
      return formData.name.trim().length > 0;
    }
    return true;
  }

  function nextStep() {
    if (currentStep < STEPS.length - 1 && canProceed()) {
      setCurrentStep((s) => s + 1);
      setError(null);
    }
  }

  function prevStep() {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
      setError(null);
    }
  }

  async function handleSubmit() {
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          donorIds: selectedDonorIds,
          managerId: formData.managerId || null,
          totalBudget: formData.totalBudget ? parseInt(formData.totalBudget) : 0,
          milestones: milestones.filter((m) => m.title.trim()),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create project");

      const projectId = data.project.id;

      const validTasks = taskInputs.filter((t) => t.title.trim());
      for (const task of validTasks) {
        await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            title: task.title,
            description: task.description || null,
            priority: task.priority,
            dueDate: task.dueDate || null,
            assignedTo: task.assignedTo || null,
          }),
        });
      }

      if (files.length > 0) {
        for (const file of files) {
          const uploadFormData = new FormData();
          uploadFormData.append("file", file);
          await fetch(`/api/projects/${projectId}/documents`, {
            method: "POST",
            body: uploadFormData,
          });
        }
      }

      router.push(`/projects/${projectId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  function getSelectedDonors(): Donor[] {
    return donors.filter((d) => selectedDonorIds.includes(d.id));
  }

  function toggleDonor(donorId: string) {
    setSelectedDonorIds((prev) =>
      prev.includes(donorId) ? prev.filter((id) => id !== donorId) : [...prev, donorId]
    );
  }

  function getSelectedManager(): UserOption | undefined {
    return users.find((u) => u.id === formData.managerId);
  }

  function getUserName(userId: string): string {
    const u = users.find((u) => u.id === userId);
    return u ? `${u.firstName} ${u.lastName}` : "Unassigned";
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => router.back()}>
          ← Back
        </Button>
      </div>

      {/* Stepper Header */}
      <nav className="mb-8">
        <ol className="flex items-center w-full">
          {STEPS.map((step, idx) => {
            const Icon = step.icon;
            const isActive = idx === currentStep;
            const isCompleted = idx < currentStep;
            return (
              <li
                key={step.id}
                className={`flex items-center ${idx < STEPS.length - 1 ? "flex-1" : ""}`}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (isCompleted) setCurrentStep(idx);
                  }}
                  disabled={!isCompleted && !isActive}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : isCompleted
                        ? "bg-primary/10 text-primary cursor-pointer hover:bg-primary/20"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  <span
                    className={`flex items-center justify-center h-7 w-7 rounded-full text-xs font-bold shrink-0 ${
                      isActive
                        ? "bg-primary-foreground text-primary"
                        : isCompleted
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted-foreground/20 text-muted-foreground"
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      idx + 1
                    )}
                  </span>
                  <Icon className="h-4 w-4 hidden sm:block" />
                  <span className="hidden md:inline">{step.label}</span>
                </button>
                {idx < STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-2 ${
                      isCompleted ? "bg-primary" : "bg-muted"
                    }`}
                  />
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      {error && (
        <div className="mb-4 p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
          {error}
        </div>
      )}

      {/* Step 1: Project Details */}
      {currentStep === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Project Information</CardTitle>
            <CardDescription>
              Enter the basic details for your new project
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Project Name *</Label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Enter project name"
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows={3}
                placeholder="Describe the project objectives and scope"
                disabled={loading}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="managerId">Project Manager</Label>
                <Select
                  value={formData.managerId}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, managerId: value }))
                  }
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select project manager (defaults to you)" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.firstName} {user.lastName} ({user.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="totalBudget">Total Budget</Label>
                <Input
                  id="totalBudget"
                  name="totalBudget"
                  type="number"
                  min="0"
                  value={formData.totalBudget}
                  onChange={handleInputChange}
                  placeholder="0"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, status: value }))
                  }
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planning">Planning</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="on_hold">On Hold</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  name="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={handleInputChange}
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  name="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={handleInputChange}
                  disabled={loading}
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">
                  Work Plan / Milestones
                </h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addMilestone}
                  disabled={loading}
                >
                  <Plus className="h-4 w-4 mr-1" /> Add Milestone
                </Button>
              </div>

              {milestones.length > 0 ? (
                <div className="space-y-4">
                  {milestones.map((milestone, index) => (
                    <div
                      key={index}
                      className="p-4 border rounded-lg space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 space-y-2">
                          <Input
                            placeholder="Milestone title *"
                            value={milestone.title}
                            onChange={(e) =>
                              updateMilestone(index, "title", e.target.value)
                            }
                            disabled={loading}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeMilestone(index)}
                          disabled={loading}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                      <Textarea
                        placeholder="Description"
                        value={milestone.description}
                        onChange={(e) =>
                          updateMilestone(index, "description", e.target.value)
                        }
                        rows={2}
                        disabled={loading}
                      />
                      <Input
                        type="date"
                        value={milestone.dueDate}
                        onChange={(e) =>
                          updateMilestone(index, "dueDate", e.target.value)
                        }
                        disabled={loading}
                        className="w-full md:w-auto"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No milestones added yet. Click &quot;Add Milestone&quot; to
                  create your work plan.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Tasks & Activities */}
      {currentStep === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Tasks & Activities</CardTitle>
            <CardDescription>
              Add tasks and activities for this project. You can also add more
              tasks later from the project page.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addTask}
                disabled={loading}
              >
                <Plus className="h-4 w-4 mr-1" /> Add Task
              </Button>
            </div>

            {taskInputs.length > 0 ? (
              <div className="space-y-4">
                {taskInputs.map((task, index) => (
                  <div
                    key={index}
                    className="p-4 border rounded-lg space-y-4 bg-muted/30"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">
                        Task {index + 1}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeTask(index)}
                        disabled={loading}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <Label>Title *</Label>
                      <Input
                        placeholder="Task title"
                        value={task.title}
                        onChange={(e) =>
                          updateTask(index, "title", e.target.value)
                        }
                        disabled={loading}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Textarea
                        placeholder="What needs to be done?"
                        value={task.description}
                        onChange={(e) =>
                          updateTask(index, "description", e.target.value)
                        }
                        rows={2}
                        disabled={loading}
                      />
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="space-y-2">
                        <Label>Priority</Label>
                        <Select
                          value={task.priority}
                          onValueChange={(value) =>
                            updateTask(index, "priority", value)
                          }
                          disabled={loading}
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
                        <Label>Due Date</Label>
                        <Input
                          type="date"
                          value={task.dueDate}
                          onChange={(e) =>
                            updateTask(index, "dueDate", e.target.value)
                          }
                          disabled={loading}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Assign To</Label>
                        <Select
                          value={task.assignedTo}
                          onValueChange={(value) =>
                            updateTask(
                              index,
                              "assignedTo",
                              value === "_none" ? "" : value
                            )
                          }
                          disabled={loading}
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
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 border-2 border-dashed rounded-lg">
                <ListTodo className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground mb-4">
                  No tasks added yet. Add tasks to define the work for this
                  project.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={addTask}
                  disabled={loading}
                >
                  <Plus className="h-4 w-4 mr-1" /> Add Your First Task
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3: Donor & Documents */}
      {currentStep === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Donor & Documents</CardTitle>
            <CardDescription>
              Attach a donor and upload relevant project documents
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Donors</h3>
              <p className="text-sm text-muted-foreground">
                Select one or more donors for this project
              </p>

              {donors.length > 0 ? (
                <div className="space-y-2 max-h-60 overflow-y-auto border rounded-lg p-2">
                  {donors.map((donor) => {
                    const isSelected = selectedDonorIds.includes(donor.id);
                    return (
                      <button
                        key={donor.id}
                        type="button"
                        onClick={() => toggleDonor(donor.id)}
                        disabled={loading}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                          isSelected
                            ? "bg-primary/10 border border-primary/30"
                            : "hover:bg-muted/50 border border-transparent"
                        }`}
                      >
                        <div
                          className={`flex items-center justify-center h-5 w-5 rounded border-2 shrink-0 transition-colors ${
                            isSelected
                              ? "bg-primary border-primary text-primary-foreground"
                              : "border-muted-foreground/30"
                          }`}
                        >
                          {isSelected && <Check className="h-3 w-3" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{donor.name}</p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {donor.type}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No donors available. Create donors first from the Donors page.
                </p>
              )}

              {selectedDonorIds.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    Selected Donors ({selectedDonorIds.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {getSelectedDonors().map((donor) => (
                      <Badge
                        key={donor.id}
                        variant="secondary"
                        className="flex items-center gap-1 pr-1"
                      >
                        {donor.name}
                        <button
                          type="button"
                          onClick={() => toggleDonor(donor.id)}
                          className="ml-1 rounded-full hover:bg-muted p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-4">
              <h3 className="text-lg font-medium">Project Documents</h3>
              <div className="space-y-2">
                <Label>Upload Documents</Label>
                <div className="border-2 border-dashed rounded-lg p-6 text-center">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleFileChange}
                    className="hidden"
                    disabled={loading}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={loading}
                  >
                    <Upload className="h-4 w-4 mr-2" /> Select Files
                  </Button>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Upload project documents, proposals, contracts, etc.
                  </p>
                </div>
              </div>

              {files.length > 0 && (
                <div className="space-y-2">
                  {files.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 bg-muted/50 rounded border"
                    >
                      <span className="text-sm truncate">{file.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFile(index)}
                        disabled={loading}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Review */}
      {currentStep === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Review & Submit</CardTitle>
            <CardDescription>
              Review all the details before creating your project
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Project Details Summary */}
            <div className="space-y-3">
              <h3 className="text-lg font-medium flex items-center gap-2">
                <ClipboardList className="h-5 w-5" /> Project Details
              </h3>
              <div className="grid gap-3 md:grid-cols-2 p-4 bg-muted/30 rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-medium">{formData.name}</p>
                </div>
                {formData.description && (
                  <div className="md:col-span-2">
                    <p className="text-sm text-muted-foreground">Description</p>
                    <p className="text-sm">{formData.description}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge variant="secondary">
                    {statusLabels[formData.status] || formData.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Project Manager
                  </p>
                  <p className="text-sm">
                    {getSelectedManager()
                      ? `${getSelectedManager()!.firstName} ${getSelectedManager()!.lastName}`
                      : "You (default)"}
                  </p>
                </div>
                {formData.totalBudget && (
                  <div>
                    <p className="text-sm text-muted-foreground">Budget</p>
                    <p className="text-sm font-medium">
                      {new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: "ETB",
                      }).format(parseInt(formData.totalBudget))}
                    </p>
                  </div>
                )}
                {formData.startDate && (
                  <div>
                    <p className="text-sm text-muted-foreground">Start Date</p>
                    <p className="text-sm">
                      {new Date(formData.startDate).toLocaleDateString()}
                    </p>
                  </div>
                )}
                {formData.endDate && (
                  <div>
                    <p className="text-sm text-muted-foreground">End Date</p>
                    <p className="text-sm">
                      {new Date(formData.endDate).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>

              {milestones.filter((m) => m.title.trim()).length > 0 && (
                <div className="pl-4">
                  <p className="text-sm font-medium text-muted-foreground mb-2">
                    Milestones ({milestones.filter((m) => m.title.trim()).length}
                    )
                  </p>
                  <ul className="space-y-1">
                    {milestones
                      .filter((m) => m.title.trim())
                      .map((m, i) => (
                        <li key={i} className="text-sm flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                          {m.title}
                          {m.dueDate && (
                            <span className="text-muted-foreground">
                              — Due{" "}
                              {new Date(m.dueDate).toLocaleDateString()}
                            </span>
                          )}
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </div>

            <Separator />

            {/* Tasks Summary */}
            <div className="space-y-3">
              <h3 className="text-lg font-medium flex items-center gap-2">
                <ListTodo className="h-5 w-5" /> Tasks & Activities
              </h3>
              {taskInputs.filter((t) => t.title.trim()).length > 0 ? (
                <div className="space-y-2">
                  {taskInputs
                    .filter((t) => t.title.trim())
                    .map((task, i) => (
                      <div
                        key={i}
                        className="p-3 bg-muted/30 rounded-lg flex items-start justify-between gap-4"
                      >
                        <div className="space-y-1">
                          <p className="font-medium text-sm">{task.title}</p>
                          {task.description && (
                            <p className="text-xs text-muted-foreground">
                              {task.description}
                            </p>
                          )}
                          <div className="flex gap-2 flex-wrap">
                            <Badge
                              variant="outline"
                              className="text-xs capitalize"
                            >
                              {priorityLabels[task.priority] || task.priority}
                            </Badge>
                            {task.dueDate && (
                              <Badge variant="outline" className="text-xs">
                                Due{" "}
                                {new Date(task.dueDate).toLocaleDateString()}
                              </Badge>
                            )}
                            {task.assignedTo && (
                              <Badge variant="outline" className="text-xs">
                                {getUserName(task.assignedTo)}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No tasks added. You can add tasks later from the project page.
                </p>
              )}
            </div>

            <Separator />

            {/* Donor & Documents Summary */}
            <div className="space-y-3">
              <h3 className="text-lg font-medium flex items-center gap-2">
                <Users className="h-5 w-5" /> Donors & Documents
              </h3>
              <div className="p-4 bg-muted/30 rounded-lg space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Donors</p>
                  {getSelectedDonors().length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {getSelectedDonors().map((donor) => (
                        <Badge key={donor.id} variant="secondary" className="text-xs">
                          {donor.name} ({donor.type})
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm">No donors selected</p>
                  )}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Documents</p>
                  {files.length > 0 ? (
                    <ul className="space-y-1 mt-1">
                      {files.map((f, i) => (
                        <li
                          key={i}
                          className="text-sm flex items-center gap-2"
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                          {f.name}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm">No documents uploaded</p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between mt-6">
        <Button
          type="button"
          variant="outline"
          onClick={currentStep === 0 ? () => router.back() : prevStep}
          disabled={loading}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          {currentStep === 0 ? "Cancel" : "Previous"}
        </Button>

        <div className="flex gap-3">
          {currentStep < STEPS.length - 1 && currentStep > 0 && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setCurrentStep(STEPS.length - 1);
              }}
              disabled={loading || !canProceed()}
            >
              Skip to Review
            </Button>
          )}

          {currentStep < STEPS.length - 1 ? (
            <Button
              type="button"
              onClick={nextStep}
              disabled={loading || !canProceed()}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating Project...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  Create Project
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
