"use client";
import { fetchUserRegister } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { IconEye, IconEyeOff } from "@tabler/icons-react";
import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";

// interface RegisterFormData {
//   name: string;
//   email: string;
//   password: string;
//   role: "guru" | "siswa";
// }

const formSchema = z.object({
  name: z.string().min(1, "Nama wajib diisi"),
  email: z
    .string()
    .email("Email tidak valid")
    .endsWith("gmail.com", "Isi input dengan format (gmail.com) "),
  password: z.string().min(8, "Password minimal 8 karakter"),
  role: z.literal("guru"),
});

type RegisterFormData = z.infer<typeof formSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const { login } = useAuth();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { role: "guru" },
  });

  const onSubmit = async (data: RegisterFormData) => {
    setFormError(null);
    const response = await fetchUserRegister(
      data.name,
      data.email,
      data.password,
      data.role,
    );

    if (!response.success) {
      if (response.message.toLowerCase().includes("email")) {
        setError("email", {
          type: "server",
          message: "Email ini sudah terdaftar. Silakan gunakan email lain.",
        });
      } else {
        setFormError(response.message);
      }
      return;
    }

    login(response.data.user);
    router.push("/dashboard");
  };

  return (
    <div className="relative flex flex-col flex-1 items-center justify-center bg-secondary/80 font-sans min-h-screen p-4">
      <Card className="max-w-120 w-full shadow-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-primary">
            Daftar Akun Guru
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            Buat akun guru untuk mengelola kelas interaktif Qurio
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
              <Label htmlFor="name" className="text-sm font-semibold text-foreground">
                Nama Lengkap
              </Label>
              <Input
                {...register("name", { required: "Nama wajib diisi" })}
                placeholder="Masukkan nama lengkap Anda"
                className="w-full h-11"
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? "name-error" : undefined}
              />
              {errors.name?.message && (
                <p id="name-error" className="mt-1 text-sm font-medium text-destructive" role="alert">
                  {errors.name.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email" className="text-sm font-semibold text-foreground">
                Email
              </Label>
              <Input
                {...register("email", {
                  required: "Email wajib diisi",
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: "Format email tidak valid",
                  },
                })}
                className="w-full h-11"
                placeholder="nama@gmail.com"
                type="email"
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
                    minLength: {
                      value: 8,
                      message: "Password minimal 8 karakter",
                    },
                  })}
                  className="h-11"
                  placeholder="Buat kata sandi minimal 8 karakter"
                  type={showPassword ? "text" : "password"}
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

            <Button type="submit" className="w-full mt-6 h-11" disabled={isSubmitting}>
              {isSubmitting ? "Mendaftar..." : "Daftar"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Sudah punya akun?{" "}
            <Link
              href="/login"
              className="font-semibold text-blue-600 hover:underline"
            >
              Masuk
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
