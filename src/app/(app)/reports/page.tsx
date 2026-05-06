"use client";
import { useState } from "react";
import { startOfMonth, endOfMonth, subMonths } from "date-fns";
import { trpc } from "@/lib/trpc";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "@/components/data-table";
import { useI18n } from "@/components/i18n-provider";

export default function ReportsPage() {
  const { t, fmtDate } = useI18n();
  const [from] = useState(startOfMonth(subMonths(new Date(), 2)));
  const [to] = useState(endOfMonth(new Date()));
  return (
    <div className="px-4 sm:px-6 py-5 max-w-[1400px] mx-auto">
      <div className="mb-4">
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
          {t("reports")}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {t("reports_period")}: {fmtDate(from)} – {fmtDate(to)}
        </p>
      </div>
      <Tabs defaultValue="tonnage">
        <TabsList className="w-full overflow-x-auto justify-start sm:w-auto sm:justify-center scrollbar-thin">
          <TabsTrigger value="tonnage">{t("reports_tonnage")}</TabsTrigger>
          <TabsTrigger value="grades">{t("reports_grades")}</TabsTrigger>
          <TabsTrigger value="sales">{t("reports_sales")}</TabsTrigger>
          <TabsTrigger value="fleet">{t("reports_fleet")}</TabsTrigger>
          <TabsTrigger value="route">{t("reports_route")}</TabsTrigger>
          <TabsTrigger value="refinery">{t("reports_refinery")}</TabsTrigger>
          <TabsTrigger value="license">{t("reports_license")}</TabsTrigger>
          <TabsTrigger value="valuation">{t("reports_valuation")}</TabsTrigger>
          <TabsTrigger value="contractor">{t("reports_contractor")}</TabsTrigger>
        </TabsList>

        <TabsContent value="tonnage"><Tonnage from={from} to={to} /></TabsContent>
        <TabsContent value="grades"><Grades from={from} to={to} /></TabsContent>
        <TabsContent value="sales"><Sales from={from} to={to} /></TabsContent>
        <TabsContent value="fleet"><Fleet from={from} to={to} /></TabsContent>
        <TabsContent value="route"><Route from={from} to={to} /></TabsContent>
        <TabsContent value="refinery"><Refinery from={from} to={to} /></TabsContent>
        <TabsContent value="license"><License /></TabsContent>
        <TabsContent value="valuation"><Valuation /></TabsContent>
        <TabsContent value="contractor"><Contractor /></TabsContent>
      </Tabs>
    </div>
  );
}

function Tonnage({ from, to }: any) {
  const r = trpc.report.tonnageSummary.useQuery({ from, to, groupBy: "month" });
  return (
    <DataTable
      data={r.data ?? []}
      loading={r.isLoading}
      columns={[
        { key: "period", header: "Period" },
        { key: "in", header: "In", cell: (x: any) => x.in.toFixed(2) },
        { key: "out", header: "Out", cell: (x: any) => x.out.toFixed(2) },
        { key: "net", header: "Net", cell: (x: any) => (x.in - x.out).toFixed(2) },
      ]}
    />
  );
}
function Grades({ from, to }: any) {
  const r = trpc.report.gradeAnalysis.useQuery({ from, to });
  return (
    <DataTable
      data={r.data ?? []}
      loading={r.isLoading}
      columns={[
        { key: "name", header: "Grade" },
        { key: "byType", header: "Breakdown",
          cell: (x: any) => (x.byType ?? []).map((b: any) => `${b.type}:${b.qty.toFixed(1)}`).join(", "),
        },
      ]}
    />
  );
}
function Sales({ from, to }: any) {
  const r = trpc.report.sales.useQuery({ from, to });
  return (
    <DataTable
      data={r.data ?? []}
      loading={r.isLoading}
      columns={[
        { key: "name", header: "Customer" },
        { key: "invoices", header: "Invoices" },
        { key: "revenue", header: "Revenue", cell: (x: any) => `₹${(x.revenue/100).toLocaleString("en-IN")}` },
        { key: "outstanding", header: "Outstanding", cell: (x: any) => `₹${(x.outstanding/100).toLocaleString("en-IN")}` },
      ]}
    />
  );
}
function Fleet({ from, to }: any) {
  const r = trpc.report.fleet.useQuery({ from, to });
  return (
    <DataTable
      data={r.data ?? []}
      loading={r.isLoading}
      columns={[
        { key: "registrationNumber", header: "Vehicle" },
        { key: "trips", header: "Trips" },
        { key: "tonnage", header: "Tonnage", cell: (x: any) => x.tonnage.toFixed(2) },
        { key: "distance", header: "Km" },
        { key: "cost", header: "Cost", cell: (x: any) => `₹${(x.cost/100).toLocaleString("en-IN")}` },
      ]}
    />
  );
}
function Route({ from, to }: any) {
  const r = trpc.report.routeReport.useQuery({ from, to });
  return (
    <DataTable
      data={r.data ?? []}
      loading={r.isLoading}
      columns={[
        { key: "from", header: "From" },
        { key: "to", header: "To" },
        { key: "trips", header: "Trips" },
        { key: "tonnage", header: "Tonnage", cell: (x: any) => x.tonnage.toFixed(2) },
      ]}
    />
  );
}
function Refinery({ from, to }: any) {
  const r = trpc.report.refineryOutput.useQuery({ from, to });
  return (
    <DataTable
      data={r.data ?? []}
      loading={r.isLoading}
      columns={[
        { key: "refinery", header: "Refinery" },
        { key: "grade", header: "Grade" },
        { key: "input", header: "Input", cell: (x: any) => x.input.toFixed(2) },
        { key: "loss", header: "Loss", cell: (x: any) => x.loss.toFixed(2) },
        { key: "tonnage", header: "Output", cell: (x: any) => x.tonnage.toFixed(2) },
      ]}
    />
  );
}
function License() {
  const r = trpc.report.licenseUtilization.useQuery();
  return (
    <DataTable
      data={r.data ?? []}
      loading={r.isLoading}
      columns={[
        { key: "licenseNumber", header: "License #" },
        { key: "permittedTonnage", header: "Permitted", cell: (x: any) => x.permittedTonnage.toFixed(2) },
        { key: "usedTonnage", header: "Used", cell: (x: any) => x.usedTonnage.toFixed(2) },
        { key: "utilization", header: "Util %", cell: (x: any) => `${(x.utilization*100).toFixed(1)}%` },
        { key: "status", header: "Status" },
      ]}
    />
  );
}
function Valuation() {
  const r = trpc.report.inventoryValuation.useQuery();
  return (
    <DataTable
      data={r.data ?? []}
      loading={r.isLoading}
      columns={[
        { key: "grade", header: "Grade" },
        { key: "location", header: "Location" },
        { key: "quantity", header: "Qty", cell: (x: any) => Number(x.quantity).toFixed(2) },
        { key: "pricePerUnit", header: "Price", cell: (x: any) => `₹${((x.pricePerUnit ?? 0)/100).toFixed(2)}` },
        { key: "value", header: "Value", cell: (x: any) => `₹${(Number(x.value ?? 0)/100).toLocaleString("en-IN")}` },
      ]}
    />
  );
}
function Contractor() {
  const r = trpc.report.contractorSettlement.useQuery({});
  return (
    <DataTable
      data={r.data ?? []}
      loading={r.isLoading}
      columns={[
        { key: "contractorId", header: "Contractor", cell: (x: any) => x.contractorId?.name },
        { key: "period", header: "Period" },
        { key: "tripsCount", header: "Trips" },
        { key: "totalAmount", header: "Total", cell: (x: any) => `₹${((x.totalAmount ?? 0)/100).toLocaleString("en-IN")}` },
        { key: "paidAmount", header: "Paid", cell: (x: any) => `₹${((x.paidAmount ?? 0)/100).toLocaleString("en-IN")}` },
        { key: "status", header: "Status" },
      ]}
    />
  );
}
