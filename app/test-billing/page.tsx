import { notFound } from "next/navigation";
import { BillingPanel } from "@/components/billing/billing-panel";

export default async function BillingBrowserHarness({
  searchParams,
}: {
  searchParams: Promise<{ billingPanel?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const { billingPanel } = await searchParams;
  return (
    <main>
      <BillingPanel kind={billingPanel === "coach" ? "coaching" : "individual"} />
    </main>
  );
}
