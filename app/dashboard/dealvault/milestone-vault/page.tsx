import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getDealVaultAdmin } from "@/lib/dealvault/server";
import { getDealVaultUser } from "@/lib/dealvault/auth";

export default async function DealVaultMilestoneVaultPage() {
  const user = await getDealVaultUser();
  const admin = getDealVaultAdmin();
  let projects: Array<{ id: string; title: string | null; status: string | null; total_amount: number | null }> = [];

  if (user?.profileId) {
    try {
      const { data } = await admin
        .from("dealvault_milestone_projects")
        .select("id,title,status,total_amount")
        .eq("user_id", user.profileId)
        .order("created_at", { ascending: false })
        .limit(10);
      projects = (data as typeof projects) || [];
    } catch {
      // ignore until schema is applied
    }
  }

  return (
    <main className="space-y-6 p-4 md:p-8">
      <div className="space-y-2">
        <Badge variant="outline">Milestone Vault</Badge>
        <h1 className="text-3xl font-semibold tracking-tight">Milestone tracking</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Track contractor draws, rehab milestones, and proof-backed approvals from a single DealVault
          project timeline.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Project milestone pipeline</CardTitle>
          <CardDescription>
            This route will host milestone project lists, approval timelines, dispute handling, and
            proof attachments.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Next wiring steps: project creation, milestone CRUD, proof submission, and approval status
          transitions.
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent milestone projects</CardTitle>
          <CardDescription>Active contractor and rehab projects in DealVault.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {projects.length ? (
            projects.map((project) => (
              <div key={project.id} className="rounded-lg border p-3">
                <p className="font-medium">{project.title || "Untitled project"}</p>
                <p className="text-sm text-muted-foreground">
                  {project.status || "active"} · {project.total_amount ?? 0}
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No milestone projects found yet.</p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
