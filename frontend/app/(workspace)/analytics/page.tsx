"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  IconAlertTriangle,
  IconArrowUpRight,
  IconExternalLink,
  IconRefresh,
  IconTrendingDown,
  IconTrendingUp,
} from "@tabler/icons-react";
import Link from "next/link";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getSessionList, type SessionListItem } from "@/lib/api";
import { cn } from "@/lib/utils";

// Konstanta satuan waktu untuk perhitungan rentang tren dan refresh durasi.
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_MINUTE = 60 * 1000;

// Seluruh angka analitik dihitung dari SATU request GET /api/sessions karena
// kolom created_at dan ended_at sudah ikut dikirim di daftar sesi. Halaman ini
// jadi tidak perlu mengambil detail setiap sesi satu per satu (N+1 request).
// Hasil request juga disimpan sebentar supaya pindah tab lalu kembali ke
// halaman ini tidak langsung memicu fetch ulang.
const SESSION_CACHE_TTL_MS = 30_000;

// Pilihan rentang grafik tren beserta tipe union nilai yang diturunkan darinya.
const TREND_RANGES = [
  { value: "7", label: "7 hari" },
  { value: "14", label: "14 hari" },
  { value: "30", label: "30 hari" },
] as const;

type TrendRange = (typeof TREND_RANGES)[number]["value"];

// Formatter tanggal berbahasa Indonesia, dibuat sekali di level modul.
const dateTimeFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
});
const timeFormatter = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
});
const monthFormatter = new Intl.DateTimeFormat("id-ID", {
  month: "long",
  year: "numeric",
});
const dayLabelFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
});

// Cache singkat hasil fetch, disimpan di luar React agar pindah tab lalu kembali
// ke halaman ini tidak langsung memicu fetch ulang.
let sessionCache: { sessions: SessionListItem[]; fetchedAt: number } | null =
  null;

// Sesi yang sudah dilengkapi timestamp numerik agar durasi bisa dihitung cepat.
interface TimedSession {
  id: string;
  title: string;
  status: SessionListItem["status"];
  studentCount: number;
  startedAt: number | null;
  endedAt: number | null;
  // Durasi sesi: ended_at - created_at, atau now - created_at untuk sesi aktif.
  durationMs: number | null;
  createdAtRaw: string | null;
}

// Satu titik data pada grafik tren harian.
interface DailyPoint {
  key: string;
  label: string;
  sessions: number;
  students: number;
  minutes: number;
}

// Konfigurasi label dan warna chart: tren dan distribusi status.
const trendChartConfig = {
  sessions: { label: "Jumlah sesi", color: "var(--primary)" },
  students: { label: "Jumlah siswa", color: "var(--chart-2)" },
  minutes: {
    label: "Total durasi (menit)",
    color: "var(--color-brand-green)",
  },
} satisfies ChartConfig;

const statusChartConfig = {
  active: { label: "Aktif", color: "var(--primary)" },
  ended: { label: "Selesai", color: "var(--chart-3)" },
} satisfies ChartConfig;

// Format tanggal-waktu dari API, fallback "-" bila kosong atau tidak valid.
function formatDate(value: string | null) {
  if (!value) return "-";

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "-"
    : dateTimeFormatter.format(parsed);
}

// Ubah milidetik jadi teks yang enak dibaca, contoh "1 jam 5 menit".
function formatDuration(milliseconds: number | null) {
  if (milliseconds === null) return "-";

  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours} jam ${minutes} menit`;
  if (minutes > 0) return `${minutes} menit ${seconds} detik`;
  return `${seconds} detik`;
}

// Versi ringkas untuk tabel dan sumbu chart, contoh "1j 05m".
function formatDurationShort(milliseconds: number | null) {
  if (milliseconds === null) return "-";

  const totalMinutes = Math.max(0, Math.round(milliseconds / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) return `${hours}j ${minutes}m`;
  return `${minutes}m`;
}

// Konversi string tanggal API menjadi timestamp, null bila kosong/tidak valid.
function toTimestamp(value: string | null): number | null {
  if (!value) return null;

  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

// Pasangkan timestamp numerik pada sesi supaya durasi bisa dihitung cepat.
function toTimedSession(session: SessionListItem, now: number): TimedSession {
  const startedAt = toTimestamp(session.created_at);
  const endedAt = toTimestamp(session.ended_at);
  const effectiveEnd =
    endedAt ?? (session.status === "active" && startedAt !== null ? now : null);
  const durationMs =
    startedAt !== null && effectiveEnd !== null
      ? Math.max(0, effectiveEnd - startedAt)
      : null;

  return {
    id: session.id,
    title: session.title,
    status: session.status,
    studentCount: session.participant_count,
    startedAt,
    endedAt,
    durationMs,
    createdAtRaw: session.created_at,
  };
}

// Runtun hari per hari (termasuk hari kosong) untuk chart tren.
function buildDailySeries(
  sessions: TimedSession[],
  days: number,
  now: number,
): DailyPoint[] {
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);

  const points: DailyPoint[] = [];
  const indexByKey = new Map<string, number>();

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = new Date(dayStart.getTime() - offset * MS_PER_DAY);
    const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;

    indexByKey.set(key, points.length);
    points.push({
      key,
      label: dayLabelFormatter.format(day),
      sessions: 0,
      students: 0,
      minutes: 0,
    });
  }

  sessions.forEach((session) => {
    if (session.startedAt === null) return;

    const day = new Date(session.startedAt);
    const index = indexByKey.get(
      `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`,
    );
    if (index === undefined) return;

    points[index].sessions += 1;
    points[index].students += session.studentCount;
    points[index].minutes += Math.round((session.durationMs ?? 0) / 60000);
  });

  return points;
}

// Ringkasan seluruh metrik utama dalam satu kali putaran data.
function buildAnalytics(sessions: TimedSession[], now: number) {
  const nowDate = new Date(now);
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const last7From = dayStart.getTime() - 6 * MS_PER_DAY;
  const previous7From = dayStart.getTime() - 13 * MS_PER_DAY;
  const monthStart = new Date(
    nowDate.getFullYear(),
    nowDate.getMonth(),
    1,
  ).getTime();

  let last7Sessions = 0;
  let previous7Sessions = 0;
  let monthSessions = 0;
  let activeSessions = 0;
  let endedSessions = 0;
  let totalDurationMs = 0;
  let measuredSessions = 0;

  sessions.forEach((session) => {
    if (session.status === "active") activeSessions += 1;
    if (session.status === "ended") endedSessions += 1;

    if (session.durationMs !== null) {
      totalDurationMs += session.durationMs;
      measuredSessions += 1;
    }

    if (session.startedAt === null) return;

    if (session.startedAt >= monthStart) monthSessions += 1;
    if (session.startedAt >= last7From) last7Sessions += 1;
    else if (session.startedAt >= previous7From) previous7Sessions += 1;
  });

  // Sesi terakhir & terpanjang dihitung terpisah agar tipe tetap berupa union.
  const lastSessionAt = sessions.reduce<number | null>(
    (latest, session) =>
      session.startedAt !== null &&
      (latest === null || session.startedAt > latest)
        ? session.startedAt
        : latest,
    null,
  );

  // Sesi terpanjang dihitung terpisah agar tipe tetap berupa union.
  const longestSession = sessions.reduce<TimedSession | null>(
    (longest, session) => {
      const duration = session.durationMs;
      if (duration === null) return longest;
      if (longest === null || duration > (longest.durationMs ?? 0)) {
        return session;
      }
      return longest;
    },
    null,
  );

  return {
    totalSessions: sessions.length,
    last7Sessions,
    previous7Sessions,
    monthSessions,
    monthLabel: monthFormatter.format(nowDate),
    activeSessions,
    endedSessions,
    totalDurationMs,
    averageDurationMs:
      measuredSessions > 0 ? totalDurationMs / measuredSessions : 0,
    longestSession,
    completionRate:
      sessions.length > 0
        ? Math.round((endedSessions / sessions.length) * 100)
        : 0,
    lastSessionAt,
  };
}

function AnalyticsPage() {
  // State halaman: data mentah dari API, status loading/refresh/error, waktu
  // acuan perhitungan, rentang tren, dan guard satu request berjalan.
  const [rawSessions, setRawSessions] = useState<SessionListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [trendRange, setTrendRange] = useState<TrendRange>("7");
  const [now, setNow] = useState(() => Date.now());
  const requestRef = useRef(false);

  // Terapkan hasil fetch ke state sekaligus menyegarkan titik waktu acuan.
  const applySessions = useCallback(
    (list: SessionListItem[], stamp: number) => {
      setRawSessions(list);
      setFetchedAt(stamp);
      setNow(Date.now());
    },
    [],
  );

  // Satu-satunya sumber data: GET /api/sessions. Tombol muat ulang memakai
  // force: true agar melewati cache singkat 30 detik.
  const loadSessions = useCallback(
    async ({ force = false }: { force?: boolean } = {}) => {
      if (requestRef.current) return;

      if (
        !force &&
        sessionCache &&
        Date.now() - sessionCache.fetchedAt < SESSION_CACHE_TTL_MS
      ) {
        applySessions(sessionCache.sessions, sessionCache.fetchedAt);
        setErrorMessage(null);
        setIsLoading(false);
        return;
      }

      requestRef.current = true;
      if (force) setIsRefreshing(true);
      else setIsLoading(true);

      try {
        const list = await getSessionList();
        const stamp = Date.now();
        sessionCache = { sessions: list, fetchedAt: stamp };
        applySessions(list, stamp);
        setErrorMessage(null);
        console.log(list);
      } catch (error: unknown) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Data analitik gagal dimuat. Silakan coba lagi.",
        );
      } finally {
        requestRef.current = false;
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [applySessions],
  );

  // Muat data sekali saat halaman pertama kali dibuka.
  useEffect(() => {
    const timer = window.setTimeout(() => void loadSessions(), 0);
    return () => window.clearTimeout(timer);
  }, [loadSessions]);

  // Durasi sesi aktif harus tetap hidup: jam internal memicu hitung ulang tiap
  // menit walaupun tidak ada request baru ke server.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), MS_PER_MINUTE);
    return () => window.clearInterval(timer);
  }, []);

  // Turunan data tetap murni; React Compiler dapat memoize bila diperlukan.
  const referenceTime = Math.max(now, fetchedAt ?? 0);
  const sessions = rawSessions.map((session) =>
    toTimedSession(session, referenceTime),
  );
  const analytics = buildAnalytics(sessions, referenceTime);
  const trendSeries = buildDailySeries(
    sessions,
    Number(trendRange),
    referenceTime,
  );
  const mostPopulatedSessions = [...sessions]
    .sort((a, b) => b.studentCount - a.studentCount)
    .slice(0, 5);
  const longestSessions = sessions
    .filter((session) => session.durationMs !== null)
    .sort((a, b) => (b.durationMs ?? 0) - (a.durationMs ?? 0))
    .slice(0, 5);
  // Nilai siap-pakai di JSX: flag kondisi, delta mingguan, dan data donut status.
  const hasSessions = sessions.length > 0;
  const trendHasData = trendSeries.some((point) => point.sessions > 0);
  const weekDelta = analytics.last7Sessions - analytics.previous7Sessions;
  const statusSeries = [
    {
      status: "active",
      value: analytics.activeSessions,
      fill: "var(--color-active)",
    },
    {
      status: "ended",
      value: analytics.endedSessions,
      fill: "var(--color-ended)",
    },
  ];

  // Detail kartu "Sesi 7 Hari Terakhir": delta dibanding 7 hari sebelumnya.
  const sevenDayDetail =
    analytics.previous7Sessions === 0 ? (
      analytics.last7Sessions === 0 ? (
        "Belum ada sesi pada 7 hari terakhir"
      ) : (
        "Sesi baru, belum ada pembanding"
      )
    ) : (
      <>
        <span
          className={cn(
            "inline-flex items-center gap-0.5 font-semibold",
            weekDelta >= 0
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-rose-600 dark:text-rose-400",
          )}
        >
          {weekDelta >= 0 ? (
            <IconTrendingUp className="size-3" />
          ) : (
            <IconTrendingDown className="size-3" />
          )}
          {weekDelta >= 0 ? `+${weekDelta}` : weekDelta}
        </span>
        vs 7 hari sebelumnya
      </>
    );

  // Delapan kartu ringkasan; dibuat sebagai data agar cukup dirender satu loop.
  const overviewItems: {
    label: string;
    value: string;
    detail: ReactNode;
    compact?: boolean;
  }[] = [
    {
      label: "Total Seluruh Sesi",
      value: String(analytics.totalSessions),
      detail: "Tercatat di akun Anda",
    },
    {
      label: "Sesi Aktif",
      value: String(analytics.activeSessions),
      detail: "Sedang berlangsung",
    },
    {
      label: "Sesi Selesai",
      value: String(analytics.endedSessions),
      detail: `${analytics.completionRate}% dari total sesi`,
    },
  ];

  return (
    <section className="mx-auto w-full max-w-295 p-6 lg:p-8">
      {/* Header halaman: judul, waktu pembaruan terakhir, dan tombol muat ulang. */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.5px] text-foreground">
            Analitik
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ringkasan jumlah, status, dan durasi seluruh sesi kelas Qurio Anda
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {fetchedAt
              ? `Diperbarui pukul ${timeFormatter.format(new Date(fetchedAt))}`
              : isLoading
                ? "Memuat data..."
                : "Data belum dimuat"}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={isLoading || isRefreshing}
            onClick={() => void loadSessions({ force: true })}
          >
            <IconRefresh
              className={cn(
                "size-4",
                (isLoading || isRefreshing) && "animate-spin",
              )}
            />
            Muat ulang
          </Button>
        </div>
      </header>

      {/* Pesan error bila request daftar sesi gagal. */}
      {errorMessage && (
        <Alert variant="destructive" className="mt-6">
          <IconAlertTriangle />
          <AlertTitle>Data analitik tidak dapat dimuat</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
          <AlertAction>
            <Button
              variant="outline"
              size="xs"
              onClick={() => void loadSessions({ force: true })}
            >
              Coba lagi
            </Button>
          </AlertAction>
        </Alert>
      )}

      {/* Grid kartu ringkasan seluruh metrik utama. */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {overviewItems.map(({ label, value, detail, compact }) => (
          <Card
            key={label}
            className="rounded-[20px] border-border py-0 shadow-[0_8px_24px_rgb(15_23_42/0.05)] dark:shadow-none"
          >
            <CardHeader className="p-5 pb-0">
              <CardTitle className="text-[13px] font-medium text-muted-foreground">
                {label}
              </CardTitle>
            </CardHeader>
            <CardContent className="gap-2 p-5 pt-2">
              {isLoading ? (
                <Skeleton className="h-8 w-28 rounded-lg" />
              ) : (
                <p
                  className={cn(
                    "font-bold tracking-tight text-foreground",
                    compact ? "text-[22px] leading-8" : "text-[28px]",
                  )}
                >
                  {value}
                </p>
              )}
              <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                {detail}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {isLoading || hasSessions ? (
        <>
          {/* Konten analitik: tren harian, distribusi status, sebaran hari, tabel durasi. */}
          <div className="mt-6 grid gap-3 lg:grid-cols-3">
            <Card className="rounded-[20px] border-border py-0 shadow-[0_8px_24px_rgb(15_23_42/0.05)] dark:shadow-none lg:col-span-2">
              <CardHeader className="p-5 pb-0 sm:p-6 sm:pb-0">
                {/* Grafik harian: jumlah sesi dan siswa (kiri), durasi (kanan). */}
                <CardTitle className="text-base font-semibold text-foreground">
                  Tren Sesi Harian
                </CardTitle>
                <CardDescription>
                  Jumlah sesi, jumlah siswa, dan total durasi (menit) per hari
                </CardDescription>
                <CardAction>
                  {/* Pemilih rentang 7/14/30 hari. */}
                  <Tabs
                    value={trendRange}
                    onValueChange={(value) =>
                      setTrendRange(value as TrendRange)
                    }
                    className="w-auto gap-0"
                  >
                    <TabsList className="h-8 w-fit gap-1 rounded-full border-b-0 bg-muted px-1 py-1">
                      {TREND_RANGES.map((range) => (
                        <TabsTrigger
                          key={range.value}
                          value={range.value}
                          className="h-6 rounded-full border-b-0 px-3 text-xs data-active:border-transparent data-active:bg-background data-active:text-foreground"
                        >
                          {range.label}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                </CardAction>
              </CardHeader>
              <CardContent className="p-5 pt-4 sm:p-6 sm:pt-4">
                {isLoading ? (
                  <Skeleton className="h-64 w-full rounded-xl" />
                ) : trendHasData ? (
                  <ChartContainer
                    config={trendChartConfig}
                    className="h-64 w-full aspect-auto"
                  >
                    <ComposedChart
                      data={trendSeries}
                      margin={{ top: 8, right: 8, left: -8, bottom: 0 }}
                    >
                      <CartesianGrid vertical={false} />
                      <XAxis
                        dataKey="label"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        minTickGap={12}
                      />
                      <YAxis
                        yAxisId="left"
                        width={28}
                        allowDecimals={false}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        width={38}
                        allowDecimals={false}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => `${value}m`}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar
                        yAxisId="left"
                        name="sessions"
                        dataKey="sessions"
                        fill="var(--color-sessions)"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={26}
                      />
                      <Line
                        yAxisId="left"
                        name="students"
                        type="monotone"
                        dataKey="students"
                        stroke="var(--color-students)"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                      <Line
                        yAxisId="right"
                        name="minutes"
                        type="monotone"
                        dataKey="minutes"
                        stroke="var(--color-minutes)"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                      <ChartLegend content={<ChartLegendContent />} />
                    </ComposedChart>
                  </ChartContainer>
                ) : (
                  <div className="grid h-64 w-full place-items-center rounded-xl bg-muted/60 px-6 text-center text-sm text-muted-foreground">
                    Belum ada sesi pada rentang ini.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-[20px] border-border py-0 shadow-[0_8px_24px_rgb(15_23_42/0.05)] dark:shadow-none">
              {/* Donut distribusi status dengan angka total sesi di tengah. */}
              <CardHeader className="p-5 pb-0 sm:p-6 sm:pb-0">
                <CardTitle className="text-base font-semibold text-foreground">
                  Distribusi Status
                </CardTitle>
                <CardDescription>
                  {analytics.completionRate}% sesi sudah berakhir
                </CardDescription>
              </CardHeader>
              <CardContent className="gap-3 p-5 pt-4 sm:p-6 sm:pt-4">
                {isLoading ? (
                  <Skeleton className="mx-auto h-48 w-full max-w-56 rounded-full" />
                ) : (
                  <div className="relative">
                    <ChartContainer
                      id="session-status"
                      config={statusChartConfig}
                      className="mx-auto h-48 w-full max-w-56 aspect-auto"
                    >
                      <PieChart>
                        <ChartTooltip
                          cursor={false}
                          content={<ChartTooltipContent hideLabel />}
                        />
                        <Pie
                          data={statusSeries}
                          dataKey="value"
                          nameKey="status"
                          innerRadius="68%"
                          paddingAngle={2}
                          strokeWidth={0}
                        />
                      </PieChart>
                    </ChartContainer>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-bold text-foreground">
                        {analytics.totalSessions}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        Total sesi
                      </span>
                    </div>
                  </div>
                )}
                {/* Legenda status aktif dan selesai. */}
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Badge
                    variant="outline"
                    className="gap-1.5 border-transparent bg-primary/10 px-2.5 text-primary"
                  >
                    <span className="size-1.5 rounded-full bg-primary" />
                    Aktif {analytics.activeSessions}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="gap-1.5 border-transparent bg-muted px-2.5 text-muted-foreground"
                  >
                    <span className="size-1.5 rounded-full bg-chart-3" />
                    Selesai {analytics.endedSessions}
                  </Badge>
                </div>
                <Separator />
                <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span>Sesi terakhir dibuat</span>
                  <span className="truncate font-medium text-foreground">
                    {analytics.lastSessionAt
                      ? dateTimeFormatter.format(
                          new Date(analytics.lastSessionAt),
                        )
                      : "-"}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="mt-6 grid gap-3">
            <Card className="rounded-[20px] border-border py-0 shadow-[0_8px_24px_rgb(15_23_42/0.05)] dark:shadow-none lg:col-span-2">
              <CardHeader className="p-5 pb-0 sm:p-6 sm:pb-0">
                <CardTitle className="text-base font-semibold text-foreground">
                  Sesi dengan Durasi Terlama
                </CardTitle>
                <CardDescription>
                  Lima sesi dengan total waktu paling panjang
                </CardDescription>
                <CardAction>
                  <Link
                    href="/sessions"
                    className={cn(
                      buttonVariants({ variant: "ghost", size: "xs" }),
                      "text-muted-foreground",
                    )}
                  >
                    Semua sesi
                    <IconArrowUpRight className="size-3.5" />
                  </Link>
                </CardAction>
              </CardHeader>
              <CardContent className="p-5 pt-4 sm:p-6 sm:pt-4">
                {/* Tabel lima sesi dengan total durasi paling panjang. */}
                {isLoading ? (
                  <div className="space-y-3">
                    {[0, 1, 2, 3, 4].map((row) => (
                      <Skeleton key={row} className="h-9 w-full rounded-lg" />
                    ))}
                  </div>
                ) : longestSessions.length === 0 ? (
                  <div className="grid h-44 w-full place-items-center rounded-xl bg-muted/60 px-6 text-center text-sm text-muted-foreground">
                    Belum ada sesi yang punya durasi tercatat.
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="px-4">Judul Sesi</TableHead>
                          <TableHead className="px-4">Status</TableHead>
                          <TableHead className="px-4">Mulai</TableHead>
                          <TableHead className="px-4 text-right">
                            Durasi
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {longestSessions.map((session) => (
                          <TableRow key={session.id}>
                            <TableCell className="px-4 py-3 font-medium text-foreground">
                              <Link
                                href={`/dashboard/session/${session.id}`}
                                className="inline-flex items-center gap-1.5 transition-colors hover:text-primary hover:underline"
                              >
                                <span className="line-clamp-1">
                                  {session.title}
                                </span>
                                <IconExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
                              </Link>
                            </TableCell>
                            <TableCell className="px-4 py-3">
                              <Badge
                                variant="outline"
                                className={
                                  session.status === "active"
                                    ? "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                                    : "border-transparent bg-muted text-muted-foreground"
                                }
                              >
                                {session.status === "active"
                                  ? "Aktif"
                                  : "Selesai"}
                              </Badge>
                            </TableCell>
                            <TableCell className="px-4 py-3 text-muted-foreground">
                              {formatDate(session.createdAtRaw)}
                            </TableCell>
                            <TableCell className="px-4 py-3 text-right font-semibold text-foreground tabular-nums">
                              {formatDurationShort(session.durationMs)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="mt-6 rounded-[20px] border-border py-0 shadow-[0_8px_24px_rgb(15_23_42/0.05)] dark:shadow-none">
            <CardHeader className="p-5 pb-0 sm:p-6 sm:pb-0">
              <CardTitle className="text-base font-semibold text-foreground">
                Sesi dengan Siswa Terbanyak
              </CardTitle>
              <CardDescription>
                Lima sesi dengan jumlah siswa terdaftar terbanyak
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-4 sm:p-6 sm:pt-4">
              {isLoading ? (
                <div className="space-y-3">
                  {[0, 1, 2, 3, 4].map((row) => (
                    <Skeleton key={row} className="h-12 w-full rounded-lg" />
                  ))}
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-border">
                  <div className="grid grid-cols-[minmax(0,7fr)_minmax(112px,3fr)] gap-4 bg-muted/60 px-4 py-2 text-xs font-medium text-muted-foreground sm:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
                    <span>Judul sesi</span>
                    <span className="text-right">Jumlah siswa</span>
                  </div>
                  {mostPopulatedSessions.map((session) => (
                    <Link
                      key={session.id}
                      href={`/dashboard/session/${session.id}`}
                      className="grid grid-cols-[minmax(0,7fr)_minmax(112px,3fr)] items-center gap-4 border-t border-border px-4 py-3 transition-colors hover:bg-muted/40 sm:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]"
                    >
                      <span className="min-w-0 wrap-break-word font-medium text-foreground">
                        {session.title}
                      </span>
                      <span className="flex min-w-0 items-center gap-3">
                        <span
                          aria-hidden="true"
                          className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-muted"
                        >
                          <span
                            className="block h-full rounded-full bg-primary"
                            style={{
                              width: `${
                                mostPopulatedSessions[0].studentCount > 0
                                  ? (session.studentCount /
                                      mostPopulatedSessions[0].studentCount) *
                                    100
                                  : 0
                              }%`,
                            }}
                          />
                        </span>
                        <span className="w-10 shrink-0 text-right text-sm font-semibold tabular-nums text-foreground">
                          {session.studentCount}
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <Card className="mt-6 rounded-[20px] border-border py-0 shadow-[0_8px_24px_rgb(15_23_42/0.05)] dark:shadow-none">
          {/* Empty state: ajakan muat ulang saat error, atau membuat sesi pertama. */}
          <CardContent className="items-center gap-3 px-6 py-16 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
              <IconTrendingUp className="size-6" />
            </span>
            <p className="text-base font-semibold text-foreground">
              Belum ada data untuk dianalisis
            </p>
            <p className="max-w-md text-sm text-muted-foreground">
              {errorMessage
                ? "Muat ulang halaman setelah terhubung kembali ke server untuk melihat statistik sesi."
                : "Buat dan jalankan sesi pertama Anda, lalu grafik jumlah serta durasi sesi akan muncul di sini."}
            </p>
            {errorMessage ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void loadSessions({ force: true })}
              >
                <IconRefresh className="size-4" />
                Muat ulang
              </Button>
            ) : (
              <Link
                href="/dashboard/createsessions"
                className={buttonVariants({ size: "sm" })}
              >
                Buat sesi pertama
              </Link>
            )}
          </CardContent>
        </Card>
      )}
    </section>
  );
}

export default AnalyticsPage;
