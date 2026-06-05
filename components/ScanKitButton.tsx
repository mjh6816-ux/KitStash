"use client";

import { Button } from "@/components/ui/button";

export default function ScanKitButton() {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        // Quick global way to trigger barcode scanner for kit lookup from dashboard
        // This will be picked up by the always-mounted GlobalSearch logic or InventoryClient
        const searchBtn = document.querySelector('[title*="Global search"]') as HTMLElement;
        if (searchBtn) searchBtn.click();
        // After search opens, user can tap the 📷 Scan inside it.
        // For direct, we dispatch the lookup trigger (handled in InventoryClient when on /inventory)
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent("trigger-barcode-lookup"));
        }, 300);
      }}
    >
      📷 Scan Kit
    </Button>
  );
}
