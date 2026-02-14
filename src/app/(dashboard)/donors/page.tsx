"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Search, MoreVertical, Trash2, Edit, Building2, Mail, Phone, Globe } from "lucide-react";

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

const donorTypeColors: Record<string, string> = {
  government: "bg-blue-100 text-blue-800",
  foundation: "bg-purple-100 text-purple-800",
  corporate: "bg-green-100 text-green-800",
  individual: "bg-yellow-100 text-yellow-800",
  multilateral: "bg-orange-100 text-orange-800",
  ngo: "bg-pink-100 text-pink-800",
};

const donorTypeLabels: Record<string, string> = {
  government: "Government",
  foundation: "Foundation",
  corporate: "Corporate",
  individual: "Individual",
  multilateral: "Multilateral",
  ngo: "NGO",
};

export default function DonorsPage() {
  const [donors, setDonors] = useState<Donor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingDonor, setEditingDonor] = useState<Donor | null>(null);
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
    });
    setEditingDonor(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const payload = {
      ...formData,
      averageGrantSize: formData.averageGrantSize ? parseInt(formData.averageGrantSize) : null,
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
    });
    setIsAddDialogOpen(true);
  }

  function formatGrantSize(amount: number | null) {
    if (!amount) return "Not specified";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "ETB",
      maximumFractionDigits: 0,
    }).format(amount);
  }

  const filteredDonors = donors.filter((donor) => {
    const matchesSearch =
      donor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      donor.contactPerson?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      donor.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === "all" || donor.type === filterType;
    return matchesSearch && matchesType;
  });

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
          <h1 className="text-2xl font-semibold">Donor Directory</h1>
          <p className="text-muted-foreground">Manage donor contacts and grant opportunities</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={(open) => { setIsAddDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" /> Add Donor
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingDonor ? "Edit Donor" : "Add New Donor"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Organization Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Donor Type *</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => setFormData({ ...formData, type: value })}
                    required
                  >
                    <SelectTrigger>
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

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="contactPerson">Contact Person</Label>
                  <Input
                    id="contactPerson"
                    value={formData.contactPerson}
                    onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
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
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="grantTypes">Grant Types</Label>
                  <Input
                    id="grantTypes"
                    value={formData.grantTypes}
                    onChange={(e) => setFormData({ ...formData, grantTypes: e.target.value })}
                    placeholder="e.g., Project, Core, Emergency"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="focusAreas">Focus Areas</Label>
                  <Input
                    id="focusAreas"
                    value={formData.focusAreas}
                    onChange={(e) => setFormData({ ...formData, focusAreas: e.target.value })}
                    placeholder="e.g., Health, Education"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="averageGrantSize">Average Grant Size (ETB)</Label>
                <Input
                  id="averageGrantSize"
                  type="number"
                  value={formData.averageGrantSize}
                  onChange={(e) => setFormData({ ...formData, averageGrantSize: e.target.value })}
                  placeholder="e.g., 500000"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => { setIsAddDialogOpen(false); resetForm(); }}>
                  Cancel
                </Button>
                <Button type="submit">{editingDonor ? "Update" : "Create"} Donor</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search donors..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-40">
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

      {filteredDonors.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500 mb-4">
              {searchQuery || filterType !== "all" ? "No donors match your search" : "No donors found"}
            </p>
            {!searchQuery && filterType === "all" && (
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" /> Add your first donor
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredDonors.map((donor) => (
            <Card key={donor.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <Building2 className="h-5 w-5 text-gray-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{donor.name}</CardTitle>
                      <Badge className={donorTypeColors[donor.type] + " mt-1"}>
                        {donorTypeLabels[donor.type]}
                      </Badge>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditDialog(donor)}>
                        <Edit className="h-4 w-4 mr-2" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDelete(donor.id)} className="text-red-600">
                        <Trash2 className="h-4 w-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {donor.contactPerson && (
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Contact:</span> {donor.contactPerson}
                  </p>
                )}
                {donor.email && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Mail className="h-4 w-4" />
                    <a href={`mailto:${donor.email}`} className="hover:underline">
                      {donor.email}
                    </a>
                  </div>
                )}
                {donor.phone && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Phone className="h-4 w-4" />
                    <span>{donor.phone}</span>
                  </div>
                )}
                {donor.website && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Globe className="h-4 w-4" />
                    <a href={donor.website} target="_blank" rel="noopener noreferrer" className="hover:underline truncate">
                      {donor.website}
                    </a>
                  </div>
                )}
                {donor.focusAreas && (
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Focus:</span> {donor.focusAreas}
                  </p>
                )}
                {donor.averageGrantSize && (
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Avg. Grant:</span> {formatGrantSize(donor.averageGrantSize)}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
