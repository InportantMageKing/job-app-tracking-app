import { Link } from "react-router";

import { useDashboardStats } from "../api/dashboard";
import { FunnelChart } from "../components/dashboard/FunnelChart";
import { PipelineTiles } from "../components/dashboard/PipelineTiles";
import { ResumePerformanceTable } from "../components/dashboard/ResumePerformanceTable";
import { WeeklyChart } from "../components/dashboard/WeeklyChart";
import { ui } from "../components/ui";

export function DashboardPage() {
  const stats = useDashboardStats();

  if (stats.isPending) return <p className={ui.muted}>Loading…</p>;
  if (stats.isError) {
    return (
      <p role="alert" className={ui.error}>
        {stats.error.message}
      </p>
    );
  }

  const data = stats.data;

  if (data.funnel.total === 0) {
    return (
      <div className={`${ui.card} space-y-3 text-center`}>
        <h1 className={ui.heading}>No applications yet</h1>
        <p className={ui.muted}>Add your first application to start tracking your search.</p>
        <Link to="/applications/new" className={ui.primary}>
          New application
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className={ui.heading}>Dashboard</h1>
      <PipelineTiles pipeline={data.pipeline} />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className={`${ui.card} space-y-5`}>
          <div>
            <h2 className={ui.subheading}>Funnel</h2>
            <p className={ui.muted}>
              Share of <span className={ui.data}>{data.funnel.total}</span> applications that ever reached each stage.
            </p>
          </div>
          <FunnelChart stages={data.funnel.stages} />
        </section>
        <section className={`${ui.card} space-y-5`}>
          <div>
            <h2 className={ui.subheading}>Applications per week</h2>
            <p className={ui.muted}>Last 12 weeks, by date applied.</p>
          </div>
          <WeeklyChart weeks={data.per_week} />
        </section>
      </div>
      <section className={`${ui.card} space-y-5`}>
        <h2 className={ui.subheading}>Resume performance</h2>
        <ResumePerformanceTable rows={data.resume_performance} />
      </section>
    </div>
  );
}
