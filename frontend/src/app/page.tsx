import { SiteHeader } from "@/components/site-header";
import { UploadForm } from "@/components/upload-form";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getHealth } from "@/lib/api";

export default async function HomePage() {
  let health = null;
  let healthError = null;

  try {
    health = await getHealth();
  } catch (e) {
    healthError = e instanceof Error ? e.message : "Backend unreachable";
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
        <div className="mb-8 space-y-2 text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
            AI-powered teacher evaluation
          </p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Analyse teaching. Link to exam gaps.
          </h1>
          <p className="text-muted-foreground">
            Upload a lecture, syllabus, and student exams to get evidence-based
            feedback with timestamped video clips.
          </p>
        </div>

        <div className="mb-6">
          <Card size="sm">
            <CardHeader>
              <CardTitle className="text-sm">Backend</CardTitle>
              <CardDescription>API connection status</CardDescription>
            </CardHeader>
            <CardContent>
              {health ? (
                <div className="flex flex-wrap gap-2">
                  <Badge variant="default">{health.status}</Badge>
                  <Badge variant="outline">{health.llm_provider}</Badge>
                  <Badge variant="outline">
                    {health.llm_model || "default model"}
                  </Badge>
                </div>
              ) : (
                <p className="text-sm text-destructive">{healthError}</p>
              )}
            </CardContent>
          </Card>
        </div>

        <UploadForm />
      </main>
    </>
  );
}
