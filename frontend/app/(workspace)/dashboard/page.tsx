"use client";

import { useEffect, useState } from "react";
import {
  IconChevronDown,
  IconDotsVertical,
  IconSearch,
  IconX,
} from "@tabler/icons-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/CopyButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getSessionList, type SessionListItem } from "@/lib/api";
import smartSearch from "@/lib/smart-search";

// Format tanggal dari API menggunakan lokal Indonesia.
function formatDate(value: string | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

// Tentukan label tombol berdasarkan jumlah dan jenis status yang dipilih.
function getStatusFilterLabel(statusFilters: SessionListItem["status"][]) {
  if (statusFilters.length === 0) return "Semua status";
  if (statusFilters.length > 1) return `${statusFilters.length} status dipilih`;

  switch (statusFilters[0]) {
    case "active":
      return "Aktif";
    case "ended":
      return "Selesai";
    default:
      return "Semua status";
  }
}

function DashboardPage() {
  // State untuk data sesi, pencarian, filter status, dan kondisi pemuatan.
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [statusFilters, setStatusFilters] = useState<
    SessionListItem["status"][]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Tunda pencarian agar pemrosesan tidak berjalan pada setiap ketikan.
  useEffect(() => {
    const debounceTimer = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);

    return () => window.clearTimeout(debounceTimer);
  }, [searchQuery]);

  // Muat sesi pengguna sekali saat halaman dashboard dibuka.
  useEffect(() => {
    let isMounted = true;

    getSessionList()
      .then((sessionList) => {
        if (isMounted) setSessions(sessionList);
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setErrorMessage(
            error instanceof Error ? error.message : "Sesi gagal dimuat",
          );
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Hitung ringkasan jumlah seluruh sesi dan sesi yang masih aktif.
  const overviewItems = [
    {
      label: "Total Sesi",
      value: String(sessions.length),
      detail: "Semua sesi milik Anda",
    },
    {
      label: "Sesi Aktif",
      value: String(
        sessions.filter((session) => session.status === "active").length,
      ),
      detail: "Sedang berlangsung",
    },
  ];

  // Terapkan pencarian fuzzy pada judul sesi dan statusnya.
  const searchedSessions = debouncedSearchQuery.trim()
    ? smartSearch(
      sessions,
      debouncedSearchQuery,
      (session) => `${session.title} ${session.status}`,
    )
      .filter((result) => result.matchedWords > 0)
      .map((result) => result.item)
    : sessions;

  // Kosong berarti semua status; beberapa pilihan harus cocok sekaligus.
  const visibleSessions = searchedSessions.filter(
    (session) =>
      statusFilters.length === 0 ||
      statusFilters.every((status) => session.status === status),
  );

  const statusFilterLabel = getStatusFilterLabel(statusFilters);

  // Siapkan teks tombol filter sesuai pilihan status saat ini.
  return (
    <section className="mx-auto w-full max-w-[1180px] p-6 lg:p-8">
      <header>
        <h1 className="text-2xl font-bold tracking-[-0.5px] text-foreground">
          {/* Judul dan deskripsi halaman dashboard. */}
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ringkasan aktivitas kelas dan performa siswa Qurio Anda
        </p>
      </header>

      {/* Kartu ringkasan aktivitas sesi. */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {overviewItems.map(({ label, value, detail }) => (
          <Card
            key={label}
            className="rounded-[20px] border-border py-0 shadow-[0_8px_24px_rgb(15_23_42/0.05)] dark:shadow-none"
          >
            <CardHeader className="p-5 pb-0">
              <CardTitle className="text-[13px] font-medium text-muted-foreground">
                {label}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 pt-2">
              <p className="text-[28px] font-bold tracking-tight text-foreground">
                {value}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">{detail}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Panel aktivitas berisi pencarian, filter, dan daftar sesi. */}
      <Card className="mt-6 rounded-[20px] border-border py-0 shadow-[0_8px_24px_rgb(15_23_42/0.05)] dark:shadow-none">
        <CardContent className="p-5 sm:p-6">
          <h2 className="text-base font-semibold text-foreground">
            Aktivitas Sesi Terbaru
          </h2>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            {/* Input pencarian dengan tombol untuk menghapus kata kunci. */}
            <div className="relative flex-1">
              <IconSearch className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-11 rounded-full border-0 bg-muted pl-10 shadow-none"
                placeholder="Cari sesi..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
              {searchQuery && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground"
                  aria-label="Hapus pencarian"
                  title="Hapus pencarian"
                  onClick={() => {
                    setSearchQuery("");
                    setDebouncedSearchQuery("");
                  }}
                >
                  <IconX className="size-4" />
                </Button>
              )}
            </div>

            {/* Menu checkbox untuk memilih status yang ditampilkan. */}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="outline"
                    className="h-10 justify-between border-border px-4 text-muted-foreground sm:w-[200px]"
                  >
                    {statusFilterLabel}
                    <IconChevronDown className="size-4" />
                  </Button>
                }
              />
              <DropdownMenuContent align="start">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Status sesi</DropdownMenuLabel>
                  {/* Buat satu opsi checkbox untuk setiap status sesi. */}
                  {(
                    [
                      ["active", "Aktif"],
                      ["ended", "Selesai"],
                    ] as const
                  ).map(([status, label]) => (
                    <DropdownMenuCheckboxItem
                      key={status}
                      checked={statusFilters.includes(status)}
                      onCheckedChange={(checked) =>
                        setStatusFilters((current) =>
                          checked
                            ? [...current, status]
                            : current.filter((item) => item !== status),
                        )
                      }
                    >
                      {label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Tabel utama yang menampilkan daftar sesi hasil filter. */}
          <div className="mt-4 overflow-hidden rounded-md border border-border">
            <Table className="min-w-[760px] text-left">
              <TableHeader className="bg-muted text-muted-foreground">
                <TableRow className="hover:bg-transparent font-bold">
                  <TableHead className="px-4 py-3 font-semibold">
                    Nama sesi
                  </TableHead>
                  <TableHead className="px-4 py-3 font-semibold">
                    Kode akses
                  </TableHead>
                  <TableHead className="px-4 py-3 font-semibold">
                    Dibuat
                  </TableHead>
                  <TableHead className="px-4 py-3 font-semibold">
                    Berakhir
                  </TableHead>
                  <TableHead className="px-4 py-3 font-semibold">
                    Status
                  </TableHead>
                  <TableHead className="px-4 py-3 font-semibold" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Tampilkan indikator saat data sesi sedang dimuat. */}
                {isLoading && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="h-24 text-center text-muted-foreground"
                    >
                      Memuat sesi...
                    </TableCell>
                  </TableRow>
                )}

                {/* Tampilkan pesan jika permintaan daftar sesi gagal. */}
                {!isLoading && errorMessage && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="h-24 text-center text-destructive"
                    >
                      {errorMessage}
                    </TableCell>
                  </TableRow>
                )}

                {/* Beri umpan balik saat filter tidak menghasilkan sesi. */}
                {!isLoading &&
                  !errorMessage &&
                  visibleSessions.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="h-24 text-center text-muted-foreground"
                      >
                        {debouncedSearchQuery.trim()
                          ? "Sesi tidak ditemukan."
                          : statusFilters.length > 1
                            ? "Tidak ada sesi yang cocok dengan semua status terpilih."
                            : "Belum ada sesi."}
                      </TableCell>
                    </TableRow>
                  )}

                {/* Render baris untuk setiap sesi yang lolos pencarian dan filter. */}
                {!isLoading &&
                  !errorMessage &&
                  visibleSessions.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell className="px-4 py-3.5 font-medium text-foreground">
                        <Link
                          href={`/dashboard/session/${session.id}`}
                          className="transition-colors hover:text-primary hover:underline"
                        >
                          {session.title}
                        </Link>
                      </TableCell>
                      <TableCell className="px-4 py-3.5">
                        <span className="font-semibold text-foreground">
                          {session.access_code}
                        </span>
                        <CopyButton
                          text={session.access_code}
                          label="kode akses"
                          className="ml-2"
                        />
                      </TableCell>
                      <TableCell className="px-4 py-3.5 text-muted-foreground">
                        {formatDate(session.created_at)}
                      </TableCell>
                      <TableCell className="px-4 py-3.5 text-muted-foreground">
                        {formatDate(session.ended_at)}
                      </TableCell>
                      <TableCell className="px-4 py-3.5">
                        <span
                          className={
                            session.status === "active"
                              ? "rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400"
                              : "rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground"
                          }
                        >
                          {session.status === "active" ? "Aktif" : "Selesai"}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-3.5">
                        <Button variant="ghost" size="icon-xs">
                          <IconDotsVertical className="size-4 text-muted-foreground" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

export default DashboardPage;
