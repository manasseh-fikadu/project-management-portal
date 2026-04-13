"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Edit, Leaf, Mail, Phone, Plus, Search, Trash2 } from "lucide-react";

const EDIT_ROLES = new Set(["admin", "project_manager"]);

type Vendor = {
  id: string;
  name: string;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  website: string | null;
  taxId: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankName: string | null;
  category: string | null;
  notes: string | null;
  isActive: boolean;
  requestCount: number;
  quotationCount: number;
  purchaseOrderCount: number;
  invoiceCount: number;
};

const EMPTY_FORM = {
  name: "",
  contactPerson: "",
  email: "",
  phone: "",
  address: "",
  website: "",
  taxId: "",
  bankAccountName: "",
  bankAccountNumber: "",
  bankName: "",
  category: "",
  notes: "",
  isActive: true,
};

export default function ProcurementVendorsPage() {
  const { t } = useTranslation();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);

  const canEdit = currentUserRole !== null && EDIT_ROLES.has(currentUserRole);

  useEffect(() => {
    void Promise.all([fetchVendors(), fetchCurrentUserRole()]);
  }, []);

  async function fetchVendors() {
    try {
      const res = await fetch("/api/vendors");
      const data = await res.json();
      setVendors(data.vendors || []);
    } catch (error) {
      console.error("Failed to fetch vendors:", error);
      setVendors([]);
    } finally {
      setLoading(false);
    }
  }

  async function fetchCurrentUserRole() {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const data = await res.json();
      setCurrentUserRole(data.user?.role ?? null);
    } catch (error) {
      console.error("Failed to fetch current user role:", error);
    }
  }

  function resetForm() {
    setEditingVendor(null);
    setFormData(EMPTY_FORM);
  }

  function openCreateDialog() {
    resetForm();
    setDialogOpen(true);
  }

  function openEditDialog(vendor: Vendor) {
    setEditingVendor(vendor);
    setFormData({
      name: vendor.name,
      contactPerson: vendor.contactPerson || "",
      email: vendor.email || "",
      phone: vendor.phone || "",
      address: vendor.address || "",
      website: vendor.website || "",
      taxId: vendor.taxId || "",
      bankAccountName: vendor.bankAccountName || "",
      bankAccountNumber: vendor.bankAccountNumber || "",
      bankName: vendor.bankName || "",
      category: vendor.category || "",
      notes: vendor.notes || "",
      isActive: vendor.isActive,
    });
    setDialogOpen(true);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);

    const payload = {
      ...formData,
      name: formData.name.trim(),
      contactPerson: formData.contactPerson.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim(),
      address: formData.address.trim(),
      website: formData.website.trim(),
      taxId: formData.taxId.trim(),
      bankAccountName: formData.bankAccountName.trim(),
      bankAccountNumber: formData.bankAccountNumber.trim(),
      bankName: formData.bankName.trim(),
      category: formData.category.trim(),
      notes: formData.notes.trim(),
    };

    try {
      const res = await fetch(editingVendor ? `/api/vendors/${editingVendor.id}` : "/api/vendors", {
        method: editingVendor ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save vendor");
      }

      if (editingVendor) {
        setVendors((prev) => prev.map((vendor) => (vendor.id === data.vendor.id ? data.vendor : vendor)));
      } else {
        setVendors((prev) => [data.vendor, ...prev]);
      }

      resetForm();
      setDialogOpen(false);
    } catch (error) {
      console.error("Failed to save vendor:", error);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(vendorId: string) {
    if (!confirm(t("site.are_you_sure_you_want_to_delete_this_vendor", { defaultValue: "Are you sure you want to delete this vendor?" }))) {
      return;
    }

    try {
      const res = await fetch(`/api/vendors/${vendorId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete vendor");
      }

      setVendors((prev) => prev.filter((vendor) => vendor.id !== vendorId));
    } catch (error) {
      console.error("Failed to delete vendor:", error);
    }
  }

  async function handleToggleStatus(vendor: Vendor) {
    try {
      const res = await fetch(`/api/vendors/${vendor.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !vendor.isActive }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update vendor");
      }

      setVendors((prev) => prev.map((entry) => (entry.id === data.vendor.id ? data.vendor : entry)));
    } catch (error) {
      console.error("Failed to update vendor status:", error);
    }
  }

  const filteredVendors = vendors.filter((vendor) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesQuery = !query || [
      vendor.name,
      vendor.contactPerson || "",
      vendor.email || "",
      vendor.phone || "",
      vendor.category || "",
    ].join(" ").toLowerCase().includes(query);

    const matchesStatus =
      statusFilter === "all"
        || (statusFilter === "active" && vendor.isActive)
        || (statusFilter === "inactive" && !vendor.isActive);

    return matchesQuery && matchesStatus;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Leaf className="h-6 w-6 animate-pulse text-primary" />
          <p className="text-sm text-muted-foreground">
            {t("site.loading_vendors", { defaultValue: "Loading vendors..." })}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10">
      <header className="mb-10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="font-serif text-3xl lg:text-4xl text-foreground mb-2">
              {t("site.vendor_directory", { defaultValue: "Vendor Directory" })}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("site.vendor_directory_description", {
                defaultValue: "Maintain supplier contacts and see which vendors are active in the procurement pipeline.",
              })}
            </p>
          </div>
          {canEdit && (
            <Button onClick={openCreateDialog} className="rounded-xl">
              <Plus className="mr-2 h-4 w-4" />
              {t("site.add_vendor", { defaultValue: "Add Vendor" })}
            </Button>
          )}
        </div>
      </header>

      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full max-w-xl">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={t("site.search_vendors", { defaultValue: "Search vendors" })}
            className="h-12 rounded-2xl border-border bg-card pl-10 shadow-sm"
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-11 min-w-[160px] rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("site.all_status", { defaultValue: "All status" })}</SelectItem>
              <SelectItem value="active">{t("site.active", { defaultValue: "Active" })}</SelectItem>
              <SelectItem value="inactive">{t("site.inactive", { defaultValue: "Inactive" })}</SelectItem>
            </SelectContent>
          </Select>

          <div className="rounded-full bg-sage-pale px-4 py-2 text-sm font-medium text-primary">
            {filteredVendors.length} {t("site.vendors", { defaultValue: "vendors" })}
          </div>
        </div>
      </div>

      {filteredVendors.length === 0 ? (
        <div className="py-20 text-center">
          <Building2 className="mx-auto mb-3 h-10 w-10 text-primary/25" />
          <p className="text-sm text-muted-foreground">
            {searchQuery.trim()
              ? t("site.no_vendors_match_your_search", { defaultValue: "No vendors match your search." })
              : t("site.no_vendors_have_been_added_yet", { defaultValue: "No vendors have been added yet." })}
          </p>
        </div>
      ) : (
        <div className="grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
          {filteredVendors.map((vendor) => (
            <Card key={vendor.id} className="rounded-[28px] border-border/60 shadow-[0_12px_30px_rgba(34,48,24,0.05)]">
              <CardHeader className="gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="font-serif text-2xl leading-tight">
                      {vendor.name}
                    </CardTitle>
                    <CardDescription>
                      {vendor.category || t("site.general_supplier", { defaultValue: "General supplier" })}
                    </CardDescription>
                  </div>
                  <Badge
                    className={vendor.isActive ? "bg-sage-pale text-primary" : "bg-muted text-muted-foreground"}
                  >
                    {vendor.isActive
                      ? t("site.active", { defaultValue: "Active" })
                      : t("site.inactive", { defaultValue: "Inactive" })}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-5">
                <div className="space-y-2 text-sm text-muted-foreground">
                  {vendor.contactPerson && (
                    <p>{vendor.contactPerson}</p>
                  )}
                  {vendor.email && (
                    <p className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5" />
                      <span className="truncate">{vendor.email}</span>
                    </p>
                  )}
                  {vendor.phone && (
                    <p className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5" />
                      <span>{vendor.phone}</span>
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 rounded-2xl bg-muted/35 p-4 text-sm">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground/70">
                      {t("site.requests", { defaultValue: "Requests" })}
                    </p>
                    <p className="mt-1 font-semibold text-foreground">{vendor.requestCount}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground/70">
                      {t("site.quotations", { defaultValue: "Quotations" })}
                    </p>
                    <p className="mt-1 font-semibold text-foreground">{vendor.quotationCount}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground/70">
                      {t("site.purchase_orders", { defaultValue: "Purchase Orders" })}
                    </p>
                    <p className="mt-1 font-semibold text-foreground">{vendor.purchaseOrderCount}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground/70">
                      {t("site.invoices", { defaultValue: "Invoices" })}
                    </p>
                    <p className="mt-1 font-semibold text-foreground">{vendor.invoiceCount}</p>
                  </div>
                </div>

                {vendor.notes && (
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {vendor.notes}
                  </p>
                )}

                {canEdit && (
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" className="rounded-xl" onClick={() => openEditDialog(vendor)}>
                      <Edit className="mr-2 h-4 w-4" />
                      {t("site.edit", { defaultValue: "Edit" })}
                    </Button>
                    <Button variant="outline" className="rounded-xl" onClick={() => handleToggleStatus(vendor)}>
                      {vendor.isActive
                        ? t("site.deactivate", { defaultValue: "Deactivate" })
                        : t("site.activate", { defaultValue: "Activate" })}
                    </Button>
                    <Button variant="outline" className="rounded-xl text-destructive" onClick={() => handleDelete(vendor.id)}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      {t("site.delete", { defaultValue: "Delete" })}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {editingVendor
                ? t("site.edit_vendor", { defaultValue: "Edit Vendor" })
                : t("site.add_vendor", { defaultValue: "Add Vendor" })}
            </DialogTitle>
            <DialogDescription>
              {t("site.vendor_profile_description", {
                defaultValue: "Capture the main supplier contacts, banking details, and notes used during procurement.",
              })}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="vendor-name">{t("site.name", { defaultValue: "Name" })}</Label>
                <Input
                  id="vendor-name"
                  value={formData.name}
                  onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="vendor-category">{t("site.category", { defaultValue: "Category" })}</Label>
                <Input
                  id="vendor-category"
                  value={formData.category}
                  onChange={(event) => setFormData((prev) => ({ ...prev, category: event.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="vendor-contact">{t("site.contact_person", { defaultValue: "Contact person" })}</Label>
                <Input
                  id="vendor-contact"
                  value={formData.contactPerson}
                  onChange={(event) => setFormData((prev) => ({ ...prev, contactPerson: event.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="vendor-email">{t("site.email", { defaultValue: "Email" })}</Label>
                <Input
                  id="vendor-email"
                  type="email"
                  value={formData.email}
                  onChange={(event) => setFormData((prev) => ({ ...prev, email: event.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="vendor-phone">{t("site.phone", { defaultValue: "Phone" })}</Label>
                <Input
                  id="vendor-phone"
                  value={formData.phone}
                  onChange={(event) => setFormData((prev) => ({ ...prev, phone: event.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="vendor-website">{t("site.website", { defaultValue: "Website" })}</Label>
                <Input
                  id="vendor-website"
                  value={formData.website}
                  onChange={(event) => setFormData((prev) => ({ ...prev, website: event.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="vendor-tax-id">{t("site.tax_id", { defaultValue: "Tax ID" })}</Label>
                <Input
                  id="vendor-tax-id"
                  value={formData.taxId}
                  onChange={(event) => setFormData((prev) => ({ ...prev, taxId: event.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="vendor-bank-name">{t("site.bank_name", { defaultValue: "Bank name" })}</Label>
                <Input
                  id="vendor-bank-name"
                  value={formData.bankName}
                  onChange={(event) => setFormData((prev) => ({ ...prev, bankName: event.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="vendor-account-name">{t("site.bank_account_name", { defaultValue: "Bank account name" })}</Label>
                <Input
                  id="vendor-account-name"
                  value={formData.bankAccountName}
                  onChange={(event) => setFormData((prev) => ({ ...prev, bankAccountName: event.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="vendor-account-number">{t("site.bank_account_number", { defaultValue: "Bank account number" })}</Label>
                <Input
                  id="vendor-account-number"
                  value={formData.bankAccountNumber}
                  onChange={(event) => setFormData((prev) => ({ ...prev, bankAccountNumber: event.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="vendor-address">{t("site.address", { defaultValue: "Address" })}</Label>
              <Textarea
                id="vendor-address"
                value={formData.address}
                onChange={(event) => setFormData((prev) => ({ ...prev, address: event.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vendor-notes">{t("site.notes", { defaultValue: "Notes" })}</Label>
              <Textarea
                id="vendor-notes"
                value={formData.notes}
                onChange={(event) => setFormData((prev) => ({ ...prev, notes: event.target.value }))}
              />
            </div>

            <button
              type="button"
              onClick={() => setFormData((prev) => ({ ...prev, isActive: !prev.isActive }))}
              className={`rounded-xl border px-4 py-2 text-sm font-medium ${
                formData.isActive
                  ? "border-primary/20 bg-sage-pale text-primary"
                  : "border-border bg-muted text-muted-foreground"
              }`}
            >
              {formData.isActive
                ? t("site.vendor_is_active", { defaultValue: "Vendor is active" })
                : t("site.vendor_is_inactive", { defaultValue: "Vendor is inactive" })}
            </button>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                {t("site.cancel", { defaultValue: "Cancel" })}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving
                  ? t("site.saving", { defaultValue: "Saving..." })
                  : editingVendor
                    ? t("site.save_changes", { defaultValue: "Save Changes" })
                    : t("site.add_vendor", { defaultValue: "Add Vendor" })}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
