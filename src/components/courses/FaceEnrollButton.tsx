"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function FaceEnrollButton({
  courseId,
  studentId,
  indexNumber,
}: {
  courseId: string;
  studentId: string;
  indexNumber: string;
}) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: 640, height: 480 },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch {
        setError("Camera permission required for face enrollment");
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [open]);

  async function enrollBlob(blob: Blob) {
    setLoading(true);
    setError(null);
    const form = new FormData();
    form.set("studentId", studentId);
    form.set("courseId", courseId);
    form.set("image", blob, "enroll.jpg");

    const res = await fetch("/api/students/enroll-face", { method: "POST", body: form });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Enrollment failed");
      return;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setOpen(false);
    router.refresh();
  }

  async function captureAndEnroll() {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setError("Could not capture frame");
      return;
    }
    ctx.drawImage(videoRef.current, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.92),
    );
    if (!blob) {
      setError("Could not encode capture");
      return;
    }
    await enrollBlob(blob);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await enrollBlob(file);
  }

  return (
    <div>
      {!open ? (
        <button className="btn btn-secondary" type="button" onClick={() => setOpen(true)}>
          Enroll face
        </button>
      ) : (
        <div className="panel mt-2 rounded-xl p-3">
          <p className="mb-2 text-sm text-[var(--ink-muted)]">
            Enroll face for {indexNumber}. Only the embedding is stored — the photo is discarded.
          </p>
          <video ref={videoRef} className="mb-3 w-full max-w-xs rounded-lg bg-black" muted playsInline />
          {error && <p className="mb-2 text-sm text-[var(--danger)]">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary" disabled={loading} type="button" onClick={captureAndEnroll}>
              {loading ? "Saving…" : "Capture & save embedding"}
            </button>
            <label className="btn btn-secondary cursor-pointer">
              Upload photo
              <input className="hidden" type="file" accept="image/*" onChange={onFile} />
            </label>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => {
                streamRef.current?.getTracks().forEach((t) => t.stop());
                setOpen(false);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
