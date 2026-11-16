import { TicketDetailPage } from "@/features/projects";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TicketDetailPage id={id} />;
}
