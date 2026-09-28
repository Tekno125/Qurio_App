"use client";

import { useEffect, useState } from "react";
import {
  IconChevronDown,
  IconDotsVertical,
  IconExternalLink,
  IconPlayerPlay,
  IconPlayerStop,
  IconSearch,
  IconTrash,
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
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
import {
  getSessionList,
  updateStatusSession,
  type SessionListItem,
} from "@/lib/api";
import smartSearch from "@/lib/smart-search";

function formatDate(value: string | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getStatusFilterLabel(statusFilters: SessionListItem["status"][]) {
  if (statusFilters.length === 0) return "Semua status";
  if (statusFilters.length > 1) return `${statusFilters.length} status dipilih`;
  return statusFilters[0] === "active" ? "Aktif" : "Selesai";
}

function SessionsPage() {
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [statusFilters, setStatusFilters] = useState<
    SessionListItem["status"][]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(
    null,
  );
  const [updatingSessionIds, setUpdatingSessionIds] = useState<string[]>([]);

  useEffect(() => {
    const debounceTimer = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);

    return () => window.clearTimeout(debounceTimer);
  }, [searchQuery]);

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

  const overviewItems = [
    {
      label: "Total Sesi",
      value: sessions.length,
      detail: "Semua sesi milik Anda",
    },
    {
      label: "Sesi Aktif",
      value: sessions.filter((session) => session.status === "active").length,
      detail: "Sedang berlangsung",
    },
    {
      label: "Sesi Selesai",
      value: sessions.filter((session) => session.status === "ended").length,
      detail: "Sudah berakhir",
    },
  ];

  const searchedSessions = debouncedSearchQuery.trim()
    ? smartSearch(
        sessions,
        debouncedSearchQuery,
        (session) =>
          `${session.title} ${session.status} ${session.access_code}`,
      )
        .filter((result) => result.matchedWords > 0)
        .map((result) => result.item)
    : sessions;

  const visibleSessions = searchedSessions.filter(
    (session) =>
      statusFilters.length === 0 || statusFilters.includes(session.status),
  );
  const statusFilterLabel = getStatusFilterLabel(statusFilters);

  const toggleSessionStatus = async (session: SessionListItem) => {
    const nextStatus = session.status === "active" ? "ended" : "active";
    setUpdatingSessionIds((current) => [...current, session.id]);
    setActionErrorMessage(null);

    try {
      await updateStatusSession(session.id, nextStatus, null);
      setSessions((current) =>
        current.map((item) =>
          item.id === session.id
            ? {
                ...item,
                status: nextStatus,
                ended_at:
                  nextStatus === "ended" ? new Date().toISOString() : null,
              }
            : item,
        ),
      );
    } catch (error) {
      setActionErrorMessage(
        error instanceof Error ? error.message : "Gagal mengubah status sesi.",
      );
    } finally {
      setUpdatingSessionIds((current) =>
        current.filter((id) => id !== session.id),
      );
    }
  };

  return (
    <section className="mx-auto w-full max-w-295 p-6 lg:p-8">
      <header>
        <h1 className="text-2xl font-bold tracking-[-0.5px] text-foreground">
          Daftar Sesi
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Kelola dan telusuri seluruh sesi kelas Qurio Anda
        </p>
      </header>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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

      <Card className="mt-6 rounded-[20px] border-border py-0 shadow-[0_8px_24px_rgb(15_23_42/0.05)] dark:shadow-none">
        <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-5 sm:p-6">
          <h2 className="text-base font-semibold text-foreground">
            Seluruh Sesi
          </h2>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <IconSearch className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-11 rounded-full border-0 bg-muted pl-10 shadow-none"
                placeholder="Cari nama, kode akses, atau status..."
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

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="outline"
                    className="h-10 justify-between border-border px-4 text-muted-foreground sm:w-50"
                  >
                    {statusFilterLabel}
                    <IconChevronDown className="size-4" />
                  </Button>
                }
              />
              <DropdownMenuContent align="start">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Status sesi</DropdownMenuLabel>
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
          {actionErrorMessage && (
            <p className="mt-3 text-sm text-destructive" role="alert">
              {actionErrorMessage}
            </p>
          )}

          <div className="mt-4 overflow-auto rounded-md border border-border">
            <Table className="min-w-190 text-left">
              <TableHeader className="bg-muted text-muted-foreground">
                <TableRow className="font-bold hover:bg-transparent">
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
                {isLoading && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-24 text-center text-muted-foreground"
                    >
                      Memuat sesi...
                    </TableCell>
                  </TableRow>
                )}

                {!isLoading && errorMessage && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-24 text-center text-destructive"
                    >
                      {errorMessage}
                    </TableCell>
                  </TableRow>
                )}

                {!isLoading &&
                  !errorMessage &&
                  visibleSessions.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="h-24 text-center text-muted-foreground"
                      >
                        {debouncedSearchQuery.trim() || statusFilters.length > 0
                          ? "Tidak ada sesi yang cocok dengan pencarian atau filter."
                          : "Belum ada sesi."}
                      </TableCell>
                    </TableRow>
                  )}

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
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                aria-label={`Aksi sesi ${session.title}`}
                              >
                                <IconDotsVertical className="size-4 text-muted-foreground" />
                              </Button>
                            }
                          />
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              render={
                                <Link
                                  href={`/dashboard/session/${session.id}`}
                                />
                              }
                            >
                              <IconExternalLink className="size-4" />
                              Buka sesi
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={updatingSessionIds.includes(session.id)}
                              onClick={() => void toggleSessionStatus(session)}
                            >
                              {session.status === "active" ? (
                                <IconPlayerStop className="size-4" />
                              ) : (
                                <IconPlayerPlay className="size-4" />
                              )}
                              {session.status === "active"
                                ? "Akhiri sesi"
                                : "Aktifkan sesi"}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" disabled>
                              <IconTrash className="size-4" />
                              Hapus sesi
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
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

export default SessionsPage;
