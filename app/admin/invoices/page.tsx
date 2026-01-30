import InvoiceClient from "./InvoiceClient";

export default async function AdminInvoicesPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Invoices</h1>
        <p className="mt-1 text-sm text-slate-600">Create invoices, decrement inventory, and download PDFs.</p>
      </div>
      <InvoiceClient />
    </main>
  );
}
