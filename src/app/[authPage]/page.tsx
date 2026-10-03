import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { AuthForm } from "@/components/auth-form";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ authPage: string }>;
}) {
  const { authPage } = await params;
  if (["account", "integrations"].includes(authPage))
    redirect("/dashboard/" + authPage);
  if (
    !["login", "signup", "forgot-password", "reset-password", "terms"].includes(
      authPage,
    )
  )
    notFound();
  if (authPage === "terms")
    return (
      <main className="legal">
        <h1>Application terms</h1>
        <p>
          Solara monitors energy systems. Demo data is simulated. Estimates are
          not utility bills. You are responsible for authorizing configuration
          changes to equipment you manage. Review device manufacturer guidance
          before changing physical settings.
        </p>
        <p>
          Your account stores profile information, device readings, alerts, and
          command audit history. Integration credentials are encrypted. You can
          export your data or delete your application account in Account
          settings. Disconnecting does not delete your DESSMonitor account.
        </p>
        <Link href="/signup">Back to registration</Link>
      </main>
    );
  if ((authPage === "login" || authPage === "signup") && (await currentUser()))
    redirect("/dashboard");
  return (
    <AuthForm
      page={authPage}
      demoEnabled={process.env.ENABLE_DEMO === "true"}
    />
  );
}
