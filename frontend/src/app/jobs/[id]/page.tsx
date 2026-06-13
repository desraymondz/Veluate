import { notFound } from "next/navigation";

import { JobView } from "@/components/job-view";
import { PageMain, SiteHeader } from "@/components/site-header";
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
      <PageMain>
        <JobView jobId={id} initialJob={job} />
      </PageMain>
    </>
  );
}
