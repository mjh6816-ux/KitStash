"use client";

import { useEffect, useRef, useState } from "react";

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
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    let html5QrCode: any = null;
    let isMounted = true;

    (async () => {
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
        if (!isMounted) return;

        html5QrCode = new Html5Qrcode(containerId);
        scannerRef.current = html5QrCode;

        const config = {
          fps: 22, // bumped for snappier detection on modern phones
          qrbox: { width: 420, height: 130 }, // generous wide rectangle for typical kit box 1D barcodes
          aspectRatio: 1.6,
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
          ],
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true, // uses native detector when available (big speed win on Chrome/Edge/Android)
          },
        };

        await html5QrCode.start(
          { facingMode: "environment" }, // prefer back camera
          config,
          (decodedText: string) => {
            if (!isMounted) return;
            // Successful scan - just notify parent.
            // Parent will close the scanner (unmounting this component),
            // and the cleanup will call stop().
            onDetected(decodedText.trim());
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
      } catch (err: any) {
        console.error("Failed to start barcode scanner:", err);
        const msg = err?.message || "Could not access camera. Please grant camera permission and try again.";
        if (isMounted) {
          setInitError(msg);
        }
        if (onError && isMounted) {
          onError(msg);
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

  if (initError) {
    return (
      <div className="p-4 text-center text-sm text-red-400 border border-red-500/50 rounded-xl bg-zinc-950">
        <p className="font-medium mb-1">Camera error</p>
        <p>{initError}</p>
        <p className="text-[10px] text-zinc-500 mt-2">Try closing and reopening the scanner, or check camera permissions in your browser settings.</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <div
        id={containerId}
        className="w-full max-w-[320px] mx-auto rounded-xl overflow-hidden border border-zinc-700 bg-black"
        style={{ minHeight: "220px" }}
      />
      <p className="mt-2 text-center text-[10px] text-zinc-500">
        Align the <strong>largest retail barcode</strong> (UPC/EAN, usually 12 digits) horizontally in the box.<br />
        Good lighting + steady hold helps a lot. Ignore smaller codes or QR codes on the box.
      </p>
    </div>
  );
}
