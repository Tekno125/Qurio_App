import Image from "next/image";
import Link from "next/link";
import { IconArrowLeft } from "@tabler/icons-react";
import { Card } from "@/components/ui/card";

export default function NotFound() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-6 py-12 text-foreground">
      <Card className="relative w-full max-w-xl border border-border bg-card px-7 py-10 text-center sm:px-12 sm:py-14">
        <Link
          href="/"
          aria-label="Qurio — kembali ke halaman utama"
          className="mx-auto flex w-fit items-center justify-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-500"
          draggable={false}
        >
          <Image
            src="/Qurio-Cropped.svg"
            alt="Qurio"
            width={112}
            height={54}
            draggable={false}
            priority
            className="h-12 w-auto"
          />
        </Link>

        <p className="m-0 text-7xl font-extrabold tracking-[-0.07em] text-brand-500 sm:text-8xl">
          404
        </p>
        <h1 className="text-balance text-2xl font-bold tracking-[-0.03em] sm:text-3xl">
          Halaman tidak ditemukan
        </h1>
        <p className="mx-auto max-w-sm text-pretty text-base leading-relaxed text-muted-foreground">
          Sepertinya tautan ini salah atau halaman yang kamu cari sudah
          dipindahkan.
        </p>

        <Link
          href="/"
          className="btn-primary min-h-12 w-full rounded-xl sm:w-auto"
        >
          <IconArrowLeft aria-hidden="true" className="size-4" />
          Kembali ke Beranda
        </Link>

        <p className="mt-3 text-sm text-muted-foreground">
          Butuh mulai lagi?{" "}
          <Link
            href="/"
            className="font-semibold text-brand-700 underline decoration-brand-200 underline-offset-4 transition-colors hover:text-brand-500"
          >
            Kunjungi halaman utama
          </Link>
        </p>
      </Card>
    </main>
  );
}
