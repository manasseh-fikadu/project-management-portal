export const platformPillars = [
  {
    title: "Portfolio visibility",
    description:
      "See active initiatives, delivery stages, responsible teams, and partner relationships in one operational view.",
  },
  {
    title: "Budget traceability",
    description:
      "Track planned budgets, utilization, disbursements, and execution gaps without assembling reports manually.",
  },
  {
    title: "Shared reporting",
    description:
      "Prepare consistent updates for ministry leadership, donors, and implementation partners from the same source of record.",
  },
] as const;

export const workflowSteps = [
  {
    step: "01",
    title: "Register projects and proposals",
    description:
      "Capture scope, timelines, donors, focal points, and supporting documents at the point of intake.",
  },
  {
    step: "02",
    title: "Monitor milestones and spend",
    description:
      "Follow implementation progress alongside expenditure and identify delivery gaps early.",
  },
  {
    step: "03",
    title: "Prepare partner-ready outputs",
    description:
      "Generate financial and project summaries in formats suitable for internal review and external reporting.",
  },
] as const;

export const audienceGroups = [
  {
    title: "Ministry teams",
    description:
      "Maintain an up-to-date operational picture across projects, tasks, budgets, and reporting cycles.",
  },
  {
    title: "Donors",
    description:
      "Review structured information on implementation status, financial use, and reporting readiness.",
  },
  {
    title: "Partners",
    description:
      "Coordinate around the same delivery records, timelines, and project documentation.",
  },
] as const;
