"use client";

import { useEffect, useState } from "react";
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
import { Plus, Search, MoreVertical, Trash2, Edit, Building2, Mail, Phone, Globe, Power, PowerOff, Send, Leaf, Users } from "lucide-react";
import { CurrencyInput } from "@/components/currency-input";
import { formatCurrency } from "@/lib/currency";

type Donor = {
  id: string;
  name: string;
  type: string;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  website: string | null;
  grantTypes: string | null;
  focusAreas: string | null;
  averageGrantSize: number | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
};

const donorTypeConfig: Record<string, { bg: string; text: string; label: string }> = {
  government: { bg: "bg-lavender-pale", text: "text-lavender", label: "Government" },
  foundation: { bg: "bg-sage-pale", text: "text-primary", label: "Foundation" },
  corporate: { bg: "bg-amber-pale", text: "text-amber-warm", label: "Corporate" },
  individual: { bg: "bg-rose-pale", text: "text-rose-muted", label: "Individual" },
  multilateral: { bg: "bg-lavender-pale", text: "text-lavender", label: "Multilateral" },
  ngo: { bg: "bg-sage-pale", text: "text-primary", label: "NGO" },
};

export default function DonorsPage() {
  const [donors, setDonors] = useState<Donor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingDonor, setEditingDonor] = useState<Donor | null>(null);
  const [sendingInvite, setSendingInvite] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    type: "",
    contactPerson: "",
    email: "",
    phone: "",
    address: "",
    website: "",
    grantTypes: "",
    focusAreas: "",
    averageGrantSize: "",
    notes: "",
    isActive: true,
  });

  useEffect(() => {
    fetchDonors();
  }, []);

  async function fetchDonors() {
    try {
      const res = await fetch("/api/donors");
      const data = await res.json();
      if (data.donors) {
        setDonors(data.donors);
      }
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setFormData({
      name: "",
      type: "",
      contactPerson: "",
      email: "",
      phone: "",
      address: "",
      website: "",
      grantTypes: "",
      focusAreas: "",
      averageGrantSize: "",
      notes: "",
      isActive: true,
    });
    setEditingDonor(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const payload = {
      ...formData,
      averageGrantSize: formData.averageGrantSize ? parseInt(formData.averageGrantSize) : null,
      isActive: formData.isActive,
    };

    try {
      if (editingDonor) {
        const res = await fetch(`/api/donors/${editingDonor.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.donor) {
          setDonors(donors.map((d) => (d.id === data.donor.id ? data.donor : d)));
        }
      } else {
        const res = await fetch("/api/donors", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.donor) {
          setDonors([data.donor, ...donors]);
        }
      }
      resetForm();
      setIsAddDialogOpen(false);
    } catch (error) {
      console.error("Error saving donor:", error);
    }
  }

  async function handleToggleActive(donor: Donor) {
    try {
      const res = await fetch(`/api/donors/${donor.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !donor.isActive }),
      });
      const data = await res.json();
      if (data.donor) {
        setDonors(donors.map((d) => (d.id === data.donor.id ? data.donor : d)));
      }
    } catch (error) {
      console.error("Error toggling donor status:", error);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this donor?")) return;

    try {
      await fetch(`/api/donors/${id}`, { method: "DELETE" });
      setDonors(donors.filter((d) => d.id !== id));
    } catch (error) {
      console.error("Error deleting donor:", error);
    }
  }

  function openEditDialog(donor: Donor) {
    setEditingDonor(donor);
    setFormData({
      name: donor.name,
      type: donor.type,
      contactPerson: donor.contactPerson || "",
      email: donor.email || "",
      phone: donor.phone || "",
      address: donor.address || "",
      website: donor.website || "",
      grantTypes: donor.grantTypes || "",
      focusAreas: donor.focusAreas || "",
      averageGrantSize: donor.averageGrantSize?.toString() || "",
      notes: donor.notes || "",
      isActive: donor.isActive,
    });
    setIsAddDialogOpen(true);
  }

  async function handleSendPortalInvite(donorId: string) {
    setSendingInvite(donorId);
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
      setSendingInvite(null);
    }
  }

  function formatGrantSize(amount: number | null) {
    if (!amount) return "Not specified";
    return formatCurrency(amount, "ETB");
  }

  const filteredDonors = donors.filter((donor) => {
    const matchesSearch =
      donor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      donor.contactPerson?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      donor.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === "all" || donor.type === filterType;
    const matchesStatus =
      filterStatus === "all" ||
      (filterStatus === "active" && donor.isActive) ||
      (filterStatus === "inactive" && !donor.isActive);
    return matchesSearch && matchesType && matchesStatus;
  });

  const activeDonorCount = donors.filter((d) => d.isActive).length;
  const inactiveDonorCount = donors.filter((d) => !d.isActive).length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Leaf className="h-6 w-6 animate-pulse text-primary" />
          <p className="text-sm text-muted-foreground">Loading donors…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10">
      <header className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl lg:text-4xl text-foreground mb-2">
              Donor Directory
            </h1>
            <p className="text-sm text-muted-foreground">
              Manage donor contacts and grant opportunities
            </p>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={(open) => { setIsAddDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="rounded-xl shrink-0">
                <Plus className="h-4 w-4 mr-2" /> Add Donor
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-serif text-xl">
                  {editingDonor ? "Edit Donor" : "Add New Donor"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-5 mt-4">
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Organization Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="type">Donor Type *</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(value) => setFormData({ ...formData, type: value })}
                      required
                    >
                      <SelectTrigger className="rounded-xl">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="government">Government</SelectItem>
                        <SelectItem value="foundation">Foundation</SelectItem>
                        <SelectItem value="corporate">Corporate</SelectItem>
                        <SelectItem value="individual">Individual</SelectItem>
                        <SelectItem value="multilateral">Multilateral</SelectItem>
                        <SelectItem value="ngo">NGO</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="contactPerson">Contact Person</Label>
                    <Input
                      id="contactPerson"
                      value={formData.contactPerson}
                      onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="rounded-xl"
                    />
                  </div>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="website">Website</Label>
                    <Input
                      id="website"
                      value={formData.website}
                      onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                      className="rounded-xl"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Textarea
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    rows={2}
                    className="rounded-xl"
                  />
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="grantTypes">Grant Types</Label>
                    <Input
                      id="grantTypes"
                      value={formData.grantTypes}
                      onChange={(e) => setFormData({ ...formData, grantTypes: e.target.value })}
                      placeholder="e.g., Project, Core, Emergency"
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="focusAreas">Focus Areas</Label>
                    <Input
                      id="focusAreas"
                      value={formData.focusAreas}
                      onChange={(e) => setFormData({ ...formData, focusAreas: e.target.value })}
                      placeholder="e.g., Health, Education"
                      className="rounded-xl"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="averageGrantSize">Average Grant Size</Label>
                  <CurrencyInput
                    id="averageGrantSize"
                    value={formData.averageGrantSize}
                    onChange={(val) => setFormData({ ...formData, averageGrantSize: val })}
                    currency="ETB"
                    placeholder="e.g., 500000"
                  />
                </div>

                <div className="flex items-center gap-3 p-4 bg-muted/40 rounded-xl">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={formData.isActive}
                    onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${formData.isActive ? "bg-primary" : "bg-border"}`}
                  >
                    <span className={`pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform ${formData.isActive ? "translate-x-5" : "translate-x-0"}`} />
                  </button>
                  <div>
                    <Label className="text-sm font-medium">
                      {formData.isActive ? "Active" : "Non-Active"}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {formData.isActive ? "Available for project assignments" : "Hidden from project selections"}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    className="rounded-xl"
                  />
                </div>

                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="ghost" onClick={() => { setIsAddDialogOpen(false); resetForm(); }}>
                    Cancel
                  </Button>
                  <Button type="submit" className="rounded-xl">
                    {editingDonor ? "Update" : "Create"} Donor
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {/* Summary strip */}
      <div className="flex gap-3 mb-8">
        <div className="px-4 py-2.5 bg-sage-pale rounded-xl">
          <span className="text-xs text-muted-foreground">Total</span>
          <p className="font-serif text-lg text-foreground">{donors.length}</p>
        </div>
        <div className="px-4 py-2.5 bg-sage-pale rounded-xl">
          <span className="text-xs text-muted-foreground">Active</span>
          <p className="font-serif text-lg text-primary">{activeDonorCount}</p>
        </div>
        <div className="px-4 py-2.5 bg-rose-pale rounded-xl">
          <span className="text-xs text-muted-foreground">Inactive</span>
          <p className="font-serif text-lg text-rose-muted">{inactiveDonorCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-8">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search donors…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 rounded-xl bg-card"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36 rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-40 rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="government">Government</SelectItem>
            <SelectItem value="foundation">Foundation</SelectItem>
            <SelectItem value="corporate">Corporate</SelectItem>
            <SelectItem value="individual">Individual</SelectItem>
            <SelectItem value="multilateral">Multilateral</SelectItem>
            <SelectItem value="ngo">NGO</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Donor cards */}
      {filteredDonors.length === 0 ? (
        <div className="py-20 text-center">
          <Users className="h-10 w-10 mx-auto mb-3 text-primary/25" />
          <p className="text-sm text-muted-foreground mb-5">
            {searchQuery || filterType !== "all" || filterStatus !== "all"
              ? "No donors match your filters"
              : "No donors yet — add your first one"}
          </p>
          {!searchQuery && filterType === "all" && filterStatus === "all" && (
            <Button onClick={() => setIsAddDialogOpen(true)} className="rounded-xl">
              <Plus className="h-4 w-4 mr-2" /> Add your first donor
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredDonors.map((donor) => {
            const typeConf = donorTypeConfig[donor.type] || donorTypeConfig.foundation;
            return (
              <div
                key={donor.id}
                className={`bg-card rounded-2xl p-5 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 group ${
                  !donor.isActive ? "opacity-55" : ""
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-xl shrink-0 ${typeConf.bg}`}>
                      <Building2 className={`h-5 w-5 ${typeConf.text}`} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-serif text-lg text-foreground leading-snug truncate">{donor.name}</h3>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${typeConf.bg} ${typeConf.text}`}>
                          {typeConf.label}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          donor.isActive ? "bg-sage-pale text-primary" : "bg-muted text-muted-foreground"
                        }`}>
                          <span className={`h-1 w-1 rounded-full ${donor.isActive ? "bg-primary" : "bg-muted-foreground"}`} />
                          {donor.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground shrink-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditDialog(donor)}>
                        <Edit className="h-4 w-4 mr-2" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleToggleActive(donor)}>
                        {donor.isActive ? (
                          <><PowerOff className="h-4 w-4 mr-2" /> Set Inactive</>
                        ) : (
                          <><Power className="h-4 w-4 mr-2" /> Set Active</>
                        )}
                      </DropdownMenuItem>
                      {donor.email && (
                        <DropdownMenuItem
                          onClick={() => handleSendPortalInvite(donor.id)}
                          disabled={sendingInvite === donor.id}
                        >
                          <Send className="h-4 w-4 mr-2" />
                          {sendingInvite === donor.id ? "Sending…" : "Send Portal Invite"}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => handleDelete(donor.id)} className="text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Details */}
                <div className="space-y-2">
                  {donor.contactPerson && (
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">Contact:</span> {donor.contactPerson}
                    </p>
                  )}
                  {donor.email && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="h-3.5 w-3.5 shrink-0" />
                      <a href={`mailto:${donor.email}`} className="hover:text-primary truncate transition-colors">
                        {donor.email}
                      </a>
                    </div>
                  )}
                  {donor.phone && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-3.5 w-3.5 shrink-0" />
                      <span>{donor.phone}</span>
                    </div>
                  )}
                  {donor.website && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Globe className="h-3.5 w-3.5 shrink-0" />
                      <a href={donor.website} target="_blank" rel="noopener noreferrer" className="hover:text-primary truncate transition-colors">
                        {donor.website}
                      </a>
                    </div>
                  )}
                  {donor.focusAreas && (
                    <p className="text-xs text-muted-foreground pt-1">
                      <span className="font-medium text-foreground">Focus:</span> {donor.focusAreas}
                    </p>
                  )}
                  {donor.averageGrantSize && (
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Avg. Grant:</span> {formatGrantSize(donor.averageGrantSize)}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
