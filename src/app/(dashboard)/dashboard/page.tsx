"use client";

import { useRouter } from "next/navigation";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FolderKanban, Users, FileText, TrendingUp, HandCoins } from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();

  const quickActions = [
    {
      title: "Projects",
      description: "Manage your projects",
      icon: FolderKanban,
      href: "/projects",
      color: "bg-blue-100 text-blue-600",
    },
    {
      title: "Donors",
      description: "Manage donor contacts",
      icon: Users,
      href: "/donors",
      color: "bg-green-100 text-green-600",
    },
    {
      title: "Proposals",
      description: "Track grant proposals",
      icon: FileText,
      href: "/proposals",
      color: "bg-purple-100 text-purple-600",
    },
    {
      title: "New Project",
      description: "Create a new project",
      icon: TrendingUp,
      href: "/projects/new",
      color: "bg-orange-100 text-orange-600",
    },
    {
      title: "Financials",
      description: "Track budgets and disbursements",
      icon: HandCoins,
      href: "/financials",
      color: "bg-emerald-100 text-emerald-700",
    },
  ];

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome to the Project Management Portal
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5 mb-8">
        {quickActions.map((action) => (
          <Card
            key={action.href}
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => router.push(action.href)}
          >
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-lg ${action.color}`}>
                  <action.icon className="h-6 w-6" />
                </div>
                <div>
                  <CardTitle className="text-lg">{action.title}</CardTitle>
                  <CardDescription>{action.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Your recent actions and updates</CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Stats</CardTitle>
            <CardDescription>Overview of your portfolio</CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
