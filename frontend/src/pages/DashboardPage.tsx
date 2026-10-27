import { Link } from "react-router";

import { useDashboardStats } from "../api/dashboard";
import { FunnelChart } from "../components/dashboard/FunnelChart";
import { PipelineTiles } from "../components/dashboard/PipelineTiles";
import { ResumePerformanceTable } from "../components/dashboard/ResumePerformanceTable";
import { WeeklyChart } from "../components/dashboard/WeeklyChart";
import { ui } from "../components/ui";

export function DashboardPage() {
  const stats = useDashboardStats();

  if (stats.isPending) return <p className="text-slate-500">Loading…</p>;
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
        <p className="text-slate-500">Add your first application to start tracking your search.</p>
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
        <section className={`${ui.card} space-y-3`}>
          <div>
            <h2 className="font-semibold">Funnel</h2>
            <p className="text-sm text-slate-500">
              Share of {data.funnel.total} applications that ever reached each stage.
            </p>
          </div>
          <FunnelChart stages={data.funnel.stages} />
        </section>
        <section className={`${ui.card} space-y-3`}>
          <div>
            <h2 className="font-semibold">Applications per week</h2>
            <p className="text-sm text-slate-500">Last 12 weeks, by date applied.</p>
          </div>
          <WeeklyChart weeks={data.per_week} />
        </section>
      </div>
      <section className={`${ui.card} space-y-3`}>
        <h2 className="font-semibold">Resume performance</h2>
        <ResumePerformanceTable rows={data.resume_performance} />
      </section>
    </div>
  );
}
