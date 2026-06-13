"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createJob } from "@/lib/api";

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
    <Card>
      <CardHeader>
        <CardTitle>Upload lecture materials</CardTitle>
        <CardDescription>
          Provide a lecture source, syllabus, and optional student exam papers for
          analysis.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="teacher">Teacher name</Label>
              <Input
                id="teacher"
                value={teacherName}
                onChange={(e) => setTeacherName(e.target.value)}
                placeholder="Dr Smith"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="audience">Target audience</Label>
              <Input
                id="audience"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                placeholder="Psychology undergrads"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="syllabus">Syllabus (PDF)</Label>
            <Input
              id="syllabus"
              type="file"
              accept="application/pdf"
              required
              onChange={(e) => setSyllabus(e.target.files?.[0] ?? null)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="videos">Lecture videos (optional if using YouTube)</Label>
            <Input
              id="videos"
              type="file"
              accept="video/*"
              multiple
              onChange={(e) => setVideos(Array.from(e.target.files ?? []))}
            />
            {videos.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {videos.length} video(s) selected
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>YouTube URLs</Label>
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
                />
                {youtubeUrls.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
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
              onClick={() => setYoutubeUrls([...youtubeUrls, ""])}
            >
              <Plus className="size-4" />
              Add URL
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="exams">Student exam papers (PDF, optional)</Label>
            <Input
              id="exams"
              type="file"
              accept="application/pdf"
              multiple
              onChange={(e) => setExams(Array.from(e.target.files ?? []))}
            />
            {exams.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {exams.length} exam paper(s) selected
              </p>
            )}
          </div>

          {error && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Starting analysis…
              </>
            ) : (
              "Run evaluation"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
