"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle, ArrowLeft, Loader2 } from "lucide-react";
import { AuthCard, AuthError, AuthShell } from "@/components/auth/auth-shell";

export default function ForgotPasswordPage() {
  const t = useTranslations("ForgotPasswordPage");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const supabase = createClient();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  };

  if (success) {
    return (
      <AuthShell>
        <AuthCard
          title={t("checkEmailTitle")}
          description={t.rich("checkEmailDesc", {
            email,
            strong: (chunks) => (
              <span className="font-medium text-foreground">{chunks}</span>
            ),
          })}
        >
          <div className="flex flex-col items-start gap-5">
            <span className="flex size-10 items-center justify-center rounded-full border border-success/25 bg-success/10 text-success">
              <CheckCircle className="size-5" />
            </span>
            <Button variant="outline" className="w-full" nativeButton={false} render={<Link href="/login" />}>
              {t("backToSignIn")}
            </Button>
          </div>
        </AuthCard>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <AuthCard
        title={t("title")}
        description={t("desc")}
        footer={
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            {t("backToSignIn")}
          </Link>
        }
      >
        <form onSubmit={handleReset} className="flex flex-col gap-4">
          {error && <AuthError>{error}</AuthError>}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">{t("emailLabel")}</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              placeholder={t("emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-9"
            />
          </div>

          <Button type="submit" size="lg" disabled={loading} className="mt-1 w-full">
            {loading && <Loader2 className="animate-spin" />}
            {loading ? t("sending") : t("sendLink")}
          </Button>
        </form>
      </AuthCard>
    </AuthShell>
  );
}
