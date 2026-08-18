import { ProjectDocuments } from "@/components/project/ProjectDocuments";

export default async function ProjectDocumentsPage({
  params,
}: PageProps<"/projects/[projectId]">) {
  const { projectId } = await params;
  return <ProjectDocuments projectId={projectId} />;
}
