import { FlowCanvas } from "@/components/canvas/FlowCanvas";

interface CanvasPageProps {
  params: Promise<{ id: string }>;
}

export default async function CanvasPage({ params }: CanvasPageProps) {
  const { id } = await params;
  return <FlowCanvas graphId={id} />;
}
