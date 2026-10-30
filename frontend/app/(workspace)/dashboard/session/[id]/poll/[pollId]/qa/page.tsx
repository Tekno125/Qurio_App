'use client'

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { fetchQuestionList } from "@/lib/api"

interface QuestionItem {
  id: string
  poll_id: string
  participant_id: string
  text?: string
  question_text?: string
  created_at?: string
  participant_name?: string
  answered?: boolean
}

export default function QaPollPage() {
  const params = useParams()
  const sessionId = params?.id as string
  const pollId = params?.pollId as string
  const [questions, setQuestions] = useState<QuestionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!pollId) return

    const loadQuestions = async () => {
      try {
        setLoading(true)
        const response = await fetchQuestionList(pollId)
        const data = Array.isArray(response?.data) ? response.data : Array.isArray(response) ? response : []
        setQuestions(data)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal mengambil daftar pertanyaan")
      } finally {
        setLoading(false)
      }
    }

    void loadQuestions()
  }, [pollId])

  const markAsAnswered = (id: string) => {
    setQuestions((prev) => prev.map((q) => q.id === id ? { ...q, answered: true } : q))
  }

  return (
    <div className="min-h-screen bg-background p-6 text-foreground">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="rounded-xl border border-border bg-card p-5">
          <h1 className="text-2xl font-black text-foreground">Daftar Pertanyaan</h1>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">{error}</div>
        )}

        {loading ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">Memuat pertanyaan...</div>
        ) : questions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
            Belum ada pertanyaan masuk untuk poll ini.
          </div>
        ) : (
          <div className="space-y-4">
            {questions.map((item, index) => {
              const questionText = item.text ?? item.question_text ?? "Pertanyaan tidak tersedia"

              return (
                <div key={item.id || `${item.participant_id}-${index}`} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                  <div className="flex justify-between items-start gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">#{index + 1} • {item.participant_name || item.participant_id}</p>
                      <p className="mt-2 text-base font-medium text-foreground">{questionText}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => markAsAnswered(item.id)}
                      className={`rounded-full border px-3 py-1.5 text-xs ${item.answered ? "border-green-200 bg-green-100 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300" : "border-border bg-muted text-muted-foreground hover:bg-accent"}`}
                    >
                      {item.answered ? "Answered" : "Mark as answered"}
                    </button>
                  </div>
                  {item.created_at && (
                    <p className="mt-3 text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString("id-ID")}</p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
