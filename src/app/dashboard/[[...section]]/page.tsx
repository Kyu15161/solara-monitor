import { redirect, notFound } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { dashboardData, type DashboardData } from "@/lib/data";
import { Dashboard } from "@/components/dashboard/dashboard";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ section?: string[] }>;
  searchParams: Promise<{ device?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const section = (await params).section?.[0] ?? "overview";
  if (
    ![
      "overview",
      "live",
      "analytics",
      "energy",
      "battery",
      "grid",
      "inverter",
      "alerts",
      "controls",
      "history",
      "devices",
      "account",
      "settings",
      "integrations",
      "monitor",
    ].includes(section)
  )
    notFound();
  const data = await dashboardData(user.id, (await searchParams).device);
  return (
    <Dashboard
      initial={JSON.parse(JSON.stringify(data)) as DashboardData}
      section={section}
      liveEnabled={process.env.DESSMONITOR_MODE === "live"}
    />
  );
}
