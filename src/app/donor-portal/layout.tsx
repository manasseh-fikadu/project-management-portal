import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Donor Portal - MoTRI Project Management",
  description: "Read-only project monitoring portal for donors",
};

export default function DonorPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-3">
          <img src="/motri.png" alt="MoTRI" className="h-8 w-8" />
          <div>
            <h1 className="text-lg font-semibold text-gray-900">MoTRI Project Portal</h1>
            <p className="text-xs text-gray-500">Donor Project Monitoring</p>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-8">
        {children}
      </main>
      <footer className="border-t bg-white mt-12">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <p className="text-xs text-gray-400 text-center">
            Ministry of Trade and Regional Integration - Project Management Portal.
            This is a read-only view. For questions, contact the project administrator.
          </p>
        </div>
      </footer>
    </div>
  );
}
