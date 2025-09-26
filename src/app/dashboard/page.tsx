// app/page.tsx or components/PortfolioDisplay.tsx

import { PortfolioTable } from "@/components/PortfolioTable";

export default function PortfolioPage() {
  return (
    <main className="container mx-auto p-8">
      {/* NOTE: Ensure the user is logged in here. 
        The PortfolioTable handles the Supabase auth check internally.
      */}
      <PortfolioTable />
    </main>
  );
}