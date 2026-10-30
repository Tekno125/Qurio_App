"use client";
import { fetchUserLogin } from "@/lib/api";
import { useForm } from "react-hook-form";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { IconEye, IconEyeOff } from "@tabler/icons-react";
import { useAuth } from "@/context/AuthContext";
import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";

interface FormLogin {
  email: string;
  password: string;
}

function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { login, isAuthenticated, isAuthLoading } = useAuth();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormLogin>();

  useEffect(() => {
    if (!isAuthLoading && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, isAuthLoading, router]);

  const onSubmit = async (data: FormLogin) => {
    setFormError(null);
    const response = await fetchUserLogin(data.email, data.password);

    if (!response.success) {
      setFormError(response.message);
      return;
    }

    login(response.data.user);
    router.push("/dashboard");
  };

  const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  if (isAuthLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary/80 p-4 text-sm text-muted-foreground">
        Memeriksa sesi…
      </div>
    );
  }

  return (
    <div className="relative flex flex-col flex-1 items-center justify-center bg-secondary/80 font-sans min-h-screen p-4">
      <Card className="max-w-120 w-full shadow-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-primary">
            Masuk ke Akun
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            Selamat datang kembali di Qurio
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex flex-col gap-3"
            noValidate
          >
            {formError && (
              <p
                className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive dark:border-destructive/40 dark:bg-destructive/20"
                role="alert"
              >
                {formError}
              </p>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email" className="text-sm font-semibold text-foreground">
                Email
              </Label>
              <Input
                {...register("email", {
                  required: "Email wajib diisi",
                  pattern: {
                    value: emailPattern,
                    message: "Format email tidak valid",
                  },
                })}
                placeholder="nama@gmail.com"
                type="email"
                className="w-full h-11"
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? "email-error" : undefined}
              />
              {errors.email?.message && (
                <p id="email-error" className="mt-1 text-sm font-medium text-destructive" role="alert">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password" className="text-sm font-semibold text-foreground">
                Password
              </Label>
              <InputGroup className="w-full h-11">
                <InputGroupInput
                  {...register("password", {
                    required: "Password wajib diisi",
                  })}
                  placeholder="Masukkan kata sandi Anda"
                  type={showPassword ? "text" : "password"}
                  className="h-11"
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={errors.password ? "password-error" : undefined}
                />
                <InputGroupButton
                  type="button"
                  size="icon-sm"
                  aria-label={
                    showPassword ? "Sembunyikan password" : "Tampilkan password"
                  }
                  title={
                    showPassword ? "Sembunyikan password" : "Tampilkan password"
                  }
                  onClick={() => setShowPassword((visible) => !visible)}
                >
                  {showPassword ? <IconEyeOff /> : <IconEye />}
                </InputGroupButton>
              </InputGroup>
              {errors.password?.message && (
                <p id="password-error" className="mt-1 text-sm font-medium text-destructive" role="alert">
                  {errors.password.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full mt-6 h-11"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Mengirim..." : "Masuk"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Belum punya akun?{" "}
            <Link
              href="/register"
              className="font-semibold text-blue-600 hover:underline"
            >
              Daftar
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default LoginPage;
