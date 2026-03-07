import "server-only";
import PDFDocument from "pdfkit";
import {
  AlignmentType,
  Document,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import { db, proposals } from "@/db";
import { eq } from "drizzle-orm";

type ProposalSection = {
  key?: string;
  name?: string;
  label?: string;
};

export type TorExportData = {
  proposal: {
    id: string;
    title: string;
    status: string;
    proposalType: "grant" | "tor";
    description: string | null;
    notes: string | null;
    torCode: string | null;
    torSubmissionRef: string | null;
    amountRequested: number;
    amountApproved: number | null;
    currency: string;
    submissionDate: Date | null;
    decisionDate: Date | null;
    startDate: Date | null;
    endDate: Date | null;
    createdAt: Date;
  };
  donor: {
    name: string;
    type: string;
  } | null;
  project: {
    name: string;
  } | null;
  creator: {
    firstName: string;
    lastName: string;
    email: string;
  };
  template: {
    name: string;
    category: string | null;
    sections?: ProposalSection[];
  } | null;
  sections: Array<{
    key: string;
    label: string;
    value: string;
  }>;
  generatedAt: Date;
};

function formatDate(date: Date | null): string {
  if (!date) return "Not set";
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatCurrency(amount: number | null, currency: string): string {
  if (amount == null) return "Pending";
  return `${currency} ${amount.toLocaleString("en-US")}`;
}

function prettyKey(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function pdfToBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

function ensurePageSpace(doc: PDFKit.PDFDocument, minHeight = 80) {
  if (doc.y > doc.page.height - doc.page.margins.bottom - minHeight) {
    doc.addPage();
  }
}

export async function getTorExportData(proposalId: string): Promise<TorExportData | null> {
  const proposal = await db.query.proposals.findFirst({
    where: eq(proposals.id, proposalId),
    with: {
      donor: true,
      project: true,
      template: true,
      creator: {
        columns: { firstName: true, lastName: true, email: true },
      },
    },
  });

  if (!proposal || proposal.proposalType !== "tor") return null;

  const templateLabels = new Map<string, string>();
  const templateSections = (proposal.template?.sections as ProposalSection[] | null) || [];
  const templateData = (proposal.templateData || {}) as Record<string, string>;
  const usedKeys = new Set<string>();

  for (const section of templateSections) {
    const key = section.key || section.name;
    const label = section.label || section.name;
    if (key && label) templateLabels.set(key, label);
  }

  const sections = templateSections
    .map((section) => {
      const key = section.key || section.name;
      if (!key) return null;

      const value = templateData[key];
      if (typeof value !== "string" || value.trim().length === 0) return null;

      usedKeys.add(key);
      return {
        key,
        label: templateLabels.get(key) || prettyKey(key),
        value,
      };
    })
    .filter((section): section is { key: string; label: string; value: string } => section !== null)
    .concat(
      Object.entries(templateData)
    .filter(([, value]) => typeof value === "string" && value.trim().length > 0)
    .filter(([key]) => !usedKeys.has(key))
    .map(([key, value]) => ({
      key,
      label: templateLabels.get(key) || prettyKey(key),
      value,
    }))
    );

  return {
    proposal: {
      id: proposal.id,
      title: proposal.title,
      status: proposal.status,
      proposalType: proposal.proposalType,
      description: proposal.description,
      notes: proposal.notes,
      torCode: proposal.torCode,
      torSubmissionRef: proposal.torSubmissionRef,
      amountRequested: proposal.amountRequested,
      amountApproved: proposal.amountApproved,
      currency: proposal.currency,
      submissionDate: proposal.submissionDate,
      decisionDate: proposal.decisionDate,
      startDate: proposal.startDate,
      endDate: proposal.endDate,
      createdAt: proposal.createdAt,
    },
    donor: proposal.donor
      ? {
          name: proposal.donor.name,
          type: proposal.donor.type,
        }
      : null,
    project: proposal.project
      ? {
          name: proposal.project.name,
        }
      : null,
    creator: proposal.creator,
    template: proposal.template
      ? {
          name: proposal.template.name,
          category: proposal.template.category,
          sections: proposal.template.sections as ProposalSection[] | undefined,
        }
      : null,
    sections,
    generatedAt: new Date(),
  };
}

export async function renderTorPdf(data: TorExportData): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 50 });

  doc.font("Helvetica-Bold").fontSize(22).fillColor("#2A3328").text(data.proposal.title, {
    align: "left",
  });
  doc.moveDown(0.25);
  doc.font("Helvetica").fontSize(10).fillColor("#5B6757").text(
    `Terms of Reference export • Generated ${formatDate(data.generatedAt)}`,
  );
  doc.moveDown(0.6);
  doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke("#D8E0D2");
  doc.moveDown(0.8);

  const metaRows: Array<[string, string]> = [
    ["Status", data.proposal.status.replace(/_/g, " ")],
    ["Template", data.template?.name || "Not linked"],
    ["Donor", data.donor?.name || "Not linked"],
    ["Project", data.project?.name || "Standalone proposal"],
    ["Requested Amount", formatCurrency(data.proposal.amountRequested, data.proposal.currency)],
    ["Approved Amount", formatCurrency(data.proposal.amountApproved, data.proposal.currency)],
    ["Submission Date", formatDate(data.proposal.submissionDate)],
    ["Decision Date", formatDate(data.proposal.decisionDate)],
    ["ToR Code", data.proposal.torCode || "Not set"],
    ["Submission Ref", data.proposal.torSubmissionRef || "Not set"],
    ["Owner", `${data.creator.firstName} ${data.creator.lastName}`],
  ];

  doc.font("Helvetica-Bold").fontSize(14).fillColor("#2A3328").text("Document Summary");
  doc.moveDown(0.4);
  for (const [label, value] of metaRows) {
    ensurePageSpace(doc, 24);
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor("#2A3328")
      .text(`${label}: `, { continued: true })
      .font("Helvetica")
      .fillColor("#465143")
      .text(value);
  }

  if (data.proposal.description) {
    doc.moveDown(0.8);
    ensurePageSpace(doc, 80);
    doc.font("Helvetica-Bold").fontSize(14).fillColor("#2A3328").text("Overview");
    doc.moveDown(0.35);
    doc.font("Helvetica").fontSize(11).fillColor("#465143").text(data.proposal.description, {
      lineGap: 3,
    });
  }

  if (data.sections.length > 0) {
    doc.moveDown(0.8);
    doc.font("Helvetica-Bold").fontSize(14).fillColor("#2A3328").text("ToR Sections");
    for (const section of data.sections) {
      doc.moveDown(0.55);
      ensurePageSpace(doc, 110);
      doc.font("Helvetica-Bold").fontSize(12).fillColor("#2A3328").text(section.label);
      doc.moveDown(0.2);
      doc.font("Helvetica").fontSize(11).fillColor("#465143").text(section.value, {
        lineGap: 4,
      });
    }
  }

  if (data.proposal.notes) {
    doc.moveDown(0.8);
    ensurePageSpace(doc, 80);
    doc.font("Helvetica-Bold").fontSize(14).fillColor("#2A3328").text("Internal Notes");
    doc.moveDown(0.35);
    doc.font("Helvetica").fontSize(11).fillColor("#465143").text(data.proposal.notes, {
      lineGap: 3,
    });
  }

  return pdfToBuffer(doc);
}

export async function renderTorDocx(data: TorExportData): Promise<Buffer> {
  const infoRows = [
    ["Status", data.proposal.status.replace(/_/g, " ")],
    ["Template", data.template?.name || "Not linked"],
    ["Donor", data.donor?.name || "Not linked"],
    ["Project", data.project?.name || "Standalone proposal"],
    ["Requested Amount", formatCurrency(data.proposal.amountRequested, data.proposal.currency)],
    ["Approved Amount", formatCurrency(data.proposal.amountApproved, data.proposal.currency)],
    ["Submission Date", formatDate(data.proposal.submissionDate)],
    ["Decision Date", formatDate(data.proposal.decisionDate)],
    ["ToR Code", data.proposal.torCode || "Not set"],
    ["Submission Ref", data.proposal.torSubmissionRef || "Not set"],
    ["Owner", `${data.creator.firstName} ${data.creator.lastName} (${data.creator.email})`],
  ];

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: data.proposal.title,
                bold: true,
                color: "111111",
                size: 38,
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `Terms of Reference export | Generated ${formatDate(data.generatedAt)}`,
                color: "5B6757",
                italics: true,
                size: 26,
              }),
            ],
            spacing: { after: 280 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "Document Summary",
                bold: true,
                color: "2A3328",
                size: 28,
              }),
            ],
            spacing: { after: 140 },
          }),
          ...infoRows.map(
            ([label, value]) =>
              new Paragraph({
                spacing: { after: 90 },
                children: [
                  new TextRun({
                    text: `${label}: `,
                    bold: true,
                    color: "2A3328",
                    size: 22,
                  }),
                  new TextRun({
                    text: value,
                    color: "465143",
                    size: 22,
                  }),
                ],
              }),
          ),
          ...(data.proposal.description
            ? [
                new Paragraph({
                  spacing: { before: 320, after: 140 },
                  children: [
                    new TextRun({
                      text: "Overview",
                      bold: true,
                      color: "2A3328",
                      size: 28,
                    }),
                  ],
                }),
                ...data.proposal.description.split(/\n+/).map(
                  (line) =>
                    new Paragraph({
                      children: [new TextRun({ text: line, color: "465143", size: 22 })],
                      spacing: { after: 100 },
                    }),
                ),
              ]
            : []),
          ...(data.sections.length > 0
            ? [
                new Paragraph({
                  spacing: { before: 320, after: 140 },
                  children: [
                    new TextRun({
                      text: "ToR Sections",
                      bold: true,
                      color: "2A3328",
                      size: 28,
                    }),
                  ],
                }),
                ...data.sections.flatMap((section) => [
                  new Paragraph({
                    spacing: { before: 180, after: 100 },
                    children: [
                      new TextRun({
                        text: section.label,
                        bold: true,
                        color: "2A3328",
                        size: 24,
                      }),
                    ],
                  }),
                  ...section.value.split(/\n+/).map(
                    (line) =>
                      new Paragraph({
                        children: [new TextRun({ text: line, color: "465143", size: 22 })],
                        spacing: { after: 100 },
                      }),
                  ),
                ]),
              ]
            : []),
          ...(data.proposal.notes
            ? [
                new Paragraph({
                  spacing: { before: 320, after: 140 },
                  children: [
                    new TextRun({
                      text: "Internal Notes",
                      bold: true,
                      color: "2A3328",
                      size: 28,
                    }),
                  ],
                }),
                ...data.proposal.notes.split(/\n+/).map(
                  (line) =>
                    new Paragraph({
                      children: [new TextRun({ text: line, color: "465143", size: 22 })],
                      spacing: { after: 100 },
                    }),
                ),
              ]
            : []),
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { before: 320 },
            children: [
              new TextRun({
                text: `${data.creator.firstName} ${data.creator.lastName}`,
                italics: true,
                color: "5B6757",
                size: 20,
              }),
            ],
          }),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}
