import InventoryClient from "./InventoryClient";

export default function AdminInventoryPage() {
  return (
    <main>
      <h1 className="text-3xl font-extrabold text-orange-400 tracking-tight">Inventory</h1>
      <p className="mt-2 mb-6 text-base font-semibold text-orange-300">
        Add stock and manage items.
      </p>
      <InventoryClient />
    </main>
  );
}
