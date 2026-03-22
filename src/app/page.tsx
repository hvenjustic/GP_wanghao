import { requirePermission } from "@/lib/auth/guards";
import { DashboardHome } from "@/features/dashboard/components/dashboard-home";

export default async function HomePage() {
  const currentUser = await requirePermission("dashboard:view", "/");

  return <DashboardHome currentUser={currentUser} />;
}
