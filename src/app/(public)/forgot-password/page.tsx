"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { trpc } from "@/lib/trpc";

const schema = z.object({ email: z.string().email() });

export default function ForgotPasswordPage() {
  const [done, setDone] = useState(false);
  const m = trpc.auth.forgotPassword.useMutation();
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { email: "" } });

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Reset your password</CardTitle>
        <CardDescription>
          {done ? "Check your inbox for the reset link." : "We'll send you a reset link."}
        </CardDescription>
      </CardHeader>
      {!done && (
        <form
          onSubmit={form.handleSubmit(async (v) => {
            await m.mutateAsync(v);
            setDone(true);
            toast.success("Check your email.");
          })}
        >
          <CardContent className="space-y-2">
            <Label>Email</Label>
            <Input type="email" {...form.register("email")} />
          </CardContent>
          <CardFooter className="flex justify-between">
            <Link href="/login" className="text-sm text-primary hover:underline">
              Back to sign in
            </Link>
            <Button type="submit" disabled={m.isPending}>
              {m.isPending ? "Sending…" : "Send reset link"}
            </Button>
          </CardFooter>
        </form>
      )}
    </Card>
  );
}
