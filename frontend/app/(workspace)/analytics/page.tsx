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
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
import {
  getAnalyticsParticipationTrend,
  getAnalyticsScores,
  getAnalyticsStudents,
  getAnalyticsSummary,
  getAnalyticsTopics,
  type AnalyticsSummary,
  type ParticipationTrendPeriod,
  type ParticipationTrendPoint,
  type StudentParticipation,
  type StudentScore,
  type TopTopic,
} from "@/lib/api";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const TREND_RANGES: { value: ParticipationTrendPeriod; label: string }[] = [
  { value: "7d", label: "7 hari" },
  { value: "14d", label: "14 hari" },
  { value: "30d", label: "30 hari" },
];

const timeFormatter = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
});

const participationConfig = {
  participants: { label: "Siswa berpartisipasi", color: "var(--chart-2)" },
} satisfies ChartConfig;

const topicsConfig = {
  incorrectRate: { label: "Jawaban salah", color: "var(--chart-4)" },
} satisfies ChartConfig;

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
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [studentScores, setStudentScores] = useState<StudentScore[]>([]);
  const [studentParticipation, setStudentParticipation] = useState<
    StudentParticipation[]
  >([]);
  const [topTopics, setTopTopics] = useState<TopTopic[]>([]);
  const [participationTrend, setParticipationTrend] = useState<
    ParticipationTrendPoint[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [trendRange, setTrendRange] = useState<ParticipationTrendPeriod>("7d");
  const [leaderboardTab, setLeaderboardTab] = useState<
    "active" | "top-score"
  >("active");
  const requestRef = useRef(false);

  const loadSessions = useCallback(
    async ({ force = false }: { force?: boolean } = {}) => {
      if (requestRef.current) return;

      requestRef.current = true;
      if (force) setIsRefreshing(true);
      else setIsLoading(true);

      try {
        const [summaryResult, scoresResult, studentsResult, topicsResult, trendResult] =
          await Promise.allSettled([
            getAnalyticsSummary("all"),
            getAnalyticsScores("all"),
            getAnalyticsStudents("all"),
            getAnalyticsTopics("all", 5),
            getAnalyticsParticipationTrend(trendRange),
          ] as const);

        if (summaryResult.status === "fulfilled") {
          setSummary(summaryResult.value);
        }
        if (scoresResult.status === "fulfilled") {
          setStudentScores(scoresResult.value);
        }
        if (studentsResult.status === "fulfilled") {
          setStudentParticipation(studentsResult.value);
        }
        if (topicsResult.status === "fulfilled") {
          setTopTopics(topicsResult.value);
        }
        if (trendResult.status === "fulfilled") {
          setParticipationTrend(trendResult.value);
        }

        const failures: string[] = [];
        if (summaryResult.status === "rejected") failures.push("ringkasan");
        if (scoresResult.status === "rejected") failures.push("skor");
        if (studentsResult.status === "rejected") {
          failures.push("partisipasi siswa");
        }
        if (topicsResult.status === "rejected") {
          failures.push("topik tersulit");
        }
        if (trendResult.status === "rejected") {
          failures.push("tren partisipasi");
        }

        const stamp = Date.now();
        setFetchedAt(stamp);
        setErrorMessage(
          failures.length > 0
            ? `Sebagian data tidak dapat dimuat: ${failures.join(", ")}.`
            : null,
        );
      } finally {
        requestRef.current = false;
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [trendRange],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => void loadSessions(), 0);
    return () => window.clearTimeout(timer);
  }, [loadSessions]);

  const hasParticipationData = participationTrend.some(
    (point) => point.participants > 0,
  );

  const scoreByStudent = useMemo(() => {
    const totals = new Map<
      string,
      { studentName: string; scoreTotal: number; sessionCount: number }
    >();

    studentScores.forEach((score) => {
      const existing = totals.get(score.studentKey) ?? {
        studentName: score.studentName,
        scoreTotal: 0,
        sessionCount: 0,
      };
      existing.scoreTotal += score.score;
      existing.sessionCount += 1;
      totals.set(score.studentKey, existing);
    });

    return new Map(
      [...totals.entries()].map(([studentKey, student]) => [
        studentKey,
        {
          studentName: student.studentName,
          average: Math.round(student.scoreTotal / student.sessionCount),
          sessionCount: student.sessionCount,
        },
      ]),
    );
  }, [studentScores]);

  const topScoreLeaderboard = useMemo(
    () => {
      return [...scoreByStudent.entries()]
        .map(([studentKey, student]) => ({
          studentKey,
          studentName: student.studentName,
          average: student.average,
          sessionCount: student.sessionCount,
        }))
        .sort((first, second) => second.average - first.average)
        .slice(0, 10);
    },
    [scoreByStudent],
  );

  const activeLeaderboard = useMemo(
    () =>
      [...studentParticipation]
        .sort(
          (first, second) =>
            second.questionsAsked + second.responsesSubmitted -
            (first.questionsAsked + first.responsesSubmitted) ||
            second.sessionsJoined - first.sessionsJoined,
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
      "student_name,sessions_joined,questions_asked,responses_submitted,average_score",
    );

    const scoreByStudentName = new Map(
      [...scoreByStudent.entries()].map(([studentKey, student]) => [
        studentKey,
        student.average,
      ]),
    );

    studentParticipation.forEach((p) => {
      rows.push(
        [
          `"${p.studentName.replaceAll('"', '""')}"`,
          p.sessionsJoined,
          p.questionsAsked,
          p.responsesSubmitted,
          scoreByStudentName.get(p.studentKey) ?? "",
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
        label: "Total Siswa",
        value: summary ? String(summary.totalStudents) : "-",
        detail: "Siswa unik di seluruh sesi",
      },
      {
        label: "Rata-rata Skor Kuis",
        value: summary ? `${Math.round(summary.averageScore)}%` : "-",
        detail:
          summary
            ? `Dari ${studentScores.length} rekap siswa-sesi`
            : "Menunggu data jawaban kuis",
      },
      {
        label: "Tingkat Partisipasi",
        value: summary ? `${Math.round(summary.participationRate)}%` : "-",
        detail:
          summary
            ? "Siswa yang berpartisipasi di sesi yang diikuti"
            : "Menunggu data respons",
      },
      {
        label: "Sesi Dianalisis",
        value: summary ? String(summary.totalSessions) : "-",
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
          <Button
            variant="outline"
            size="sm"
            disabled
            aria-label="Ekspor PDF"
          >
            <IconDownload className="size-4" />
            Ekspor PDF
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

      {/* Tren partisipasi harian. */}
      <Card className="mt-6 rounded-[20px] border-border py-0 shadow-[0_8px_24px_rgb(15_23_42/0.05)] dark:shadow-none">
        <CardHeader className="p-5 pb-0 sm:p-6 sm:pb-0">
          <CardTitle className="text-base font-semibold text-foreground">
            Tren Partisipasi Siswa
          </CardTitle>
          <CardDescription>
            Siswa unik yang bergabung per hari
          </CardDescription>
          <CardAction>
            <Tabs
              value={trendRange}
              onValueChange={(value) =>
                setTrendRange(value as ParticipationTrendPeriod)
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
            <Skeleton className="h-56 w-full rounded-xl" />
          ) : hasParticipationData ? (
            <ChartContainer
              config={participationConfig}
              className="h-56 w-full aspect-auto"
            >
              <AreaChart
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
                <Area
                  type="monotone"
                  dataKey="participants"
                  stroke="var(--color-participants)"
                  fill="var(--color-participants)"
                  fillOpacity={0.18}
                  strokeWidth={2}
                />
              </AreaChart>
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

      {/* Topik tersulit berdasarkan persentase jawaban salah. */}
      <Card className="mt-6 rounded-[20px] border-border py-0 shadow-[0_8px_24px_rgb(15_23_42/0.05)] dark:shadow-none">
        <CardHeader className="p-5 pb-0 sm:p-6 sm:pb-0">
          <CardTitle className="text-base font-semibold text-foreground">
            Topik Paling Sulit
          </CardTitle>
          <CardDescription>
            Persentase jawaban salah per soal kuis
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5 pt-4 sm:p-6 sm:pt-4">
          {isLoading ? (
            <Skeleton className="h-72 w-full rounded-xl" />
          ) : topTopics.length > 0 ? (
            <ChartContainer
              config={topicsConfig}
              className="h-72 w-full aspect-auto"
            >
              <BarChart
                data={topTopics.slice(0, 5)}
                layout="vertical"
                margin={{ top: 8, right: 24, left: 8, bottom: 0 }}
              >
                <CartesianGrid horizontal={false} />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value: number) => `${value}%`}
                />
                <YAxis
                  type="category"
                  dataKey="questionText"
                  tickLine={false}
                  axisLine={false}
                  width={220}
                  tickFormatter={(value: string) =>
                    value.length > 40 ? `${value.slice(0, 40)}…` : value
                  }
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="incorrectRate"
                  fill="var(--color-incorrectRate)"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ChartContainer>
          ) : (
            <EmptyBlock
              title="Belum ada topik tersulit"
              description="Topik muncul setelah minimal lima jawaban tercatat untuk satu soal kuis."
            />
          )}
        </CardContent>
      </Card>

      {/* Leaderboard global siswa. */}
      <Card className="mt-6 rounded-[20px] border-border py-0 shadow-[0_8px_24px_rgb(15_23_42/0.05)] dark:shadow-none">
        <CardHeader className="p-5 pb-0 sm:p-6 sm:pb-0">
          <CardTitle className="text-base font-semibold text-foreground">
            Papan Peringkat Siswa
          </CardTitle>
          <CardDescription>
            Peringkat lintas sesi berdasarkan aktivitas dan rata-rata kuis
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