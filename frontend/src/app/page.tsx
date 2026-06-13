import { Button } from "@/components/ui/button";
import { getHealth } from "@/lib/api";

export default async function Home() {
  let health = null;
  let error = null;

  try {
    health = await getHealth();
  } catch (e) {
    error = e instanceof Error ? e.message : "Backend unreachable";
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-background px-6 py-24">
      <main className="w-full max-w-lg space-y-8 text-center">
        <div className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
            Teacher Evaluation
          </p>
          <h1 className="text-4xl font-bold tracking-tight">Veluate</h1>
          <p className="text-muted-foreground">
            AI-powered lecture analysis with exam cross-reference.
          </p>
        </div>

        <div className="rounded-xl border bg-card p-6 text-left shadow-sm">
          <p className="mb-3 text-sm font-medium">Backend status</p>
          {health ? (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">API</dt>
                <dd className="font-mono text-green-600">{health.status}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">LLM provider</dt>
                <dd className="font-mono">{health.llm_provider}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">LLM model</dt>
                <dd className="font-mono">
                  {health.llm_model || "(default)"}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <Button disabled className="w-full">
          Upload lecture — coming in Phase 7
        </Button>
      </main>
    </div>
  );
}
