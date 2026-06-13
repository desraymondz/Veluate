import { notFound } from "next/navigation";

import { JobView } from "@/components/job-view";
import { SiteHeader } from "@/components/site-header";
import { getJob } from "@/lib/api";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function JobPage({ params }: Props) {
  const { id } = await params;

  let job;
  try {
    job = await getJob(id);
  } catch {
    notFound();
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6">
        <JobView jobId={id} initialJob={job} />
      </main>
    </>
  );
}
