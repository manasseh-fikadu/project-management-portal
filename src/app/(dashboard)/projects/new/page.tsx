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
  ArrowLeft,
} from "lucide-react";
import { CurrencyInput } from "@/components/currency-input";
import { formatCurrency } from "@/lib/currency";

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
  isActive: boolean;
};

type UserOption = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
};

const STEPS = [
  { id: 0, label: "Details", fullLabel: "Project Details", icon: ClipboardList },
  { id: 1, label: "Tasks", fullLabel: "Tasks & Activities", icon: ListTodo },
  { id: 2, label: "Donors", fullLabel: "Donors & Documents", icon: Users },
  { id: 3, label: "Review", fullLabel: "Review & Submit", icon: Eye },
];

const priorityLabels: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

const priorityConfig: Record<string, { bg: string; text: string }> = {
  low: { bg: "bg-muted", text: "text-muted-foreground" },
  medium: { bg: "bg-amber-pale", text: "text-amber-warm" },
  high: { bg: "bg-rose-pale", text: "text-rose-muted" },
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
    const u = users.find((user) => user.id === userId);
    return u ? `${u.firstName} ${u.lastName}` : "Unassigned";
  }

  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto">
      <div className="mb-8">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="text-muted-foreground hover:text-foreground -ml-3 mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <h1 className="font-serif text-3xl text-foreground">New Project</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Set up your project in a few steps
        </p>
      </div>

      {/* Stepper */}
      <nav className="mb-10">
        <ol className="flex items-center">
          {STEPS.map((step, idx) => {
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
                  className={`flex items-center gap-2.5 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : isCompleted
                        ? "bg-sage-pale text-primary cursor-pointer hover:bg-primary/15"
                        : "text-muted-foreground"
                  }`}
                >
                  <span
                    className={`flex items-center justify-center h-6 w-6 rounded-full text-[11px] font-bold shrink-0 ${
                      isActive
                        ? "bg-primary-foreground text-primary"
                        : isCompleted
                          ? "bg-primary text-primary-foreground"
                          : "bg-border text-muted-foreground"
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      idx + 1
                    )}
                  </span>
                  <span className="hidden md:inline">{step.label}</span>
                </button>
                {idx < STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-px mx-3 transition-colors duration-200 ${
                      isCompleted ? "bg-primary" : "bg-border"
                    }`}
                  />
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      {error && (
        <div className="mb-6 p-4 text-sm text-destructive bg-rose-pale border border-rose-muted/20 rounded-xl">
          {error}
        </div>
      )}

      {/* Step 1: Project Details */}
      {currentStep === 0 && (
        <div className="bg-card rounded-2xl p-6 lg:p-8">
          <h2 className="font-serif text-xl text-foreground mb-1">Project Information</h2>
          <p className="text-sm text-muted-foreground mb-8">
            Enter the basic details for your new project
          </p>

          <div className="space-y-6">
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
                className="rounded-xl"
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
                className="rounded-xl"
              />
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="managerId">Project Manager</Label>
                <Select
                  value={formData.managerId}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, managerId: value }))
                  }
                  disabled={loading}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Select manager (defaults to you)" />
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
                <CurrencyInput
                  id="totalBudget"
                  value={formData.totalBudget}
                  onChange={(val) => setFormData((prev) => ({ ...prev, totalBudget: val }))}
                  currency="ETB"
                  min={0}
                  placeholder="0"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, status: value }))
                  }
                  disabled={loading}
                >
                  <SelectTrigger className="rounded-xl">
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
                  className="rounded-xl"
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
                  className="rounded-xl"
                />
              </div>
            </div>

            <div className="border-t border-border pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-serif text-lg text-foreground">
                  Work Plan / Milestones
                </h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addMilestone}
                  disabled={loading}
                  className="rounded-xl"
                >
                  <Plus className="h-4 w-4 mr-1" /> Add Milestone
                </Button>
              </div>

              {milestones.length > 0 ? (
                <div className="space-y-3">
                  {milestones.map((milestone, index) => (
                    <div
                      key={index}
                      className="p-4 bg-muted/40 rounded-xl space-y-3"
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
                            className="rounded-xl"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeMilestone(index)}
                          disabled={loading}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
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
                        className="rounded-xl"
                      />
                      <Input
                        type="date"
                        value={milestone.dueDate}
                        onChange={(e) =>
                          updateMilestone(index, "dueDate", e.target.value)
                        }
                        disabled={loading}
                        className="w-full md:w-auto rounded-xl"
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
          </div>
        </div>
      )}

      {/* Step 2: Tasks & Activities */}
      {currentStep === 1 && (
        <div className="bg-card rounded-2xl p-6 lg:p-8">
          <div className="flex items-start justify-between gap-4 mb-8">
            <div>
              <h2 className="font-serif text-xl text-foreground mb-1">Tasks & Activities</h2>
              <p className="text-sm text-muted-foreground">
                Define the work items — you can always add more later
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addTask}
              disabled={loading}
              className="rounded-xl shrink-0"
            >
              <Plus className="h-4 w-4 mr-1" /> Add Task
            </Button>
          </div>

          {taskInputs.length > 0 ? (
            <div className="space-y-4">
              {taskInputs.map((task, index) => (
                <div
                  key={index}
                  className="p-5 bg-muted/30 rounded-xl space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Task {index + 1}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeTask(index)}
                      disabled={loading}
                      className="text-destructive hover:text-destructive h-7 w-7"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
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
                      className="rounded-xl"
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
                      className="rounded-xl"
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
                      <Label>Due Date</Label>
                      <Input
                        type="date"
                        value={task.dueDate}
                        onChange={(e) =>
                          updateTask(index, "dueDate", e.target.value)
                        }
                        disabled={loading}
                        className="rounded-xl"
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
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 border border-dashed border-border rounded-2xl">
              <ListTodo className="h-10 w-10 mx-auto text-primary/20 mb-3" />
              <p className="text-sm text-muted-foreground mb-4">
                No tasks yet — define the work items for this project
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={addTask}
                disabled={loading}
                className="rounded-xl"
              >
                <Plus className="h-4 w-4 mr-1" /> Add Your First Task
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Step 3: Donor & Documents */}
      {currentStep === 2 && (
        <div className="bg-card rounded-2xl p-6 lg:p-8">
          <h2 className="font-serif text-xl text-foreground mb-1">Donors & Documents</h2>
          <p className="text-sm text-muted-foreground mb-8">
            Link funding partners and upload relevant files
          </p>

          <div className="space-y-8">
            <div>
              <h3 className="font-serif text-lg text-foreground mb-1">Donors</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Select one or more donors for this project
              </p>

              {donors.filter((d) => d.isActive).length > 0 ? (
                <div className="space-y-1.5 max-h-60 overflow-y-auto border border-border rounded-xl p-2">
                  {donors.filter((d) => d.isActive).map((donor) => {
                    const isSelected = selectedDonorIds.includes(donor.id);
                    return (
                      <button
                        key={donor.id}
                        type="button"
                        onClick={() => toggleDonor(donor.id)}
                        disabled={loading}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all duration-150 ${
                          isSelected
                            ? "bg-sage-pale"
                            : "hover:bg-muted/50"
                        }`}
                      >
                        <div
                          className={`flex items-center justify-center h-5 w-5 rounded border-2 shrink-0 transition-colors ${
                            isSelected
                              ? "bg-primary border-primary text-primary-foreground"
                              : "border-border"
                          }`}
                        >
                          {isSelected && <Check className="h-3 w-3" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-foreground">{donor.name}</p>
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
                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Selected ({selectedDonorIds.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {getSelectedDonors().map((donor) => (
                      <span
                        key={donor.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sage-pale text-primary rounded-full text-xs font-medium"
                      >
                        {donor.name}
                        <button
                          type="button"
                          onClick={() => toggleDonor(donor.id)}
                          className="rounded-full hover:bg-primary/10 p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-border pt-8">
              <h3 className="font-serif text-lg text-foreground mb-4">Project Documents</h3>
              <div className="border border-dashed border-border rounded-2xl p-8 text-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                  disabled={loading}
                />
                <Upload className="h-8 w-8 mx-auto text-primary/25 mb-3" />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading}
                  className="rounded-xl"
                >
                  Select Files
                </Button>
                <p className="mt-3 text-xs text-muted-foreground">
                  Proposals, contracts, budgets, or any relevant documents
                </p>
              </div>

              {files.length > 0 && (
                <div className="space-y-2 mt-4">
                  {files.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-muted/40 rounded-xl"
                    >
                      <span className="text-sm text-foreground truncate">{file.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFile(index)}
                        disabled={loading}
                        className="h-7 w-7 shrink-0"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Review */}
      {currentStep === 3 && (
        <div className="bg-card rounded-2xl p-6 lg:p-8">
          <h2 className="font-serif text-xl text-foreground mb-1">Review & Submit</h2>
          <p className="text-sm text-muted-foreground mb-8">
            Confirm everything looks right before creating your project
          </p>

          <div className="space-y-8">
            {/* Project Details */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-2 mb-4">
                <ClipboardList className="h-4 w-4" /> Project Details
              </h3>
              <div className="grid gap-4 md:grid-cols-2 p-5 bg-muted/30 rounded-xl">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Name</p>
                  <p className="font-medium text-foreground">{formData.name}</p>
                </div>
                {formData.description && (
                  <div className="md:col-span-2">
                    <p className="text-xs text-muted-foreground mb-0.5">Description</p>
                    <p className="text-sm text-foreground">{formData.description}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Status</p>
                  <p className="text-sm font-medium text-foreground">
                    {statusLabels[formData.status] || formData.status}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Project Manager</p>
                  <p className="text-sm text-foreground">
                    {getSelectedManager()
                      ? `${getSelectedManager()!.firstName} ${getSelectedManager()!.lastName}`
                      : "You (default)"}
                  </p>
                </div>
                {formData.totalBudget && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Budget</p>
                    <p className="text-sm font-medium text-foreground">
                      {formatCurrency(parseInt(formData.totalBudget), "ETB")}
                    </p>
                  </div>
                )}
                {formData.startDate && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Start Date</p>
                    <p className="text-sm text-foreground">
                      {new Date(formData.startDate).toLocaleDateString()}
                    </p>
                  </div>
                )}
                {formData.endDate && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">End Date</p>
                    <p className="text-sm text-foreground">
                      {new Date(formData.endDate).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>

              {milestones.filter((m) => m.title.trim()).length > 0 && (
                <div className="mt-4 pl-1">
                  <p className="text-xs text-muted-foreground mb-2">
                    Milestones ({milestones.filter((m) => m.title.trim()).length})
                  </p>
                  <div className="space-y-1.5">
                    {milestones
                      .filter((m) => m.title.trim())
                      .map((m, i) => (
                        <div key={i} className="flex items-center gap-2.5 text-sm">
                          <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                          <span className="text-foreground">{m.title}</span>
                          {m.dueDate && (
                            <span className="text-muted-foreground text-xs">
                              — {new Date(m.dueDate).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>

            {/* Tasks */}
            <div className="border-t border-border pt-8">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-2 mb-4">
                <ListTodo className="h-4 w-4" /> Tasks & Activities
              </h3>
              {taskInputs.filter((t) => t.title.trim()).length > 0 ? (
                <div className="space-y-2">
                  {taskInputs
                    .filter((t) => t.title.trim())
                    .map((task, i) => (
                      <div
                        key={i}
                        className="p-4 bg-muted/30 rounded-xl flex items-start justify-between gap-4"
                      >
                        <div className="space-y-1.5 min-w-0">
                          <p className="font-medium text-sm text-foreground">{task.title}</p>
                          {task.description && (
                            <p className="text-xs text-muted-foreground">
                              {task.description}
                            </p>
                          )}
                          <div className="flex gap-2 flex-wrap">
                            {(() => {
                              const pc = priorityConfig[task.priority] || priorityConfig.medium;
                              return (
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${pc.bg} ${pc.text}`}>
                                  {priorityLabels[task.priority] || task.priority}
                                </span>
                              );
                            })()}
                            {task.dueDate && (
                              <span className="text-xs text-muted-foreground">
                                Due {new Date(task.dueDate).toLocaleDateString()}
                              </span>
                            )}
                            {task.assignedTo && (
                              <span className="text-xs text-muted-foreground">
                                → {getUserName(task.assignedTo)}
                              </span>
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

            {/* Donors & Documents */}
            <div className="border-t border-border pt-8">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-2 mb-4">
                <Users className="h-4 w-4" /> Donors & Documents
              </h3>
              <div className="p-5 bg-muted/30 rounded-xl space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">Donors</p>
                  {getSelectedDonors().length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {getSelectedDonors().map((donor) => (
                        <Badge key={donor.id} variant="secondary" className="text-xs rounded-full">
                          {donor.name} ({donor.type})
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No donors selected</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">Documents</p>
                  {files.length > 0 ? (
                    <div className="space-y-1">
                      {files.map((f, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                          <span className="text-foreground">{f.name}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No documents uploaded</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between mt-8">
        <Button
          type="button"
          variant="ghost"
          onClick={currentStep === 0 ? () => router.back() : prevStep}
          disabled={loading}
          className="text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          {currentStep === 0 ? "Cancel" : "Previous"}
        </Button>

        <div className="flex gap-3">
          {currentStep < STEPS.length - 1 && currentStep > 0 && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setCurrentStep(STEPS.length - 1)}
              disabled={loading || !canProceed()}
              className="text-muted-foreground"
            >
              Skip to Review
            </Button>
          )}

          {currentStep < STEPS.length - 1 ? (
            <Button
              type="button"
              onClick={nextStep}
              disabled={loading || !canProceed()}
              className="rounded-xl"
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="rounded-xl"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating…
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
