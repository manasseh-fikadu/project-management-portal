"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/currency";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Calendar,
  User,
  DollarSign,
  FileText,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  Shield,
  FolderOpen,
  ListTodo,
  Milestone as MilestoneIcon,
  Users,
  Download,
  Loader2,
  ShieldAlert,
} from "lucide-react";

type MilestoneData = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  dueDate: string | null;
  completedAt: string | null;
  order: number;
};

type TaskData = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  progress: number;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  assignee: { id: string; firstName: string; lastName: string } | null;
};

type DocumentData = {
  id: string;
  name: string;
  type: string;
  url: string;
  size: number;
  createdAt: string;
};

type BudgetAllocation = {
  id: string;
  activityName: string;
  plannedAmount: number;
};

type ProjectData = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  totalBudget: number;
  spentBudget: number;
  startDate: string | null;
  endDate: string | null;
  donorStatus: string;
  manager: { id: string; firstName: string; lastName: string };
  milestones: MilestoneData[];
  tasks: TaskData[];
  documents: DocumentData[];
  members: Array<{ role: string; user: { id: string; firstName: string; lastName: string } }>;
  budgetAllocations: BudgetAllocation[];
};

type PortalData = {
  donor: { id: string; name: string; type: string };
  expiresAt: string;
  projects: ProjectData[];
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

function formatDate(date: string | null) {
  if (!date) return "Not set";
  return new Date(date).toLocaleDateString();
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

/** Only allow http(s) schemes to prevent javascript: / data: XSS via document URLs. */
function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export default function DonorPortalPage() {
  const params = useParams();
  const token = params.token as string;
  const encodedToken = encodeURIComponent(token);

  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedProject, setExpandedProject] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPortalData() {
      try {
        const res = await fetch(`/api/donor-portal/${encodedToken}`);
        if (!res.ok) {
          const contentType = res.headers.get("content-type") || "";
          const fallbackResponse = res.clone();
          let errorMessage = `Failed to load portal (${res.status} ${res.statusText})`;

          if (contentType.includes("application/json")) {
            try {
              const errData = await res.json();
              const jsonMessage =
                typeof errData?.error === "string"
                  ? errData.error
                  : typeof errData?.message === "string"
                    ? errData.message
                    : "";
              if (jsonMessage.trim()) {
                errorMessage = `${jsonMessage} (${res.status} ${res.statusText})`;
              }
            } catch {
              const fallbackText = (await fallbackResponse.text()).trim();
              if (fallbackText) {
                errorMessage = `${errorMessage}: ${fallbackText}`;
              }
            }
          } else {
            const fallbackText = (await res.text()).trim();
            if (fallbackText) {
              errorMessage = `${errorMessage}: ${fallbackText}`;
            }
          }

          setError(errorMessage);
          return;
        }
        const result = await res.json();
        setData(result);
        // Auto-expand the first project
        if (result.projects?.length > 0) {
          setExpandedProject(result.projects[0].id);
        }
      } catch {
        setError("Failed to connect to the server");
      } finally {
        setLoading(false);
      }
    }

    fetchPortalData();
  }, [encodedToken]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        <p className="text-gray-500">Loading your project portal...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <ShieldAlert className="h-12 w-12 text-red-400" />
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-500 max-w-md">{error}</p>
          <p className="text-sm text-gray-400 mt-4">
            If you believe this is an error, please contact the project administrator to request a new invite link.
          </p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const expiresDate = new Date(data.expiresAt);
  const daysUntilExpiry = Math.ceil((expiresDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Welcome, {data.donor.name}
          </h1>
          <p className="text-gray-500 mt-1">
            You have read-only access to {data.projects.length} project{data.projects.length !== 1 ? "s" : ""} you are associated with.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500 bg-white border rounded-lg px-3 py-2">
          <Shield className="h-4 w-4" />
          <span>
            Access expires {daysUntilExpiry > 0
              ? `in ${daysUntilExpiry} day${daysUntilExpiry !== 1 ? "s" : ""}`
              : "today"}
          </span>
        </div>
      </div>

      {/* Projects */}
      {data.projects.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FolderOpen className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No projects are currently linked to your account.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {data.projects.map((project) => {
            const isExpanded = expandedProject === project.id;
            const milestoneProgress = project.milestones.length > 0
              ? Math.round(
                  (project.milestones.filter((m) => m.status === "completed").length /
                    project.milestones.length) *
                    100
                )
              : 0;
            const taskCounts = {
              total: project.tasks.length,
              completed: project.tasks.filter((t) => t.status === "completed").length,
              inProgress: project.tasks.filter((t) => t.status === "in_progress").length,
              pending: project.tasks.filter((t) => t.status === "pending").length,
            };
            const budgetRemaining = project.totalBudget - project.spentBudget;
            const budgetPercent = project.totalBudget > 0
              ? Math.max(0, Math.min(100, Math.round((project.spentBudget / project.totalBudget) * 100)))
              : 0;

            return (
              <Card key={project.id} className="overflow-hidden">
                {/* Project Header - Always visible */}
                <button
                  type="button"
                  onClick={() => setExpandedProject(isExpanded ? null : project.id)}
                  className="w-full text-left"
                  aria-expanded={isExpanded}
                  aria-controls={`project-${project.id}-content`}
                >
                  <CardHeader className="hover:bg-gray-50/50 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <CardTitle className="text-xl">{project.name}</CardTitle>
                          <Badge className={statusColors[project.status]}>
                            {project.status.replace("_", " ")}
                          </Badge>
                        </div>
                        {project.description && (
                          <p className="text-sm text-gray-500 line-clamp-2">
                            {project.description}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <User className="h-3.5 w-3.5" />
                            {project.manager.firstName} {project.manager.lastName}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {formatDate(project.startDate)} - {formatDate(project.endDate)}
                          </span>
                          <span className="flex items-center gap-1">
                            <DollarSign className="h-3.5 w-3.5" />
                            {formatCurrency(project.totalBudget)}
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-2xl font-bold text-gray-900">{milestoneProgress}%</p>
                        <p className="text-xs text-gray-400">progress</p>
                      </div>
                    </div>
                    <Progress value={milestoneProgress} className="mt-3" />
                  </CardHeader>
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                  <CardContent id={`project-${project.id}-content`} className="pt-0 space-y-8">
                    <Separator />

                    {/* Budget Overview */}
                    <div>
                      <h3 className="text-lg font-medium flex items-center gap-2 mb-4">
                        <DollarSign className="h-5 w-5" /> Budget Overview
                      </h3>
                      <div className="grid gap-4 sm:grid-cols-3">
                        <div className="p-4 bg-gray-50 rounded-lg">
                          <p className="text-sm text-gray-500">Total Budget</p>
                          <p className="text-xl font-semibold">{formatCurrency(project.totalBudget)}</p>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-lg">
                          <p className="text-sm text-gray-500">Spent</p>
                          <p className="text-xl font-semibold text-orange-600">{formatCurrency(project.spentBudget)}</p>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-lg">
                          <p className="text-sm text-gray-500">Remaining</p>
                          <p className={`text-xl font-semibold ${budgetRemaining >= 0 ? "text-green-600" : "text-red-600"}`}>
                            {formatCurrency(budgetRemaining)}
                          </p>
                        </div>
                      </div>
                      {project.totalBudget > 0 && (
                        <div className="mt-3">
                          <div className="flex justify-between text-sm text-gray-500 mb-1">
                            <span>Budget utilization</span>
                            <span>{budgetPercent}%</span>
                          </div>
                          <Progress value={budgetPercent} />
                        </div>
                      )}
                      {project.budgetAllocations.length > 0 && (
                        <div className="mt-4">
                          <p className="text-sm font-medium text-gray-700 mb-2">Budget Allocations</p>
                          <div className="space-y-1">
                            {project.budgetAllocations.map((alloc) => (
                              <div key={alloc.id} className="flex justify-between text-sm py-1 border-b border-gray-100 last:border-0">
                                <span className="text-gray-600">{alloc.activityName}</span>
                                <span className="font-medium">{formatCurrency(alloc.plannedAmount)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <Separator />

                    {/* Milestones */}
                    <div>
                      <h3 className="text-lg font-medium flex items-center gap-2 mb-4">
                        <CheckCircle className="h-5 w-5" /> Milestones
                        <Badge variant="secondary" className="ml-1">
                          {project.milestones.filter((m) => m.status === "completed").length}/{project.milestones.length} completed
                        </Badge>
                      </h3>
                      {project.milestones.length === 0 ? (
                        <p className="text-sm text-gray-500">No milestones defined.</p>
                      ) : (
                        <div className="space-y-3">
                          {project.milestones.map((milestone) => (
                            <div key={milestone.id} className="flex items-start gap-3 p-3 border rounded-lg">
                              <div className="mt-0.5">
                                {milestone.status === "completed" ? (
                                  <CheckCircle className="h-4 w-4 text-green-500" />
                                ) : milestone.status === "in_progress" ? (
                                  <Clock className="h-4 w-4 text-blue-500" />
                                ) : milestone.status === "cancelled" ? (
                                  <XCircle className="h-4 w-4 text-red-500" />
                                ) : (
                                  <Clock className="h-4 w-4 text-gray-400" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-medium text-sm">{milestone.title}</h4>
                                  <Badge variant="outline" className={`text-xs ${milestoneStatusColors[milestone.status] || ""}`}>
                                    {milestone.status.replace("_", " ")}
                                  </Badge>
                                </div>
                                {milestone.description && (
                                  <p className="text-sm text-gray-500 mt-1">{milestone.description}</p>
                                )}
                                {milestone.dueDate && (
                                  <p className="text-xs text-gray-400 mt-1">Due: {formatDate(milestone.dueDate)}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <Separator />

                    {/* Tasks */}
                    <div>
                      <h3 className="text-lg font-medium flex items-center gap-2 mb-4">
                        <ListTodo className="h-5 w-5" /> Tasks & Activities
                      </h3>
                      {taskCounts.total > 0 && (
                        <div className="flex gap-3 mb-4">
                          <Badge variant="outline" className="bg-green-50 text-green-700">
                            {taskCounts.completed} completed
                          </Badge>
                          <Badge variant="outline" className="bg-blue-50 text-blue-700">
                            {taskCounts.inProgress} in progress
                          </Badge>
                          <Badge variant="outline" className="bg-gray-50 text-gray-600">
                            {taskCounts.pending} pending
                          </Badge>
                        </div>
                      )}
                      {project.tasks.length === 0 ? (
                        <p className="text-sm text-gray-500">No tasks created yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {project.tasks.map((task) => (
                            <div key={task.id} className="flex items-start gap-3 p-3 border rounded-lg">
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
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <Separator />

                    {/* Documents */}
                    <div>
                      <h3 className="text-lg font-medium flex items-center gap-2 mb-4">
                        <FileText className="h-5 w-5" /> Documents
                      </h3>
                      {project.documents.length === 0 ? (
                        <p className="text-sm text-gray-500">No documents uploaded yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {project.documents.map((doc) => {
                            const safe = isSafeUrl(doc.url);
                            const Wrapper = safe ? "a" : "span";
                            return (
                              <Wrapper
                                key={doc.id}
                                {...(safe ? { href: doc.url, target: "_blank", rel: "noopener noreferrer" } : {})}
                                className={`flex items-center gap-3 p-3 border rounded-lg transition-colors group ${safe ? "hover:bg-gray-50 cursor-pointer" : "opacity-60 cursor-not-allowed"}`}
                              >
                                <FileText className="h-5 w-5 text-gray-400 shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm font-medium truncate ${safe ? "group-hover:underline" : ""}`}>{doc.name}</p>
                                  <p className="text-xs text-gray-400">
                                    {formatFileSize(doc.size)} &middot; {formatDate(doc.createdAt)}
                                  </p>
                                </div>
                                {safe && (
                                  <Download className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                                )}
                              </Wrapper>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <Separator />

                    {/* Team Members */}
                    <div>
                      <h3 className="text-lg font-medium flex items-center gap-2 mb-4">
                        <Users className="h-5 w-5" /> Team Members
                      </h3>
                      <div className="flex flex-wrap gap-3">
                        {/* Manager */}
                        <div className="flex items-center gap-2 px-3 py-2 border rounded-lg bg-gray-50">
                          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium">
                            {project.manager.firstName[0]}{project.manager.lastName[0]}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{project.manager.firstName} {project.manager.lastName}</p>
                            <p className="text-xs text-gray-500">Manager</p>
                          </div>
                        </div>
                        {/* Other members */}
                        {project.members
                          .filter((m) => m.user.id !== project.manager.id)
                          .map((member) => (
                            <div key={member.user.id} className="flex items-center gap-2 px-3 py-2 border rounded-lg">
                              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium">
                                {member.user.firstName[0]}{member.user.lastName[0]}
                              </div>
                              <div>
                                <p className="text-sm font-medium">{member.user.firstName} {member.user.lastName}</p>
                                <p className="text-xs text-gray-500 capitalize">{member.role}</p>
                              </div>
                            </div>
                          ))}
                        {project.members.filter((m) => m.user.id !== project.manager.id).length === 0 && (
                          <p className="text-sm text-gray-500">No additional team members.</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
