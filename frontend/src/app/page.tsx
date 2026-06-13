import { Logo } from "@/components/brand/logo";
import { PageMain, SiteHeader } from "@/components/site-header";
import { UploadForm } from "@/components/upload-form";
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
      <PageMain narrow>
        <section className="mb-12 space-y-8">
          {/* <Logo variant="lockup" href={null} priority className="mx-auto sm:mx-0" /> */}
          <div className="space-y-4 text-center sm:text-left">
            <p className="veluate-label">AI teacher evaluation</p>
            <h1 className="text-balance font-display text-4xl leading-[1.15] tracking-wide sm:text-[42px]">
              Where teaching meets understanding.
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-[#3d3d3d]">
              Upload a lecture, syllabus, and student exams. Veluate maps
              teaching moments to exam gaps with timestamped evidence.
            </p>
          </div>
        </section>

        <div className="mb-8 flex flex-wrap items-center gap-3 border border-border bg-card px-4 py-3 text-sm">
          <span className="veluate-label mb-0">System</span>
          {health ? (
            <>
              <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                <span className="size-1.5 bg-foreground" />
                Connected
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="font-data text-muted-foreground">
                {health.llm_provider}
                {health.llm_model ? ` / ${health.llm_model}` : ""}
              </span>
            </>
          ) : (
            <span className="text-foreground">{healthError}</span>
          )}
        </div>

        <UploadForm />
      </PageMain>
    </>
  );
}
