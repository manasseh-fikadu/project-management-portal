"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserPlus, Shield, Users, Briefcase, Heart, Search, Leaf } from "lucide-react";

type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  department: string | null;
  isActive: boolean;
  createdAt: string;
};

type CurrentUser = {
  id: string;
  role: string;
};

const ROLE_CONFIG: Record<string, { label: string; bg: string; text: string; icon: React.ElementType }> = {
  admin: { label: "Admin", bg: "bg-rose-pale", text: "text-rose-muted", icon: Shield },
  project_manager: { label: "Project Manager", bg: "bg-sage-pale", text: "text-primary", icon: Briefcase },
  beneficiary: { label: "Beneficiary", bg: "bg-lavender-pale", text: "text-lavender", icon: Heart },
  donor: { label: "Donor", bg: "bg-amber-pale", text: "text-amber-warm", icon: Users },
};

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    role: "beneficiary",
    department: "",
  });

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      if (data.users) setUsers(data.users);
    } catch {
      // fail silently
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (!data.user || data.user.role !== "admin") {
          router.push("/dashboard");
          return;
        }
        setCurrentUser(data.user);
      });
    fetchUsers();
  }, [fetchUsers, router]);

  function resetForm() {
    setForm({ firstName: "", lastName: "", email: "", password: "", role: "beneficiary", department: "" });
    setError("");
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
          role: form.role,
          department: form.department.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create user");
        return;
      }

      setDialogOpen(false);
      resetForm();
      fetchUsers();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const filteredUsers = users.filter((user) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
    const roleLabel = ROLE_CONFIG[user.role]?.label.toLowerCase() ?? user.role.toLowerCase();
    return (
      fullName.includes(q) ||
      user.email.toLowerCase().includes(q) ||
      roleLabel.includes(q) ||
      user.role.toLowerCase().includes(q) ||
      (user.department?.toLowerCase().includes(q) ?? false)
    );
  });

  if (loading || !currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Leaf className="h-6 w-6 animate-pulse text-primary" />
          <p className="text-sm text-muted-foreground">Loading users…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10">
      <header className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl lg:text-4xl text-foreground mb-2">User Management</h1>
            <p className="text-sm text-muted-foreground">
              {users.length} user{users.length !== 1 ? "s" : ""} registered
            </p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="rounded-xl shrink-0">
                <UserPlus className="h-4 w-4 mr-2" />
                Create User
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="font-serif text-xl">Create New User</DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Add a new user to the system. They will be able to log in immediately.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateUser} className="space-y-5 mt-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      required
                      value={form.firstName}
                      onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                      placeholder="John"
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      required
                      value={form.lastName}
                      onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                      placeholder="Doe"
                      className="rounded-xl"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="john@example.com"
                    className="rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    minLength={6}
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    placeholder="Min. 6 characters"
                    className="rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select value={form.role} onValueChange={(value) => setForm((f) => ({ ...f, role: value }))}>
                    <SelectTrigger className="w-full rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="project_manager">Project Manager</SelectItem>
                      <SelectItem value="beneficiary">Beneficiary</SelectItem>
                      <SelectItem value="donor">Donor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="department">Department <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Input
                    id="department"
                    value={form.department}
                    onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                    placeholder="e.g. Engineering"
                    className="rounded-xl"
                  />
                </div>

                {error && (
                  <div className="rounded-xl bg-rose-pale px-4 py-3">
                    <p className="text-sm text-rose-muted">{error}</p>
                  </div>
                )}

                <DialogFooter>
                  <Button type="button" variant="ghost" onClick={() => { setDialogOpen(false); resetForm(); }}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting} className="rounded-xl">
                    {submitting ? "Creating…" : "Create User"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {/* Search */}
      <div className="relative mb-8 max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, role…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 rounded-xl bg-card"
        />
      </div>

      {/* Users list */}
      {filteredUsers.length === 0 ? (
        <div className="py-20 text-center">
          <Users className="h-10 w-10 mx-auto mb-3 text-primary/25" />
          <p className="text-sm text-muted-foreground">
            {searchQuery.trim() ? "No users match your search" : "No users found"}
          </p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-5 py-3.5 text-left font-medium text-xs uppercase tracking-wider text-muted-foreground">Name</th>
                  <th className="px-5 py-3.5 text-left font-medium text-xs uppercase tracking-wider text-muted-foreground">Email</th>
                  <th className="px-5 py-3.5 text-left font-medium text-xs uppercase tracking-wider text-muted-foreground">Role</th>
                  <th className="px-5 py-3.5 text-left font-medium text-xs uppercase tracking-wider text-muted-foreground">Department</th>
                  <th className="px-5 py-3.5 text-left font-medium text-xs uppercase tracking-wider text-muted-foreground">Status</th>
                  <th className="px-5 py-3.5 text-left font-medium text-xs uppercase tracking-wider text-muted-foreground">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredUsers.map((user) => {
                  const roleConfig = ROLE_CONFIG[user.role] || ROLE_CONFIG.beneficiary;
                  const RoleIcon = roleConfig.icon;
                  return (
                    <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3.5 font-medium text-foreground">
                        {user.firstName} {user.lastName}
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground">{user.email}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${roleConfig.bg} ${roleConfig.text}`}>
                          <RoleIcon className="h-3 w-3" />
                          {roleConfig.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground">{user.department || "—"}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                          user.isActive ? "bg-sage-pale text-primary" : "bg-muted text-muted-foreground"
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${user.isActive ? "bg-primary" : "bg-muted-foreground"}`} />
                          {user.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
