import { ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/admin-ui";

export function OrdersManagementPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Orders" description="Orders are not available in the Super Admin panel." />
      <section className="admin-card flex min-h-64 flex-col items-center justify-center gap-3 p-8 text-center">
        <ClipboardList className="size-10 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm font-medium text-muted-foreground">No orders available</p>
      </section>
    </div>
  );
}
