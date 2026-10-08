import { Link } from "@/lib/router";
import { ArrowRight, Inventory2 } from "@mui/icons-material";
import { Button } from "@/components/ui/button";

export function PortalPage({ title, body, action = "/" }: { title: string; body: string; action?: "/" | "/products" | "/orders" }) {
  return (
    <main className="shell py-16">
      <div className="grid min-h-80 place-items-center border border-dashed bg-card p-8 text-center">
        <div className="max-w-md">
          <Inventory2 className="mx-auto size-10 text-muted-foreground" />
          <h1 className="mt-4 text-3xl font-extrabold text-ink">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
          <Button asChild className="mt-6">
            <Link to={action}>Continue shopping <ArrowRight /></Link>
          </Button>
        </div>
      </div>
    </main>
  );
}