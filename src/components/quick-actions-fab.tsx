"use client";
import { useState } from "react";
import Link from "next/link";
import {
  Plus,
  Truck,
  Pickaxe,
  FileText,
  ShoppingCart,
  Receipt,
  Users,
  CreditCard,
  Boxes,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetBody,
} from "@/components/ui/sheet";
import { useI18n } from "@/components/i18n-provider";

type Action = {
  href: string;
  icon: any;
  label: string;
  hint?: string;
  perm?: string;
  color: string;
};

export function QuickActionsFab({ permissions }: { permissions: string[] }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  const has = (p?: string) =>
    !p || permissions.includes("*") || permissions.includes(p);

  const actions: Action[] = [
    { href: "/trips?new=1", icon: Truck, label: t("newTrip"), hint: "SCHEDULED → IN_TRANSIT → COMPLETED", perm: "trip.create", color: "bg-blue-500" },
    { href: "/extraction?new=1", icon: Pickaxe, label: t("newExtraction"), hint: "Logs against an active license", perm: "extraction.create", color: "bg-amber-500" },
    { href: "/trips?slip=1", icon: FileText, label: t("issueLoadingSlip"), hint: "Captures weight in/out", perm: "loadingSlip.create", color: "bg-emerald-500" },
    { href: "/sales-orders?new=1", icon: ShoppingCart, label: t("newSalesOrder"), perm: "salesOrder.create", color: "bg-violet-500" },
    { href: "/invoices?new=1", icon: Receipt, label: t("newInvoice"), perm: "invoice.create", color: "bg-rose-500" },
    { href: "/invoices?payment=1", icon: CreditCard, label: t("recordPayment"), perm: "payment.create", color: "bg-teal-500" },
    { href: "/procurement?new=1", icon: Boxes, label: t("newPurchaseOrder"), perm: "purchase.create", color: "bg-orange-500" },
    { href: "/customers?new=1", icon: Users, label: t("addCustomer"), perm: "customer.create", color: "bg-cyan-500" },
  ];

  const visible = actions.filter((a) => has(a.perm));
  if (!visible.length) return null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          aria-label={t("quickActions")}
          className="md:hidden fixed bottom-20 right-4 z-40 size-14 rounded-2xl bg-primary text-primary-foreground shadow-2xl shadow-primary/40 grid place-items-center active:scale-95 transition-transform"
        >
          <Plus className="size-6" strokeWidth={2.5} />
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85dvh] flex flex-col">
        <SheetHeader>
          <SheetTitle>{t("quickActions")}</SheetTitle>
        </SheetHeader>
        <SheetBody className="grid grid-cols-2 gap-3 pb-8">
          {visible.map((a) => {
            const Icon = a.icon;
            return (
              <Link
                key={a.href}
                href={a.href}
                onClick={() => setOpen(false)}
                className="flex flex-col gap-2 p-4 rounded-2xl border bg-card hover:bg-accent active:scale-[0.98] transition-all"
              >
                <div
                  className={`size-11 rounded-xl ${a.color} grid place-items-center text-white shadow-md`}
                >
                  <Icon className="size-5" strokeWidth={2.25} />
                </div>
                <div>
                  <div className="font-medium leading-tight">{a.label}</div>
                  {a.hint && (
                    <div className="text-[11px] text-muted-foreground mt-0.5 leading-tight">
                      {a.hint}
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
