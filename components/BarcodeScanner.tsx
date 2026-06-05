"use client";

import { useEffect, useRef } from "react";

interface BarcodeScannerProps {
  onDetected: (code: string) => void;
  onError?: (err: string) => void;
  onClose?: () => void;
  // If true, stops after first successful detection (good for lookup and form fill)
  stopOnFirstDetection?: boolean;
}

export default function BarcodeScanner({
  onDetected,
  onError,
  onClose,
  stopOnFirstDetection = true,
}: BarcodeScannerProps) {
  const scannerRef = useRef<any>(null);
  const containerId = "barcode-scanner-container";

  useEffect(() => {
    let html5QrCode: any = null;
    let isMounted = true;

    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (!isMounted) return;

        html5QrCode = new Html5Qrcode(containerId);
        scannerRef.current = html5QrCode;

        const config = {
          fps: 10,
          qrbox: { width: 250, height: 150 }, // good for 1D barcodes on boxes
          aspectRatio: 1.5,
        };

        await html5QrCode.start(
          { facingMode: "environment" }, // prefer back camera
          config,
          (decodedText: string) => {
            if (!isMounted) return;
            // Successful scan
            onDetected(decodedText.trim());

            if (stopOnFirstDetection) {
              // Stop scanning after first good read
              html5QrCode
                .stop()
                .then(() => {
                  if (onClose && isMounted) onClose();
                })
                .catch(() => {
                  if (onClose && isMounted) onClose();
                });
            }
          },
          (errorMessage: string) => {
            if (!isMounted) return;
            // Ignore frequent "no code found" messages; only surface real errors
            if (
              onError &&
              !errorMessage.includes("No QR code found") &&
              !errorMessage.includes("No barcode found")
            ) {
              onError(errorMessage);
            }
          }
        );
      } catch (err) {
        console.error("Failed to start barcode scanner:", err);
        if (onError && isMounted) {
          onError("Could not access camera. Please grant camera permission and try again.");
        }
      }
    })();

    // Cleanup on unmount
    return () => {
      isMounted = false;
      if (scannerRef.current) {
        scannerRef.current
          .stop()
          .catch(() => {
            /* ignore */
          });
      }
    };
  }, [onDetected, onError, onClose, stopOnFirstDetection]);

  return (
    <div className="relative">
      <div
        id={containerId}
        className="w-full max-w-[320px] mx-auto rounded-xl overflow-hidden border border-zinc-700 bg-black"
        style={{ minHeight: "220px" }}
      />
      <p className="mt-2 text-center text-[10px] text-zinc-500">
        Point camera at the barcode on the box. Works best in good lighting.
      </p>
    </div>
  );
}
