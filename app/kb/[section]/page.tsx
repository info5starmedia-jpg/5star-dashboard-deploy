import Link from "next/link";

const labels: Record<string, string> = {
  "customer-dashboard": "Customer Dashboard",
  "data-center-and-accounts": "Data Center & Accounts",
  "errors-and-faq": "Errors & FAQ",
  "general-settings": "General Settings",
  "more-settings": "More Settings",
  "onboarding-guide": "Onboarding Guide",
  "product-settings": "Product Settings",
};

const placeholderArticles = [
  "Overview",
  "Getting started",
  "Common tasks",
  "Troubleshooting",
];

export default async function KnowledgeBaseSection({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  const label = labels[section] ?? "Knowledge Base";

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Section</p>
          <h2 className="text-lg font-semibold">{label}</h2>
        </div>
        <Link href="/kb" className="text-sm font-medium text-zinc-700 hover:text-zinc-900">
          ← Back to Knowledge Base
        </Link>
      </div>

      <p className="mt-3 text-sm text-zinc-600">
        Placeholder articles. Provide content later to replace these.
      </p>

      <ul className="mt-4 grid gap-2 text-sm text-zinc-700">
        {placeholderArticles.map((article) => (
          <li key={article} className="rounded-lg border border-zinc-200 px-3 py-2">
            {article}
          </li>
        ))}
      </ul>
    </div>
  );
}
