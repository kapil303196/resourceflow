"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import Link from "next/link";
import { Boxes, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useI18n } from "@/components/i18n-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const { t, locale, setLocale } = useI18n();
  const [submitting, setSubmitting] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    const res = await signIn("credentials", {
      email: values.email,
      password: values.password,
      redirect: false,
    });
    setSubmitting(false);
    if (res?.error) {
      toast.error("Invalid credentials.");
      return;
    }
    toast.success(t("toastSaved"));
    router.push("/");
    router.refresh();
  }

  return (
    <div className="w-full max-w-md">
      {/* Brand */}
      <div className="flex flex-col items-center gap-3 mb-6">
        <div className="size-14 rounded-2xl bg-gradient-to-br from-primary to-success grid place-items-center shadow-xl shadow-primary/30">
          <Boxes className="size-7 text-white" strokeWidth={2.5} />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">ResourceFlow</h1>
          <p className="text-sm text-muted-foreground">
            {t("appName")} · {t("dashboard")}
          </p>
        </div>
      </div>

      <Card className="shadow-lg">
        <CardContent className="p-6 sm:p-7">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">{t("email")}</Label>
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="owner@example.com"
                className="h-11"
                {...form.register("email")}
              />
              {form.formState.errors.email && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">{t("password")}</Label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-primary hover:underline"
                >
                  {t("forgotPassword")}
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPwd ? "text" : "password"}
                  autoComplete="current-password"
                  className="h-11 pr-10"
                  {...form.register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 size-7 grid place-items-center text-muted-foreground hover:text-foreground"
                  aria-label={showPwd ? "Hide password" : "Show password"}
                >
                  {showPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            <Button
              type="submit"
              className="w-full h-11 mt-2"
              disabled={submitting}
            >
              {submitting ? t("signingIn") : t("signIn")}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="mt-5 flex items-center justify-between text-sm">
        <Link href="/register" className="text-primary hover:underline">
          {t("createAccount")}
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="text-muted-foreground hover:text-foreground">
              {locale === "en" ? "English" : locale === "hi" ? "हिन्दी" : "ગુજરાતી"}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setLocale("en")}>English</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setLocale("hi")}>हिन्दी</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setLocale("gu")}>ગુજરાતી</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Demo credentials hint */}
      <Card className="mt-5 border-dashed bg-muted/30">
        <CardContent className="p-4 text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">Demo accounts</p>
          <p>owner@demo.com · manager@demo.com · operator@demo.com</p>
          <p className="font-mono">password: demo1234</p>
        </CardContent>
      </Card>
    </div>
  );
}
