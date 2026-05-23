import { Suspense } from "react";
import AdminDashboard from "@/components/AdminDashboard";

export default function Page() {
  return (
    <Suspense fallback={<AdminDashboardFallback />}>
      <AdminDashboard />
    </Suspense>
  );
}

function AdminDashboardFallback() {
  return (
    <div style={{ padding: "2rem", textAlign: "center", color: "#6B7280" }}>
      載入中...
    </div>
  );
}
