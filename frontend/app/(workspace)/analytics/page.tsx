"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  IconAlertTriangle,
  IconAward,
  IconDownload,
  IconMoodEmpty,
  IconRefresh,
  IconTrendingUp,
  IconUsers,
} from "@tabler/icons-react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
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
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getSessionList, type SessionListItem } from "@/lib/api";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

// -------------------------------------------------------------
// Konstanta & tipe
// -------------------------------------------------------------
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_MINUTE = 60 * 1000;
const SESSION_CACHE_TTL_MS = 30_000;

const TREND_RANGES = [
  { value: "7", label: "7 hari" },
  { value: "14", label: "14 hari" },
  { value: "30", label: "30 hari" },
] as const;
type TrendRange = (typeof TREND_RANGES)[number]["value"];

// Rentang nilai untuk distribusi skor.
const SCORE_BUCKETS = [
  { key: "A", min: 85, max: 100, color: "var(--chart-1)" },
  { key: "B", min: 70, max: 84, color: "var(--chart-2)" },
  { key: "C", min: 55, max: 69, color: "var(--chart-3)" },
  { key: "D", min: 40, max: 54, color: "var(--chart-4)" },
  { key: "E", min: 0, max: 39, color: "var(--chart-5)" },
] as const;

// Formatter.
const dateTimeFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
});
const timeFormatter = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
});
const dayLabelFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
});

// -------------------------------------------------------------
// Tipe data analitik siswa (dari endpoint masa depan)
// -------------------------------------------------------------

/** Ringkasan skor satu siswa dalam satu sesi kuis. */
interface StudentScore {
  studentId: string;
  studentName: string;
  sessionId: string;
  sessionTitle: string;
  score: number; // 0–100
  correctCount: number;
  totalQuestions: number;
}

/** Ringkasan partisipasi per siswa untuk leaderboard. */
interface StudentParticipation {
  studentId: string;
  studentName: string;
  sessionsJoined: number;
  questionsAsked: number;
  upvotesGiven: number;
  responsesSubmitted: number;
}

/** Topik/pertanyaan yang paling sering dijawab salah. */
interface TopTopic {
  questionId: string;
  questionText: string;
  sessionTitle: string;
  incorrectRate: number; // 0–100
  totalAnswers: number;
}

/** Distribusi tipe aktivitas yang dijalankan di kelas. */
interface ActivityMixItem {
  type: "quiz" | "qa" | "wordcloud";
  label: string;
  value: number;
  color: string;
}

// -------------------------------------------------------------
// Cache
// -------------------------------------------------------------
let sessionCache: { sessions: SessionListItem[]; fetchedAt: number } | null =
  null;

// -------------------------------------------------------------
// Chart configs
// -------------------------------------------------------------
const scoreDistConfig = {
  count: { label: "Jumlah siswa" },
} satisfies ChartConfig;

const activityMixConfig = {
  value: { label: "Jumlah" },
  quiz: { label: "Kuis", color: "var(--chart-1)" },
  qa: { label: "Tanya Jawab", color: "var(--chart-2)" },
  wordcloud: { label: "Word Cloud", color: "var(--chart-3)" },
} satisfies ChartConfig;

const participationConfig = {
  participants: { label: "Siswa terlibat", color: "var(--chart-2)" },
} satisfies ChartConfig;

// -------------------------------------------------------------
// Helpers
// -------------------------------------------------------------
function formatDate(value: string | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "-"
    : dateTimeFormatter.format(parsed);
}

function toTimestamp(value: string | null): number | null {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Hitung distribusi nilai menjadi bucket A/B/C/D/E.
 * Aktif dipakai saat endpoint `/api/analytics/scores` sudah tersedia.
 */
function buildScoreDistribution(scores: StudentScore[]) {
  const counts = new Map<string, number>();
  SCORE_BUCKETS.forEach((bucket) => counts.set(bucket.key, 0));

  scores.forEach((score) => {
    const bucket = SCORE_BUCKETS.find(
      (b) => score.score >= b.min && score.score <= b.max,
    );
    if (bucket) counts.set(bucket.key, (counts.get(bucket.key) ?? 0) + 1);
  });

  return SCORE_BUCKETS.map((bucket) => ({
    grade: bucket.key,
    count: counts.get(bucket.key) ?? 0,
    fill: bucket.color,
  }));
}

/**
 * Agregasi partisipasi siswa per hari dari sessions.participant_count.
 * Ini bukan data siswa unik (karena satu siswa bisa join banyak sesi),
 * tapi cukup untuk menunjukkan TREN aktivitas.
 */
function buildParticipationTrend(
  sessions: SessionListItem[],
  days: number,
  now: number,
) {
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);

  const points: { key: string; label: string; participants: number }[] = [];
  const indexByKey = new Map<string, number>();

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = new Date(dayStart.getTime() - offset * MS_PER_DAY);
    const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
    indexByKey.set(key, points.length);
    points.push({
      key,
      label: dayLabelFormatter.format(day),
      participants: 0,
    });
  }

  sessions.forEach((session) => {
    const ts = toTimestamp(session.created_at);
    if (ts === null) return;
    const day = new Date(ts);
    const idx = indexByKey.get(
      `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`,
    );
    if (idx === undefined) return;
    points[idx].participants += session.participant_count ?? 0;
  });

  return points;
}

// -------------------------------------------------------------
// Komponen kecil yang dapat dipakai ulang
// -------------------------------------------------------------

/** Empty state standar untuk chart/tabel yang belum punya data. */
function EmptyBlock({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon?: ReactNode;
}) {
  return (
    <div className="grid min-h-[200px] place-items-center rounded-xl bg-muted/40 px-6 py-10 text-center">
      <div className="flex max-w-sm flex-col items-center gap-2">
        <span className="grid size-11 place-items-center rounded-full bg-background text-muted-foreground">
          {icon ?? <IconMoodEmpty className="size-5" />}
        </span>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// Halaman utama
// -------------------------------------------------------------
function AnalyticsPage() {
  const [rawSessions, setRawSessions] = useState<SessionListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [trendRange, setTrendRange] = useState<TrendRange>("7");
  const [leaderboardTab, setLeaderboardTab] = useState<
    "active" | "top-score"
  >("active");
  const [now, setNow] = useState(() => Date.now());
  const requestRef = useRef(false);

  // ---- Data per-siswa (endpoint masa depan) ----
  // Saat endpoint siap, ganti dengan fetch di dalam loadSessions().
  // Contoh: const [scores, participation, topics, activityMix] = await Promise.all([
  //   fetchStudentScores(), fetchStudentParticipation(), fetchTopTopics(), fetchActivityMix()
  // ]);
  const studentScores: StudentScore[] = [];
  const studentParticipation: StudentParticipation[] = [];
  const topTopics: TopTopic[] = [];
  const activityMix: ActivityMixItem[] = [];

  const applySessions = useCallback(
    (list: SessionListItem[], stamp: number) => {
      setRawSessions(list);
      setFetchedAt(stamp);
      setNow(Date.now());
    },
    [],
  );

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

  useEffect(() => {
    const timer = window.setTimeout(() => void loadSessions(), 0);
    return () => window.clearTimeout(timer);
  }, [loadSessions]);

  // Selama sesi berjalan, partisipasi bisa bertambah → refresh tiap menit.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), MS_PER_MINUTE);
    return () => window.clearInterval(timer);
  }, []);

  // ---- Turunan data ----
  const totalStudents = useMemo(
    () =>
      rawSessions.reduce(
        (sum, session) => sum + (session.participant_count ?? 0),
        0,
      ),
    [rawSessions],
  );

  const activeSessionsCount = rawSessions.filter(
    (s) => s.status === "active",
  ).length;

  // Rata-rata skor dihitung hanya kalau ada data skor.
  const averageScore =
    studentScores.length > 0
      ? Math.round(
        studentScores.reduce((sum, s) => sum + s.score, 0) /
        studentScores.length,
      )
      : null;

  // Tingkat partisipasi = siswa yang submit minimal 1 respons / total siswa.
  const participationRate =
    studentParticipation.length > 0
      ? Math.round(
        (studentParticipation.filter((s) => s.responsesSubmitted > 0)
          .length /
          studentParticipation.length) *
        100,
      )
      : null;

  const scoreDistribution = buildScoreDistribution(studentScores);

  const participationTrend = useMemo(
    () =>
      buildParticipationTrend(
        rawSessions,
        Number(trendRange),
        Math.max(now, fetchedAt ?? 0),
      ),
    [rawSessions, trendRange, now, fetchedAt],
  );

  const hasParticipationData = participationTrend.some(
    (point) => point.participants > 0,
  );

  const topScoreStudents = useMemo(
    () =>
      [...studentScores]
        .reduce<Map<string, { name: string; total: number; count: number }>>(
          (acc, s) => {
            const existing = acc.get(s.studentId) ?? {
              name: s.studentName,
              total: 0,
              count: 0,
            };
            existing.total += s.score;
            existing.count += 1;
            acc.set(s.studentId, existing);
            return acc;
          },
          new Map(),
        )
        .entries(),
    [studentScores],
  );

  const topScoreLeaderboard = useMemo(
    () =>
      Array.from(topScoreStudents)
        .map(([id, { name, total, count }]) => ({
          studentId: id,
          studentName: name,
          average: Math.round(total / count),
          sessionCount: count,
        }))
        .sort((a, b) => b.average - a.average)
        .slice(0, 10),
    [topScoreStudents],
  );

  const activeLeaderboard = useMemo(
    () =>
      [...studentParticipation]
        .sort(
          (a, b) =>
            b.sessionsJoined * 3 +
            b.questionsAsked * 2 +
            b.responsesSubmitted -
            (a.sessionsJoined * 3 +
              a.questionsAsked * 2 +
              a.responsesSubmitted),
        )
        .slice(0, 10),
    [studentParticipation],
  );

  // ---- Export CSV ----
  const handleExportCSV = () => {
    if (!studentScores.length && !studentParticipation.length) {
      toast.add({
        title: "Belum ada data untuk diekspor",
        description:
          "Data performa siswa belum tersedia. Jalankan kuis dan minta siswa menjawab.",
        type: "info",
      });
      return;
    }

    const rows: string[] = [];
    rows.push(
      "student_id,student_name,sessions_joined,questions_asked,responses_submitted,average_score",
    );

    const scoreByStudent = new Map(
      topScoreLeaderboard.map((row) => [row.studentId, row.average]),
    );

    studentParticipation.forEach((p) => {
      rows.push(
        [
          p.studentId,
          `"${p.studentName}"`,
          p.sessionsJoined,
          p.questionsAsked,
          p.responsesSubmitted,
          scoreByStudent.get(p.studentId) ?? "",
        ].join(","),
      );
    });

    const csv = rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `qurio-analytics-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.add({
      title: "Laporan berhasil diunduh",
      description: "File CSV berisi data performa siswa.",
      type: "success",
    });
  };

  // ---- Kartu ringkasan ----
  const overviewItems: {
    label: string;
    value: string;
    detail: string;
    compact?: boolean;
  }[] = [
      {
        label: "Total Siswa Terlibat",
        value: String(totalStudents),
        detail: `${rawSessions.length} sesi, ${activeSessionsCount} sedang aktif`,
      },
      {
        label: "Rata-rata Skor Kuis",
        value: averageScore !== null ? String(averageScore) : "-",
        detail:
          averageScore !== null
            ? `Dari ${studentScores.length} jawaban siswa`
            : "Menunggu data jawaban kuis",
      },
      {
        label: "Tingkat Partisipasi",
        value: participationRate !== null ? `${participationRate}%` : "-",
        detail:
          participationRate !== null
            ? "Siswa yang menjawab minimal 1 aktivitas"
            : "Menunggu data respons",
      },
      {
        label: "Sesi Dianalisis",
        value: String(rawSessions.length),
        detail:
          fetchedAt !== null
            ? `Diperbarui ${timeFormatter.format(new Date(fetchedAt))}`
            : "Memuat...",
      },
    ];

  return (
    <section className="mx-auto w-full max-w-[1180px] p-6 lg:p-8">
      {/* Header + tombol ekspor. */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.5px] text-foreground">
            Analitik Performa Siswa
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ukur pemahaman, partisipasi, dan capaian belajar siswa di seluruh
            sesi Qurio Anda
          </p>
        </div>
        <div className="flex items-center gap-2">
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
          <Button size="sm" onClick={handleExportCSV}>
            <IconDownload className="size-4" />
            Ekspor CSV
          </Button>
        </div>
      </header>

      {/* Error state. */}
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

      {/* Kartu metrik utama. */}
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
              <p className="text-[11px] text-muted-foreground">{detail}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Baris 1: Distribusi Nilai + Tipe Aktivitas. */}
      <div className="mt-6 grid gap-3 lg:grid-cols-3">
        <Card className="rounded-[20px] border-border py-0 shadow-[0_8px_24px_rgb(15_23_42/0.05)] dark:shadow-none lg:col-span-2">
          <CardHeader className="p-5 pb-0 sm:p-6 sm:pb-0">
            <CardTitle className="text-base font-semibold text-foreground">
              Distribusi Nilai Kuis
            </CardTitle>
            <CardDescription>
              Sebaran nilai siswa di semua sesi kuis (skala A–E)
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-4 sm:p-6 sm:pt-4">
            {isLoading ? (
              <Skeleton className="h-64 w-full rounded-xl" />
            ) : studentScores.length > 0 ? (
              <ChartContainer
                config={scoreDistConfig}
                className="h-64 w-full aspect-auto"
              >
                <BarChart
                  data={scoreDistribution}
                  margin={{ top: 8, right: 8, left: -8, bottom: 0 }}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="grade"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    width={28}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={56}>
                    {scoreDistribution.map((entry) => (
                      <Cell key={entry.grade} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            ) : (
              <EmptyBlock
                title="Belum ada data nilai"
                description="Distribusi nilai muncul setelah siswa menjawab kuis di sesi Anda. Minta siswa menyelesaikan minimal satu kuis."
                icon={<IconAward className="size-5" />}
              />
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[20px] border-border py-0 shadow-[0_8px_24px_rgb(15_23_42/0.05)] dark:shadow-none">
          <CardHeader className="p-5 pb-0 sm:p-6 sm:pb-0">
            <CardTitle className="text-base font-semibold text-foreground">
              Tipe Aktivitas
            </CardTitle>
            <CardDescription>
              Komposisi jenis aktivitas kelas yang dijalankan
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-4 sm:p-6 sm:pt-4">
            {isLoading ? (
              <Skeleton className="h-64 w-full rounded-xl" />
            ) : activityMix.length > 0 ? (
              <ChartContainer
                config={activityMixConfig}
                className="mx-auto h-64 w-full aspect-auto"
              >
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                  <Pie
                    data={activityMix}
                    dataKey="value"
                    nameKey="label"
                    innerRadius={56}
                    outerRadius={90}
                    paddingAngle={3}
                  >
                    {activityMix.map((entry) => (
                      <Cell key={entry.type} fill={entry.color} />
                    ))}
                  </Pie>
                  <ChartLegend
                    content={<ChartLegendContent nameKey="label" />}
                  />
                </PieChart>
              </ChartContainer>
            ) : (
              <EmptyBlock
                title="Belum ada aktivitas tercatat"
                description="Donut chart ini menampilkan perbandingan kuis, tanya jawab, dan word cloud yang Anda jalankan."
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Baris 2: Tren Partisipasi. */}
      <Card className="mt-6 rounded-[20px] border-border py-0 shadow-[0_8px_24px_rgb(15_23_42/0.05)] dark:shadow-none">
        <CardHeader className="p-5 pb-0 sm:p-6 sm:pb-0">
          <CardTitle className="text-base font-semibold text-foreground">
            Tren Partisipasi Siswa
          </CardTitle>
          <CardDescription>
            Total kehadiran siswa per hari (dihitung dari seluruh sesi)
          </CardDescription>
          <CardAction>
            <Tabs
              value={trendRange}
              onValueChange={(value) => setTrendRange(value as TrendRange)}
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
            <Skeleton className="h-56 w-full rounded-xl" />
          ) : hasParticipationData ? (
            <ChartContainer
              config={participationConfig}
              className="h-56 w-full aspect-auto"
            >
              <LineChart
                data={participationTrend}
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
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  width={28}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  type="monotone"
                  dataKey="participants"
                  stroke="var(--color-participants)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ChartContainer>
          ) : (
            <EmptyBlock
              title="Belum ada partisipasi pada rentang ini"
              description="Coba pilih rentang tanggal yang lebih panjang, atau jalankan sesi baru bersama siswa."
              icon={<IconTrendingUp className="size-5" />}
            />
          )}
        </CardContent>
      </Card>

      {/* Baris 3: Leaderboard + Topik Tersulit. */}
      <div className="mt-6 grid gap-3 lg:grid-cols-3">
        <Card className="rounded-[20px] border-border py-0 shadow-[0_8px_24px_rgb(15_23_42/0.05)] dark:shadow-none lg:col-span-2">
          <CardHeader className="p-5 pb-0 sm:p-6 sm:pb-0">
            <CardTitle className="text-base font-semibold text-foreground">
              Papan Peringkat Siswa
            </CardTitle>
            <CardDescription>
              Berdasarkan aktivitas dan capaian nilai di semua sesi
            </CardDescription>
            <CardAction>
              <Tabs
                value={leaderboardTab}
                onValueChange={(value) =>
                  setLeaderboardTab(value as "active" | "top-score")
                }
                className="w-auto gap-0"
              >
                <TabsList className="h-8 w-fit gap-1 rounded-full border-b-0 bg-muted px-1 py-1">
                  <TabsTrigger
                    value="active"
                    className="h-6 rounded-full border-b-0 px-3 text-xs data-active:border-transparent data-active:bg-background data-active:text-foreground"
                  >
                    Paling Aktif
                  </TabsTrigger>
                  <TabsTrigger
                    value="top-score"
                    className="h-6 rounded-full border-b-0 px-3 text-xs data-active:border-transparent data-active:bg-background data-active:text-foreground"
                  >
                    Skor Tertinggi
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </CardAction>
          </CardHeader>
          <CardContent className="p-5 pt-4 sm:p-6 sm:pt-4">
            {isLoading ? (
              <div className="space-y-3">
                {[0, 1, 2, 3, 4].map((row) => (
                  <Skeleton key={row} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            ) : leaderboardTab === "active" ? (
              activeLeaderboard.length > 0 ? (
                <LeaderboardTable
                  rows={activeLeaderboard.map((row, index) => ({
                    rank: index + 1,
                    name: row.studentName,
                    metric: `${row.sessionsJoined} sesi · ${row.questionsAsked} tanya · ${row.responsesSubmitted} jawaban`,
                    value: row.sessionsJoined + row.questionsAsked,
                  }))}
                />
              ) : (
                <EmptyBlock
                  title="Belum ada data aktivitas siswa"
                  description="Papan peringkat terisi otomatis saat siswa bergabung, mengirim pertanyaan, atau menjawab aktivitas."
                  icon={<IconUsers className="size-5" />}
                />
              )
            ) : topScoreLeaderboard.length > 0 ? (
              <LeaderboardTable
                rows={topScoreLeaderboard.map((row, index) => ({
                  rank: index + 1,
                  name: row.studentName,
                  metric: `Rata-rata dari ${row.sessionCount} kuis`,
                  value: row.average,
                  suffix: "poin",
                }))}
              />
            ) : (
              <EmptyBlock
                title="Belum ada nilai kuis"
                description="Peringkat skor muncul setelah siswa menyelesaikan minimal satu sesi kuis."
                icon={<IconAward className="size-5" />}
              />
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[20px] border-border py-0 shadow-[0_8px_24px_rgb(15_23_42/0.05)] dark:shadow-none">
          <CardHeader className="p-5 pb-0 sm:p-6 sm:pb-0">
            <CardTitle className="text-base font-semibold text-foreground">
              Topik Paling Sulit
            </CardTitle>
            <CardDescription>
              Pertanyaan dengan tingkat jawaban salah tertinggi
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-4 sm:p-6 sm:pt-4">
            {isLoading ? (
              <div className="space-y-3">
                {[0, 1, 2, 3, 4].map((row) => (
                  <Skeleton key={row} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            ) : topTopics.length > 0 ? (
              <ul className="flex flex-col gap-3">
                {topTopics.slice(0, 5).map((topic) => (
                  <li
                    key={topic.questionId}
                    className="rounded-xl border border-border p-3"
                  >
                    <p className="line-clamp-2 text-sm font-medium text-foreground">
                      {topic.questionText}
                    </p>
                    <div className="mt-2 flex items-center gap-3">
                      <span
                        aria-hidden="true"
                        className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
                      >
                        <span
                          className="block h-full rounded-full bg-rose-500"
                          style={{
                            width: `${Math.min(100, topic.incorrectRate)}%`,
                          }}
                        />
                      </span>
                      <span className="shrink-0 text-xs font-semibold text-rose-600 dark:text-rose-400">
                        {topic.incorrectRate}% salah
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {topic.sessionTitle} · {topic.totalAnswers} jawaban
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyBlock
                title="Belum ada topik tersulit"
                description="Data ini muncul saat cukup banyak siswa menjawab kuis, sehingga tingkat kesulitan tiap soal bisa dihitung."
              />
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

// -------------------------------------------------------------
// Sub-komponen: tabel leaderboard ringkas.
// -------------------------------------------------------------
interface LeaderboardRow {
  rank: number;
  name: string;
  metric: string;
  value: number;
  suffix?: string;
}

function LeaderboardTable({ rows }: { rows: LeaderboardRow[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <Table>
        <TableHeader className="bg-muted text-muted-foreground">
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-12 px-3 py-2 text-center font-semibold">
              #
            </TableHead>
            <TableHead className="px-3 py-2 font-semibold">Siswa</TableHead>
            <TableHead className="px-3 py-2 text-right font-semibold">
              Skor
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={`${row.rank}-${row.name}`}>
              <TableCell className="px-3 py-3 text-center text-sm font-semibold text-muted-foreground">
                {row.rank}
              </TableCell>
              <TableCell className="px-3 py-3">
                <p className="text-sm font-medium text-foreground">
                  {row.name}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {row.metric}
                </p>
              </TableCell>
              <TableCell className="px-3 py-3 text-right text-sm font-semibold tabular-nums text-foreground">
                {row.value}
                {row.suffix ? ` ${row.suffix}` : ""}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>``
      </Table>
    </div>
  );
}

export default AnalyticsPage;