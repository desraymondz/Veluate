"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createJob } from "@/lib/api";

function FieldGroup({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2.5 border-b border-border pb-6 last:border-0 last:pb-0">
      <div>
        <Label className="text-sm font-medium text-foreground">{label}</Label>
        {hint && (
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {hint}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}

export function UploadForm() {
  const router = useRouter();
  const [teacherName, setTeacherName] = useState("");
  const [audience, setAudience] = useState("");
  const [syllabus, setSyllabus] = useState<File | null>(null);
  const [videos, setVideos] = useState<File[]>([]);
  const [exams, setExams] = useState<File[]>([]);
  const [youtubeUrls, setYoutubeUrls] = useState<string[]>([""]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!syllabus) {
      setError("Syllabus PDF is required.");
      return;
    }
    if (!videos.length && !youtubeUrls.some((u) => u.trim())) {
      setError("Add at least one video file or YouTube URL.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await createJob({
        teacherName: teacherName.trim(),
        audience: audience.trim(),
        syllabus,
        videos,
        exams,
        youtubeUrls: youtubeUrls.map((u) => u.trim()).filter(Boolean),
      });
      router.push(`/jobs/${result.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create job");
      setSubmitting(false);
    }
  }

  return (
    <div className="veluate-panel overflow-hidden">
      <div className="border-b border-border px-6 py-5">
        <h2 className="font-display text-xl tracking-wide">Upload materials</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          All fields except exams are required for a full analysis.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-0 px-6 py-6">
        <div className="grid gap-0 sm:grid-cols-2 sm:gap-6">
          <FieldGroup label="Teacher name">
            <Input
              id="teacher"
              value={teacherName}
              onChange={(e) => setTeacherName(e.target.value)}
              placeholder="Dr Lee"
              className="h-10 bg-background"
              required
            />
          </FieldGroup>
          <FieldGroup label="Target audience">
            <Input
              id="audience"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              placeholder="Psychology undergrads"
              className="h-10 bg-background"
              required
            />
          </FieldGroup>
        </div>

        <div className="mt-6 space-y-0">
          <FieldGroup
            label="Syllabus"
            hint="PDF with course topics — used to map exam gaps."
          >
            <Input
              id="syllabus"
              type="file"
              accept="application/pdf"
              required
              className="h-10 bg-background file:font-medium"
              onChange={(e) => setSyllabus(e.target.files?.[0] ?? null)}
            />
          </FieldGroup>

          <FieldGroup
            label="Lecture video"
            hint="Upload a file or paste a YouTube URL below."
          >
            <Input
              id="videos"
              type="file"
              accept="video/*"
              multiple
              className="h-10 bg-background"
              onChange={(e) => setVideos(Array.from(e.target.files ?? []))}
            />
            {videos.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {videos.length} file(s) selected
              </p>
            )}
          </FieldGroup>

          <FieldGroup label="YouTube URL">
            <div className="space-y-2">
              {youtubeUrls.map((url, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    value={url}
                    onChange={(e) => {
                      const next = [...youtubeUrls];
                      next[i] = e.target.value;
                      setYoutubeUrls(next);
                    }}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="h-10 bg-background"
                  />
                  {youtubeUrls.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-10 shrink-0"
                      onClick={() =>
                        setYoutubeUrls(youtubeUrls.filter((_, idx) => idx !== i))
                      }
                    >
                      <X className="size-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9"
                onClick={() => setYoutubeUrls([...youtubeUrls, ""])}
              >
                <Plus className="size-4" />
                Add URL
              </Button>
            </div>
          </FieldGroup>

          <FieldGroup
            label="Student exams"
            hint="Optional — PDFs with answered exam papers for gap analysis."
          >
            <Input
              id="exams"
              type="file"
              accept="application/pdf"
              multiple
              className="h-10 bg-background"
              onChange={(e) => setExams(Array.from(e.target.files ?? []))}
            />
            {exams.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {exams.length} paper(s) selected
              </p>
            )}
          </FieldGroup>
        </div>

        {error && (
          <p className="mt-6 border border-border bg-muted px-4 py-3 text-sm text-foreground">
            {error}
          </p>
        )}

        <div className="mt-8 border-t border-border pt-6">
          <Button
            type="submit"
            className="h-11 w-full text-sm font-medium"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Starting analysis
              </>
            ) : (
              "Run evaluation"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
