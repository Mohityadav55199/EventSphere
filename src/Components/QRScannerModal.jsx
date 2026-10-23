import React, { useEffect, useState, useRef, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import API from "../config/axios";
import { 
  X, 
  Camera, 
  CheckCircle2, 
  AlertTriangle, 
  RotateCcw, 
  Ticket, 
  User, 
  Sparkles, 
  Loader2, 
  Keyboard 
} from "lucide-react";

export default function QRScannerModal({ isOpen, onClose }) {
  const [scanResult, setScanResult] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [manualInput, setManualInput] = useState("");
  const [activeTab, setActiveTab] = useState("camera"); // "camera" | "manual"
  const html5QrCodeRef = useRef(null);

  const stopScanner = useCallback(async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        await html5QrCodeRef.current.clear();
      } catch {
        // ignore cleanup error
      }
      html5QrCodeRef.current = null;
    }
    setIsScanning(false);
  }, []);

  const verifyTicket = useCallback(async (payload, hash) => {
    setLoading(true);
    setError(null);
    try {
      const response = await API.post("/api/v1/bookings/checkin", { payload, hash });
      setScanResult({
        success: true,
        booking: response.data.data,
        message: response.data.message || "Ticket verified successfully!"
      });
      stopScanner();
    } catch (err) {
      console.error("Check-in verification error:", err);
      const errMsg = err?.response?.data?.message || err?.message || "Invalid or already checked-in ticket.";
      setScanResult({
        success: false,
        message: errMsg
      });
      stopScanner();
    } finally {
      setLoading(false);
    }
  }, [stopScanner]);

  const handleQrDecoded = useCallback((decodedText) => {
    try {
      const parsed = JSON.parse(decodedText);
      if (parsed.payload && parsed.hash) {
        verifyTicket(parsed.payload, parsed.hash);
      } else {
        setError("QR code does not contain valid EventSphere HMAC signature data.");
      }
    } catch {
      // If it's a raw payload:hash string
      if (decodedText.includes(":")) {
        const parts = decodedText.split(":");
        verifyTicket(parts.slice(0, -1).join(":"), parts[parts.length - 1]);
      } else {
        setError("Scanned QR code is not formatted for EventSphere admission.");
      }
    }
  }, [verifyTicket]);

  useEffect(() => {
    if (!isOpen || activeTab !== "camera") {
      stopScanner();
      return;
    }

    let isMounted = true;
    const scannerId = "qr-reader-viewport";

    const startScanner = async () => {
      try {
        setError(null);
        if (html5QrCodeRef.current) {
          try {
            await html5QrCodeRef.current.stop();
          } catch {
            // ignore
          }
        }

        const html5QrCode = new Html5Qrcode(scannerId);
        html5QrCodeRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            if (isMounted) {
              handleQrDecoded(decodedText);
            }
          },
          () => {
            // QR scan frame error ignored
          }
        );

        if (isMounted) setIsScanning(true);
      } catch (err) {
        console.warn("Camera start failed:", err);
        if (isMounted) {
          setError(
            err?.message || "Camera access denied or unavailable. Please switch to manual code entry tab."
          );
          setIsScanning(false);
        }
      }
    };

    // Give DOM a frame to render the div
    const timer = setTimeout(startScanner, 200);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      stopScanner();
    };
  }, [isOpen, activeTab, handleQrDecoded, stopScanner]);

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    handleQrDecoded(manualInput.trim());
  };

  const handleReset = () => {
    setScanResult(null);
    setError(null);
    setManualInput("");
    if (activeTab === "camera") {
      setActiveTab("manual");
      setTimeout(() => setActiveTab("camera"), 100);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden text-white flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Venue Gate Check-In</h2>
              <p className="text-xs text-slate-400">Scan QR code or enter ticket payload</p>
            </div>
          </div>
          <button
            onClick={() => {
              stopScanner();
              onClose();
            }}
            className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        {!scanResult && (
          <div className="flex border-b border-slate-800 bg-slate-950/40 px-6 pt-3">
            <button
              onClick={() => {
                setActiveTab("camera");
                setError(null);
              }}
              className={`pb-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition ${
                activeTab === "camera"
                  ? "border-indigo-500 text-indigo-400"
                  : "border-transparent text-slate-400 hover:text-slate-300"
              }`}
            >
              <Camera className="w-4 h-4" />
              <span>Camera Scanner</span>
            </button>
            <button
              onClick={() => {
                stopScanner();
                setActiveTab("manual");
                setError(null);
              }}
              className={`pb-3 ml-6 text-xs font-semibold flex items-center gap-2 border-b-2 transition ${
                activeTab === "manual"
                  ? "border-indigo-500 text-indigo-400"
                  : "border-transparent text-slate-400 hover:text-slate-300"
              }`}
            >
              <Keyboard className="w-4 h-4" />
              <span>Manual Entry / Paste</span>
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-4" />
              <div className="text-sm font-semibold text-white">Verifying HMAC Cryptographic Signature...</div>
              <div className="text-xs text-slate-400 mt-1">Checking ticket status against database records</div>
            </div>
          )}

          {!loading && scanResult && (
            <div className="text-center py-4">
              {scanResult.success ? (
                <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-2xl p-6 shadow-xl">
                  <div className="w-14 h-14 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-3">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-extrabold text-emerald-400">
                    ADMISSION APPROVED ✅
                  </h3>
                  <p className="text-xs text-emerald-200 mt-1 font-medium">
                    {scanResult.message}
                  </p>

                  <div className="mt-5 bg-slate-900/80 border border-emerald-500/20 rounded-xl p-4 text-left space-y-2 text-xs">
                    <div className="flex justify-between border-b border-slate-800 pb-2">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5" /> Attendee:
                      </span>
                      <span className="font-bold text-white">
                        {scanResult.booking?.user?.name || "Attendee"} ({scanResult.booking?.user?.email})
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-slate-800 pb-2">
                      <span className="text-slate-400">Event:</span>
                      <span className="font-semibold text-indigo-300">
                        {scanResult.booking?.event?.title || "Live Event"}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-slate-800 pb-2">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <Ticket className="w-3.5 h-3.5" /> Allocated Seats:
                      </span>
                      <span className="font-mono font-bold text-emerald-400">
                        {Array.isArray(scanResult.booking?.selectedSeats) 
                          ? scanResult.booking.selectedSeats.join(", ") 
                          : `${scanResult.booking?.seatsBooked || 1} Seat(s)`}
                      </span>
                    </div>
                    <div className="flex justify-between pt-1">
                      <span className="text-slate-400">Ticket Tier:</span>
                      <span className="font-semibold text-white">
                        {scanResult.booking?.ticketTier || "Standard Pass"}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={handleReset}
                    className="mt-6 w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm shadow-lg shadow-emerald-600/30 transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Scan Next Attendee</span>
                  </button>
                </div>
              ) : (
                <div className="bg-rose-950/40 border border-rose-500/40 rounded-2xl p-6 shadow-xl">
                  <div className="w-14 h-14 bg-rose-500/20 text-rose-400 rounded-full flex items-center justify-center mx-auto mb-3">
                    <AlertTriangle className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-extrabold text-rose-400">
                    ADMISSION DENIED ⛔
                  </h3>
                  <p className="text-xs text-rose-200 mt-2 font-medium leading-relaxed">
                    {scanResult.message}
                  </p>
                  <button
                    onClick={handleReset}
                    className="mt-6 w-full py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-sm shadow-lg shadow-rose-600/30 transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Try Another Scan</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {!loading && !scanResult && activeTab === "camera" && (
            <div className="flex flex-col items-center">
              <div 
                id="qr-reader-viewport" 
                className="w-full max-w-[320px] aspect-square rounded-2xl overflow-hidden border-2 border-indigo-500/50 shadow-inner bg-black"
              />
              <div className="flex items-center justify-between w-full max-w-[320px] mt-3 px-1 text-xs text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  Position ticket QR within frame
                </span>
                {isScanning && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[11px] font-semibold border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    Live
                  </span>
                )}
              </div>
            </div>
          )}

          {!loading && !scanResult && activeTab === "manual" && (
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Paste Scanned Ticket JSON or Hash
                </label>
                <textarea
                  rows={4}
                  placeholder='{"payload":"671a...","hash":"9f8c..."}'
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  className="w-full p-3.5 bg-slate-800/80 border border-slate-700 text-white font-mono text-xs rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none"
                />
              </div>
              <button
                type="submit"
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Ticket className="w-4 h-4" />
                <span>Verify & Admit Ticket</span>
              </button>
            </form>
          )}

          {error && (
            <div className="mt-4 p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
