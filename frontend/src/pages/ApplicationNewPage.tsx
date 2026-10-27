import { Link, useNavigate } from "react-router";

import { useCreateApplication } from "../api/applications";
import { ApplicationForm } from "../components/ApplicationForm";
import { ui } from "../components/ui";

export function ApplicationNewPage() {
  const create = useCreateApplication();
  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      <Link to="/applications" className="text-sm text-slate-500 hover:underline">
        ← All applications
      </Link>
      <h1 className={ui.heading}>New application</h1>
      <section className={ui.card}>
        <ApplicationForm
          submitLabel="Create application"
          onSubmit={async (input) => {
            const created = await create.mutateAsync(input);
            navigate(`/applications/${created.id}`);
          }}
          onCancel={() => navigate("/applications")}
        />
      </section>
    </div>
  );
}
