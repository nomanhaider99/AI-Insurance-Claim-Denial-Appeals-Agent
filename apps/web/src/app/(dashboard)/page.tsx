import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiStatusCard } from '@/components/api-status-card';

const placeholders = [
  { title: 'Open denials', description: 'Claims awaiting an appeal decision' },
  { title: 'Appeals in review', description: 'Drafts waiting for human approval' },
  { title: 'Deadlines this week', description: 'Appeals due in the next 7 days' },
];

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ApiStatusCard />
        {placeholders.map((p) => (
          <Card key={p.title}>
            <CardHeader>
              <CardTitle>{p.title}</CardTitle>
              <CardDescription>{p.description}</CardDescription>
            </CardHeader>
            <CardContent className="text-3xl font-semibold">—</CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
