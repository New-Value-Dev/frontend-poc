import { DocumentDetail } from "@/components/document/DocumentDetail";

export default async function DocumentDetailPage({
  params,
}: PageProps<"/documents/[docId]">) {
  const { docId } = await params;
  return <DocumentDetail docId={docId} />;
}
