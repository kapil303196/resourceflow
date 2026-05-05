"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";

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
      toast.success("Workspace created — signing you in…");
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

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="text-2xl">Create your ResourceFlow workspace</CardTitle>
        <CardDescription>Step {step} of 3</CardDescription>
      </CardHeader>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          {step === 1 && (
            <>
              <div className="space-y-2">
                <Label>Company name</Label>
                <Input {...form.register("companyName")} />
              </div>
              <div className="space-y-2">
                <Label>Industry</Label>
                <Input {...form.register("industryType")} />
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Material name</Label>
                  <Input {...form.register("materialName")} />
                  <p className="text-xs text-muted-foreground">e.g. Sand, Granite, Timber</p>
                </div>
                <div className="space-y-2">
                  <Label>Unit of measure</Label>
                  <Input {...form.register("unitOfMeasure")} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Select
                    value={form.watch("currency")}
                    onValueChange={(v) => form.setValue("currency", v)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INR">INR</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                      <SelectItem value="AED">AED</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Timezone</Label>
                  <Input {...form.register("timezone")} />
                </div>
              </div>
            </>
          )}
          {step === 3 && (
            <>
              <div className="space-y-2">
                <Label>Your name</Label>
                <Input {...form.register("ownerName")} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" {...form.register("ownerEmail")} />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input type="password" {...form.register("ownerPassword")} />
                {form.formState.errors.ownerPassword && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.ownerPassword.message}
                  </p>
                )}
              </div>
            </>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          <div>
            {step > 1 && (
              <Button type="button" variant="outline" onClick={() => setStep(step - 1)}>
                Back
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {step < 3 ? (
              <Button type="button" onClick={() => setStep(step + 1)}>
                Next
              </Button>
            ) : (
              <Button type="submit" disabled={register.isPending}>
                {register.isPending ? "Creating…" : "Create workspace"}
              </Button>
            )}
          </div>
        </CardFooter>
      </form>
      <div className="px-6 pb-6 text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="text-primary hover:underline">
          Sign in
        </Link>
      </div>
    </Card>
  );
}
