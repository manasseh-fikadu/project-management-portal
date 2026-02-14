"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Search, MoreVertical, Trash2, Edit, DollarSign, Calendar, Building2, FolderKanban, TrendingUp } from "lucide-react";

type Donor = {
  id: string;
  name: string;
  type: string;
};

type Project = {
  id: string;
  name: string;
};

type Proposal = {
  id: string;
  title: string;
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
  creator: {
    id: string;
    firstName: string;
    lastName: string;
  };
};

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  submitted: "bg-blue-100 text-blue-800",
  under_review: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  withdrawn: "bg-purple-100 text-purple-800",
};

const statusLabels: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under Review",
  approved: "Approved",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

export default function ProposalsPage() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [donors, setDonors] = useState<Donor[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingProposal, setEditingProposal] = useState<Proposal | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    donorId: "",
    projectId: "",
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
  });

  useEffect(() => {
    fetchProposals();
    fetchDonors();
    fetchProjects();
  }, []);

  async function fetchProposals() {
    try {
      const res = await fetch("/api/proposals");
      const data = await res.json();
      if (data.proposals) {
        setProposals(data.proposals);
      }
    } finally {
      setLoading(false);
    }
  }

  async function fetchDonors() {
    try {
      const res = await fetch("/api/donors");
      const data = await res.json();
      if (data.donors) {
        setDonors(data.donors);
      }
    } catch (error) {
      console.error("Error fetching donors:", error);
    }
  }

  async function fetchProjects() {
    try {
      const res = await fetch("/api/projects");
      const data = await res.json();
      if (data.projects) {
        setProjects(data.projects);
      }
    } catch (error) {
      console.error("Error fetching projects:", error);
    }
  }

  function resetForm() {
    setFormData({
      title: "",
      donorId: "",
      projectId: "",
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
    });
    setEditingProposal(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const payload = {
      ...formData,
      donorId: formData.donorId || null,
      projectId: formData.projectId || null,
      amountRequested: parseInt(formData.amountRequested),
      amountApproved: formData.amountApproved ? parseInt(formData.amountApproved) : null,
      submissionDate: formData.submissionDate || null,
      decisionDate: formData.decisionDate || null,
      startDate: formData.startDate || null,
      endDate: formData.endDate || null,
    };

    try {
      if (editingProposal) {
        const res = await fetch(`/api/proposals/${editingProposal.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.proposal) {
          setProposals(proposals.map((p) => (p.id === data.proposal.id ? data.proposal : p)));
        }
      } else {
        const res = await fetch("/api/proposals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.proposal) {
          setProposals([data.proposal, ...proposals]);
        }
      }
      resetForm();
      setIsAddDialogOpen(false);
    } catch (error) {
      console.error("Error saving proposal:", error);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this proposal?")) return;

    try {
      await fetch(`/api/proposals/${id}`, { method: "DELETE" });
      setProposals(proposals.filter((p) => p.id !== id));
    } catch (error) {
      console.error("Error deleting proposal:", error);
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
        setProposals(proposals.map((p) => (p.id === data.proposal.id ? data.proposal : p)));
      }
    } catch (error) {
      console.error("Error updating proposal status:", error);
    }
  }

  function openEditDialog(proposal: Proposal) {
    setEditingProposal(proposal);
    setFormData({
      title: proposal.title,
      donorId: proposal.donor?.id || "",
      projectId: proposal.project?.id || "",
      status: proposal.status,
      amountRequested: proposal.amountRequested.toString(),
      amountApproved: proposal.amountApproved?.toString() || "",
      currency: proposal.currency,
      submissionDate: proposal.submissionDate ? proposal.submissionDate.split("T")[0] : "",
      decisionDate: proposal.decisionDate ? proposal.decisionDate.split("T")[0] : "",
      startDate: proposal.startDate ? proposal.startDate.split("T")[0] : "",
      endDate: proposal.endDate ? proposal.endDate.split("T")[0] : "",
      description: proposal.description || "",
      notes: proposal.notes || "",
    });
    setIsAddDialogOpen(true);
  }

  function formatCurrency(amount: number, currency: string) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  function formatDate(date: string | null) {
    if (!date) return "Not set";
    return new Date(date).toLocaleDateString();
  }

  const filteredProposals = proposals.filter((proposal) => {
    const matchesSearch =
      proposal.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      proposal.donor?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      proposal.project?.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === "all" || proposal.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const pipelineStats = {
    total: proposals.length,
    draft: proposals.filter((p) => p.status === "draft").length,
    submitted: proposals.filter((p) => p.status === "submitted").length,
    underReview: proposals.filter((p) => p.status === "under_review").length,
    approved: proposals.filter((p) => p.status === "approved").length,
    totalAmount: proposals.reduce((sum, p) => sum + p.amountRequested, 0),
    approvedAmount: proposals
      .filter((p) => p.status === "approved")
      .reduce((sum, p) => sum + (p.amountApproved || p.amountRequested), 0),
  };

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
          <h1 className="text-2xl font-semibold">Proposal Tracker</h1>
          <p className="text-muted-foreground">Monitor grant proposals from submission to approval</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={(open) => { setIsAddDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" /> New Proposal
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingProposal ? "Edit Proposal" : "Create New Proposal"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="title">Proposal Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="donorId">Donor</Label>
                  <Select
                    value={formData.donorId}
                    onValueChange={(value) => setFormData({ ...formData, donorId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select donor" />
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
                  <Label htmlFor="projectId">Related Project</Label>
                  <Select
                    value={formData.projectId}
                    onValueChange={(value) => setFormData({ ...formData, projectId: value })}
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
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="submitted">Submitted</SelectItem>
                      <SelectItem value="under_review">Under Review</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                      <SelectItem value="withdrawn">Withdrawn</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amountRequested">Amount Requested *</Label>
                  <Input
                    id="amountRequested"
                    type="number"
                    value={formData.amountRequested}
                    onChange={(e) => setFormData({ ...formData, amountRequested: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Select
                    value={formData.currency}
                    onValueChange={(value) => setFormData({ ...formData, currency: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ETB">ETB</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {formData.status === "approved" && (
                <div className="space-y-2">
                  <Label htmlFor="amountApproved">Amount Approved</Label>
                  <Input
                    id="amountApproved"
                    type="number"
                    value={formData.amountApproved}
                    onChange={(e) => setFormData({ ...formData, amountApproved: e.target.value })}
                  />
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="submissionDate">Submission Date</Label>
                  <Input
                    id="submissionDate"
                    type="date"
                    value={formData.submissionDate}
                    onChange={(e) => setFormData({ ...formData, submissionDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="decisionDate">Decision Date</Label>
                  <Input
                    id="decisionDate"
                    type="date"
                    value={formData.decisionDate}
                    onChange={(e) => setFormData({ ...formData, decisionDate: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Project Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">Project End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  />
                </div>
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

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => { setIsAddDialogOpen(false); resetForm(); }}>
                  Cancel
                </Button>
                <Button type="submit">{editingProposal ? "Update" : "Create"} Proposal</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Proposals</CardDescription>
            <CardTitle className="text-2xl">{pipelineStats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pipeline Value</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(pipelineStats.totalAmount, "ETB")}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Approved</CardDescription>
            <CardTitle className="text-2xl text-green-600">{pipelineStats.approved}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Approved Value</CardDescription>
            <CardTitle className="text-2xl text-green-600">{formatCurrency(pipelineStats.approvedAmount, "ETB")}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="flex gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search proposals..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="submitted">Submitted</SelectItem>
            <SelectItem value="under_review">Under Review</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="withdrawn">Withdrawn</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="list">
        <TabsList className="mb-4">
          <TabsTrigger value="list">List View</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline View</TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          {filteredProposals.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-gray-500 mb-4">
                  {searchQuery || filterStatus !== "all" ? "No proposals match your search" : "No proposals found"}
                </p>
                {!searchQuery && filterStatus === "all" && (
                  <Button onClick={() => setIsAddDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" /> Create your first proposal
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredProposals.map((proposal) => (
                <Card key={proposal.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-gray-100 rounded-lg">
                          <TrendingUp className="h-5 w-5 text-gray-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium">{proposal.title}</h3>
                            <Badge className={statusColors[proposal.status]}>
                              {statusLabels[proposal.status]}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                            {proposal.donor && (
                              <div className="flex items-center gap-1">
                                <Building2 className="h-3 w-3" />
                                <span>{proposal.donor.name}</span>
                              </div>
                            )}
                            {proposal.project && (
                              <div className="flex items-center gap-1">
                                <FolderKanban className="h-3 w-3" />
                                <span>{proposal.project.name}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-1">
                              <DollarSign className="h-3 w-3" />
                              <span>{formatCurrency(proposal.amountRequested, proposal.currency)}</span>
                            </div>
                            {proposal.submissionDate && (
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                <span>{formatDate(proposal.submissionDate)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(proposal)}>
                            <Edit className="h-4 w-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(proposal.id, "submitted")}>
                            Mark as Submitted
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(proposal.id, "under_review")}>
                            Mark as Under Review
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(proposal.id, "approved")}>
                            Mark as Approved
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(proposal.id, "rejected")}>
                            Mark as Rejected
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDelete(proposal.id)} className="text-red-600">
                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="pipeline">
          <div className="grid gap-4 md:grid-cols-5">
            {["draft", "submitted", "under_review", "approved", "rejected"].map((status) => (
              <div key={status} className="space-y-2">
                <div className="flex items-center justify-between p-2 bg-gray-100 rounded-lg">
                  <span className="font-medium text-sm">{statusLabels[status]}</span>
                  <Badge variant="secondary">
                    {proposals.filter((p) => p.status === status).length}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {proposals
                    .filter((p) => p.status === status)
                    .map((proposal) => (
                      <Card key={proposal.id} className="cursor-pointer hover:shadow-md transition-shadow">
                        <CardContent className="p-3">
                          <p className="font-medium text-sm truncate">{proposal.title}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {formatCurrency(proposal.amountRequested, proposal.currency)}
                          </p>
                          {proposal.donor && (
                            <p className="text-xs text-gray-400 mt-1 truncate">{proposal.donor.name}</p>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
