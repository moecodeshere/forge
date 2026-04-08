"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getBrowserSupabaseClient } from "@/lib/supabase";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type LoginValues = z.infer<typeof loginSchema>;

type AuthMode = "login" | "register";

interface AuthFormProps {
  mode: AuthMode;
}

const authConfig = {
  login: {
    title: "Welcome back",
    description: "Sign in to continue building AI workflows.",
    submitLabel: "Sign in",
    alternateText: "Need an account?",
    alternateHref: "/register",
    alternateLabel: "Create one",
  },
  register: {
    title: "Create your account",
    description: "Start building and deploying MCP-first workflows.",
    submitLabel: "Create account",
    alternateText: "Already have an account?",
    alternateHref: "/login",
    alternateLabel: "Sign in",
  },
} as const;

function AuthFormInner({ mode }: AuthFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") ?? "/dashboard";
  const resetSuccess = searchParams.get("reset") === "success";
  const content = authConfig[mode];

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginValues) {
    setError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    const client = getBrowserSupabaseClient();
    if (mode === "login") {
      const { error: signInError } = await client.auth.signInWithPassword(values);
      setIsSubmitting(false);

      if (signInError) {
        setError(signInError.message);
        return;
      }
      router.push(nextPath);
      router.refresh();
      return;
    }

    const emailRedirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/login`
        : undefined;
    const { error: signUpError } = await client.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        emailRedirectTo,
      },
    });
    setIsSubmitting(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    setSuccessMessage(
      "Account created. Check your email to confirm your account, then sign in.",
    );
  }

  async function loginWithGithub() {
    setError(null);
    const redirectTo =
      typeof window !== "undefined" ? `${window.location.origin}/dashboard` : undefined;

    const { error: oauthError } = await getBrowserSupabaseClient().auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo },
    });
    if (oauthError) {
      setError(oauthError.message);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-2">
        <CardTitle>{content.title}</CardTitle>
        <CardDescription>{content.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              {...form.register("email")}
            />
            {form.formState.errors.email && (
              <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              placeholder="********"
              {...form.register("password")}
            />
            {form.formState.errors.password && (
              <p className="text-sm text-destructive">
                {form.formState.errors.password.message}
              </p>
            )}
            {mode === "login" && (
              <Link
                href="/forgot-password"
                className="mt-1 block text-xs text-muted-foreground hover:underline"
              >
                Forgot password?
              </Link>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {successMessage && <p className="text-sm text-green-600">{successMessage}</p>}
          {mode === "login" && resetSuccess && (
            <p className="text-sm text-green-600">
              Password reset complete. Sign in with your new password.
            </p>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Please wait..." : content.submitLabel}
          </Button>
        </form>

        <div className="mt-4">
          <Button type="button" variant="outline" className="w-full" onClick={loginWithGithub}>
            Continue with GitHub
          </Button>
        </div>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          {content.alternateText}{" "}
          <Link className="font-medium text-foreground underline-offset-4 hover:underline" href={content.alternateHref}>
            {content.alternateLabel}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

export function AuthForm(props: AuthFormProps) {
  return (
    <Suspense
      fallback={
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="h-7 w-48 animate-pulse rounded bg-muted" />
            <CardDescription className="h-4 w-full animate-pulse rounded bg-muted" />
          </CardHeader>
        </Card>
      }
    >
      <AuthFormInner {...props} />
    </Suspense>
  );
}
