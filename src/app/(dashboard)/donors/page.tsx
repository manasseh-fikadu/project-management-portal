"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PortalInviteFeedbackDialog } from "@/components/portal-invite-feedback-dialog";
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
  government: { bg: "bg-lavender-pale", text: "text-lavender", label: "site.government" },
  foundation: { bg: "bg-sage-pale", text: "text-primary", label: "site.foundation" },
  corporate: { bg: "bg-amber-pale", text: "text-amber-warm", label: "site.corporate" },
  individual: { bg: "bg-rose-pale", text: "text-rose-muted", label: "site.individual" },
  multilateral: { bg: "bg-lavender-pale", text: "text-lavender", label: "site.multilateral" },
  ngo: { bg: "bg-sage-pale", text: "text-primary", label: "site.ngo" },
};

function isSafeWebsiteUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export default function DonorsPage() {
  const { t } = useTranslation();
  const [donors, setDonors] = useState<Donor[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingDonor, setEditingDonor] = useState<Donor | null>(null);
  const [sendingInvites, setSendingInvites] = useState<Set<string>>(new Set());
  const [portalInviteFeedback, setPortalInviteFeedback] = useState<{
    open: boolean;
    title: string;
    message: string;
    variant: "success" | "error";
  }>({
    open: false,
    title: "",
    message: "",
    variant: "success",
  });
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
    fetchCurrentUserRole();
  }, []);

  async function fetchDonors() {
    try {
      const donorsRes = await fetch("/api/donors");
      if (!donorsRes.ok) {
        throw new Error("Failed to fetch donors");
      }
      const donorsData = await donorsRes.json();
      if (donorsData.donors) {
        setDonors(donorsData.donors);
      }
    } catch (error) {
      console.error("Error fetching donors:", error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchCurrentUserRole() {
    try {
      const authRes = await fetch("/api/auth/me", { cache: "no-store" });
      if (!authRes.ok) {
        return;
      }
      const authData = await authRes.json();
      setCurrentUserRole(authData.user?.role ?? null);
    } catch (error) {
      console.error("Error fetching current user role:", error);
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
    if (!confirm(t("site.are_you_sure_you_want_to_delete_this_donor"))) return;

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
    setSendingInvites((prev) => new Set(prev).add(donorId));
    try {
      const res = await fetch("/api/donor-portal/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ donorId }),
      });
      const data = await res.json();
      if (res.ok) {
        setPortalInviteFeedback({
          open: true,
          title: t("site.invite_sent"),
          message: t("site.donor_portal_invite_sent_message"),
          variant: "success",
        });
      } else {
        setPortalInviteFeedback({
          open: true,
          title: t("site.invite_failed"),
          message: data.error || t("site.failed_to_send_invite"),
          variant: "error",
        });
      }
    } catch (error) {
      console.error("Failed to send portal invite:", error);
      setPortalInviteFeedback({
        open: true,
        title: t("site.invite_failed"),
        message: t("site.failed_to_send_portal_invite"),
        variant: "error",
      });
    } finally {
      setSendingInvites((prev) => {
        const next = new Set(prev);
        next.delete(donorId);
        return next;
      });
    }
  }

  function formatGrantSize(amount: number | null) {
    if (amount == null) return t("site.not_specified");
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
  const canManageDonors =
    currentUserRole === "admin" || currentUserRole === "project_manager";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Leaf className="h-6 w-6 animate-pulse text-primary" />
          <p className="text-sm text-muted-foreground">{t("site.loading_donors")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10">
      <PortalInviteFeedbackDialog
        open={portalInviteFeedback.open}
        title={portalInviteFeedback.title}
        message={portalInviteFeedback.message}
        variant={portalInviteFeedback.variant}
        onOpenChange={(open) => setPortalInviteFeedback((prev) => ({ ...prev, open }))}
      />
      <header className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl lg:text-4xl text-foreground mb-2">
              {t("site.donor_directory")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("site.manage_donor_contacts_and_grant_opportunities")}
            </p>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={(open) => { setIsAddDialogOpen(open); if (!open) resetForm(); }}>
            {canManageDonors && (
              <DialogTrigger asChild>
                <Button className="rounded-xl shrink-0">
                  <Plus className="h-4 w-4 mr-2" /> {t("site.add_donor")}
                </Button>
              </DialogTrigger>
            )}
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-serif text-xl">
                  {editingDonor ? t("site.edit_donor") : t("site.add_new_donor")}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-5 mt-4">
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">{t("site.organization_name")}</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="type">{t("site.donor_type")}</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(value) => setFormData({ ...formData, type: value })}
                      required
                    >
                      <SelectTrigger className="rounded-xl">
                        <SelectValue placeholder={t("site.select_type")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="government">{t("site.government")}</SelectItem>
                        <SelectItem value="foundation">{t("site.foundation")}</SelectItem>
                        <SelectItem value="corporate">{t("site.corporate")}</SelectItem>
                        <SelectItem value="individual">{t("site.individual")}</SelectItem>
                        <SelectItem value="multilateral">{t("site.multilateral")}</SelectItem>
                        <SelectItem value="ngo">{t("site.ngo")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="contactPerson">{t("site.contact_person")}</Label>
                    <Input
                      id="contactPerson"
                      value={formData.contactPerson}
                      onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">{t("site.email")}</Label>
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
                    <Label htmlFor="phone">{t("site.phone")}</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="website">{t("site.website")}</Label>
                    <Input
                      id="website"
                      value={formData.website}
                      onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                      className="rounded-xl"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">{t("site.address")}</Label>
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
                    <Label htmlFor="grantTypes">{t("site.grant_types")}</Label>
                    <Input
                      id="grantTypes"
                      value={formData.grantTypes}
                      onChange={(e) => setFormData({ ...formData, grantTypes: e.target.value })}
                      placeholder={t("site.e_g_project_core_emergency")}
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="focusAreas">{t("site.focus_areas")}</Label>
                    <Input
                      id="focusAreas"
                      value={formData.focusAreas}
                      onChange={(e) => setFormData({ ...formData, focusAreas: e.target.value })}
                      placeholder={t("site.e_g_health_education")}
                      className="rounded-xl"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="averageGrantSize">{t("site.average_grant_size")}</Label>
                  <CurrencyInput
                    id="averageGrantSize"
                    value={formData.averageGrantSize}
                    onChange={(val) => setFormData({ ...formData, averageGrantSize: val })}
                    currency="ETB"
                    placeholder={t("site.e_g_500000")}
                  />
                </div>

                <div className="flex items-center gap-3 p-4 bg-muted/40 rounded-xl">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={formData.isActive}
                    aria-labelledby="active-status-label"
                    onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${formData.isActive ? "bg-primary" : "bg-border"}`}
                  >
                    <span className={`pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform ${formData.isActive ? "translate-x-5" : "translate-x-0"}`} />
                  </button>
                  <div>
                    <Label id="active-status-label" className="text-sm font-medium">
                      {formData.isActive ? t("site.active") : t("site.non_active")}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {formData.isActive ? t("site.donor_is_active_and_available_for_project_assignments") : t("site.donor_is_non_active_and_hidden_from_project_selections")}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">{t("site.notes")}</Label>
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
                    {t("site.cancel")}
                  </Button>
                  <Button type="submit" className="rounded-xl">
                    {editingDonor ? t("site.update") : t("site.create")} {t("site.donor")}
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
          <span className="text-xs text-muted-foreground">{t("site.total")}</span>
          <p className="font-serif text-lg text-foreground">{donors.length}</p>
        </div>
        <div className="px-4 py-2.5 bg-sage-pale rounded-xl">
          <span className="text-xs text-muted-foreground">{t("site.active")}</span>
          <p className="font-serif text-lg text-primary">{activeDonorCount}</p>
        </div>
        <div className="px-4 py-2.5 bg-rose-pale rounded-xl">
          <span className="text-xs text-muted-foreground">{t("site.inactive")}</span>
          <p className="font-serif text-lg text-rose-muted">{inactiveDonorCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-8">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("site.search_donors")}
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
            <SelectItem value="all">{t("site.all_status")}</SelectItem>
            <SelectItem value="active">{t("site.active")}</SelectItem>
            <SelectItem value="inactive">{t("site.inactive")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-40 rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("site.all_types")}</SelectItem>
            <SelectItem value="government">{t("site.government")}</SelectItem>
            <SelectItem value="foundation">{t("site.foundation")}</SelectItem>
            <SelectItem value="corporate">{t("site.corporate")}</SelectItem>
            <SelectItem value="individual">{t("site.individual")}</SelectItem>
            <SelectItem value="multilateral">{t("site.multilateral")}</SelectItem>
            <SelectItem value="ngo">{t("site.ngo")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Donor cards */}
      {filteredDonors.length === 0 ? (
        <div className="py-20 text-center">
          <Users className="h-10 w-10 mx-auto mb-3 text-primary/25" />
          <p className="text-sm text-muted-foreground mb-5">
            {searchQuery || filterType !== "all" || filterStatus !== "all"
              ? t("site.no_donors_match_your_filters")
              : t("site.no_donors_yet_add_your_first_one")}
          </p>
          {canManageDonors && !searchQuery && filterType === "all" && filterStatus === "all" && (
            <Button onClick={() => setIsAddDialogOpen(true)} className="rounded-xl">
              <Plus className="h-4 w-4 mr-2" /> {t("site.add_your_first_donor")}
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
                          {t(typeConf.label)}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          donor.isActive ? "bg-sage-pale text-primary" : "bg-muted text-muted-foreground"
                        }`}>
                          <span className={`h-1 w-1 rounded-full ${donor.isActive ? "bg-primary" : "bg-muted-foreground"}`} />
                          {donor.isActive ? t("site.active") : t("site.inactive")}
                        </span>
                      </div>
                    </div>
                  </div>
                  {canManageDonors && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground shrink-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog(donor)}>
                          <Edit className="h-4 w-4 mr-2" /> {t("site.edit")}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleActive(donor)}>
                          {donor.isActive ? (
                            <><PowerOff className="h-4 w-4 mr-2" /> {t("site.set_non_active")}</>
                          ) : (
                            <><Power className="h-4 w-4 mr-2" /> {t("site.set_active")}</>
                          )}
                        </DropdownMenuItem>
                        {donor.email && (
                          <DropdownMenuItem
                            onClick={() => handleSendPortalInvite(donor.id)}
                            disabled={sendingInvites.has(donor.id)}
                          >
                            <Send className="h-4 w-4 mr-2" />
                            {sendingInvites.has(donor.id) ? t("site.sending") : t("site.send_portal_invite")}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => handleDelete(donor.id)} className="text-destructive">
                          <Trash2 className="h-4 w-4 mr-2" /> {t("site.delete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>

                {/* Details */}
                <div className="space-y-2">
                  {donor.contactPerson && (
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">{t("site.contact")}</span> {donor.contactPerson}
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
                      {isSafeWebsiteUrl(donor.website) ? (
                        <a href={donor.website} target="_blank" rel="noopener noreferrer" className="hover:text-primary truncate transition-colors">
                          {donor.website}
                        </a>
                      ) : (
                        <span className="truncate">{donor.website}</span>
                      )}
                    </div>
                  )}
                  {donor.focusAreas && (
                    <p className="text-xs text-muted-foreground pt-1">
                      <span className="font-medium text-foreground">{t("site.focus")}</span> {donor.focusAreas}
                    </p>
                  )}
                  {donor.averageGrantSize && (
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{t("site.avg_grant")}</span> {formatGrantSize(donor.averageGrantSize)}
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
