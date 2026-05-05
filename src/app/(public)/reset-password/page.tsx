"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
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
import { trpc } from "@/lib/trpc";

const schema = z.object({ newPassword: z.string().min(8) });

export default function ResetPasswordPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const token = sp.get("token") ?? "";
  const m = trpc.auth.resetPassword.useMutation();
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { newPassword: "" } });

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Set a new password</CardTitle>
        <CardDescription>Enter a strong password (min 8 chars).</CardDescription>
      </CardHeader>
      <form
        onSubmit={form.handleSubmit(async (v) => {
          try {
            await m.mutateAsync({ token, newPassword: v.newPassword });
            toast.success("Password reset.");
            router.push("/login");
          } catch (e: any) {
            toast.error(e.message ?? "Reset failed");
          }
        })}
      >
        <CardContent className="space-y-2">
          <Label>New password</Label>
          <Input type="password" {...form.register("newPassword")} />
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button type="submit" disabled={m.isPending || !token}>
            Reset password
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
