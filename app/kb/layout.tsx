import Link from "next/link";

const sections = [
  { href: "/kb/customer-dashboard", label: "Customer Dashboard" },
  { href: "/kb/data-center-and-accounts", label: "Data Center & Accounts" },
  { href: "/kb/errors-and-faq", label: "Errors & FAQ" },
  { href: "/kb/general-settings", label: "General Settings" },
  { href: "/kb/more-settings", label: "More Settings" },
  { href: "/kb/onboarding-guide", label: "Onboarding Guide" },
  { href: "/kb/product-settings", label: "Product Settings" },
];

export default function KnowledgeBaseLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Knowledge Base</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Read-only guides. Content will be added later.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Sections</div>
          <nav className="mt-3 grid gap-2 text-sm">
            {sections.map((section) => (
              <Link
                key={section.href}
                href={section.href}
                className="rounded-md px-2 py-1.5 text-zinc-700 hover:bg-zinc-100"
              >
                {section.label}
              </Link>
            ))}
          </nav>
        </aside>

        <section>{children}</section>
      </div>
    </div>
  );
}
