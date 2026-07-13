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

export default function KnowledgeBaseHome() {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold">Browse articles</h2>
      <p className="mt-2 text-sm text-zinc-600">Select a section to view placeholders.</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {sections.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="rounded-xl border border-zinc-200 p-4 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
          >
            {section.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
