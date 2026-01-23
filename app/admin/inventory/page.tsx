import InventoryClient from "./InventoryClient";

export default function AdminInventoryPage() {
  return (
    <main>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 10 }}>Inventory</h1>
      <p style={{ opacity: 0.85, marginBottom: 20 }}>
        Add stock and manage items.
      </p>
      <InventoryClient />
    </main>
  );
}
