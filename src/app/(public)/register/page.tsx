"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import Link from "next/link";
import { Boxes, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/components/i18n-provider";
import { cn } from "@/lib/utils";

const schema = z.object({
  companyName: z.string().min(2, "Company name is required"),
  industryType: z.string().min(2),
  materialName: z.string().min(1),
  unitOfMeasure: z.string().min(1),
  currency: z.string().min(2),
  timezone: z.string().min(2),
  ownerName: z.string().min(2),
  ownerEmail: z.string().email(),
  ownerPassword: z.string().min(8, "Min 8 characters"),
});
type FormValues = z.infer<typeof schema>;

export default function RegisterPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [step, setStep] = useState(1);
  const register = trpc.auth.register.useMutation();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      companyName: "",
      industryType: "Sand Mining",
      materialName: "Sand",
      unitOfMeasure: "Tons",
      currency: "INR",
      timezone: "Asia/Kolkata",
      ownerName: "",
      ownerEmail: "",
      ownerPassword: "",
    },
    mode: "onChange",
  });

  async function onSubmit(values: FormValues) {
    try {
      await register.mutateAsync(values);
      toast.success(t("toastAdded"));
      const res = await signIn("credentials", {
        email: values.ownerEmail,
        password: values.ownerPassword,
        redirect: false,
      });
      if (res?.ok) router.push("/");
      else router.push("/login");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to create workspace");
    }
  }

  const stepLabels = ["Company", "Material & locale", "Owner account"];

  return (
    <div className="w-full max-w-2xl">
      <div className="flex flex-col items-center gap-3 mb-6">
        <div className="size-12 rounded-2xl bg-gradient-to-br from-primary to-success grid place-items-center shadow-xl shadow-primary/30">
          <Boxes className="size-6 text-white" strokeWidth={2.5} />
        </div>
        <div className="text-center">
          <h1 className="text-xl font-semibold tracking-tight">
            Set up your ResourceFlow workspace
          </h1>
          <p className="text-sm text-muted-foreground">
            Step {step} of 3 · {stepLabels[step - 1]}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 mb-5">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={cn(
              "h-1.5 rounded-full transition-all",
              s === step ? "w-12 bg-primary" : s < step ? "w-8 bg-primary/60" : "w-8 bg-muted",
            )}
          />
        ))}
      </div>

      <Card className="shadow-lg">
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="p-6 sm:p-7 space-y-4">
            {step === 1 && (
              <>
                <div className="space-y-1.5">
                  <Label>Company name</Label>
                  <Input className="h-11" placeholder="Al Noor Sand Mining Co." {...form.register("companyName")} />
                  {form.formState.errors.companyName && (
                    <p className="text-xs text-destructive">{form.formState.errors.companyName.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Industry</Label>
                  <Input className="h-11" {...form.register("industryType")} />
                  <p className="text-xs text-muted-foreground">e.g. Sand Mining, Quarrying, Timber, Aggregates.</p>
                </div>
              </>
            )}
            {step === 2 && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Material name</Label>
                    <Input className="h-11" {...form.register("materialName")} />
                    <p className="text-xs text-muted-foreground">Used everywhere to describe what you sell.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Unit of measure</Label>
                    <Input className="h-11" {...form.register("unitOfMeasure")} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Currency</Label>
                    <Select value={form.watch("currency")} onValueChange={(v) => form.setValue("currency", v)}>
                      <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="INR">INR · ₹</SelectItem>
                        <SelectItem value="USD">USD · $</SelectItem>
                        <SelectItem value="EUR">EUR · €</SelectItem>
                        <SelectItem value="GBP">GBP · £</SelectItem>
                        <SelectItem value="AED">AED · د.إ</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Timezone</Label>
                    <Input className="h-11" {...form.register("timezone")} />
                  </div>
                </div>
              </>
            )}
            {step === 3 && (
              <>
                <div className="space-y-1.5">
                  <Label>Your name</Label>
                  <Input className="h-11" {...form.register("ownerName")} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("email")}</Label>
                  <Input type="email" inputMode="email" className="h-11" {...form.register("ownerEmail")} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("password")}</Label>
                  <Input type="password" className="h-11" {...form.register("ownerPassword")} />
                  <p className="text-xs text-muted-foreground">Minimum 8 characters.</p>
                  {form.formState.errors.ownerPassword && (
                    <p className="text-xs text-destructive">{form.formState.errors.ownerPassword.message}</p>
                  )}
                </div>
              </>
            )}
          </CardContent>
          <div className="flex items-center justify-between p-6 pt-0">
            <Button type="button" variant="outline" onClick={() => setStep(step - 1)} disabled={step === 1}>
              <ChevronLeft className="size-4 mr-1" />
              Back
            </Button>
            {step < 3 ? (
              <Button type="button" onClick={() => setStep(step + 1)}>
                Continue
                <ChevronRight className="size-4 ml-1" />
              </Button>
            ) : (
              <Button type="submit" disabled={register.isPending}>
                {register.isPending ? t("saving") : (<><Check className="size-4 mr-1" />Create workspace</>)}
              </Button>
            )}
          </div>
        </form>
      </Card>

      <p className="text-center text-sm text-muted-foreground mt-5">
        Already have an account?{" "}
        <Link href="/login" className="text-primary hover:underline">{t("signIn")}</Link>
      </p>
    </div>
  );
}
