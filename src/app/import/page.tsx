import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ImportReviewForm } from "@/components/import-review-form";
import { buildImportPreview } from "@/lib/importer";
import { buildImportPreviewFromCapture, decodeCapturePayload } from "@/lib/capture";
import { listCollections, listTags } from "@/lib/store";

type ImportPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function pickParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ImportPage({ searchParams }: ImportPageProps) {
  const session = (await cookies()).get("kitchen-session");
  if (!session) {
    redirect("/");
  }

  const params = (await searchParams) ?? {};
  const url = pickParam(params.url);
  const capture = pickParam(params.capture);

  if (!url && !capture) {
    redirect("/");
  }

  const capturedPayload = capture ? decodeCapturePayload(capture) : null;

  const [preview, collections, tags] = await Promise.all([
    capturedPayload ? Promise.resolve(buildImportPreviewFromCapture(capturedPayload)) : buildImportPreview(url as string),
    listCollections(),
    listTags(),
  ]);

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <ImportReviewForm collections={collections} preview={preview} tags={tags} />
      </div>
    </main>
  );
}
