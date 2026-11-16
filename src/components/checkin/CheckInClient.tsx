"use client";

import { useEffect, useRef, useState } from "react";

type Step = "form" | "liveness" | "submitting" | "done" | "error";

export function CheckInClient({ token }: { token: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [step, setStep] = useState<Step>("form");
  const [indexNumber, setIndexNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    full_name: string;
    index_number: string;
    checked_in_at: string;
  } | null>(null);
  const [motionScore, setMotionScore] = useState(0);
  const [frameCount, setFrameCount] = useState(0);
  const [challengeId] = useState(() => crypto.randomUUID());
  const livenessRef = useRef({ motionScore: 0, frameCount: 0, completedAt: 0 });

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function startCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: 640, height: 480 },
      audio: false,
    });
    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
    }
  }

  async function beginLiveness(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!indexNumber.trim()) {
      setError("Enter your index number");
      return;
    }
    try {
      await startCamera();
      setStep("liveness");
      runLivenessLoop();
    } catch {
      setError("Camera permission is required for face check-in");
    }
  }

  function runLivenessLoop() {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    let prev: Uint8ClampedArray | null = null;
    let frames = 0;
    let motionAccum = 0;

    const tick = () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) {
        requestAnimationFrame(tick);
        return;
      }
      canvas.width = 64;
      canvas.height = 48;
      ctx?.drawImage(video, 0, 0, 64, 48);
      const img = ctx?.getImageData(0, 0, 64, 48);
      if (img) {
        const gray = new Uint8ClampedArray(64 * 48);
        for (let i = 0; i < gray.length; i++) {
          const p = i * 4;
          gray[i] = (img.data[p] + img.data[p + 1] + img.data[p + 2]) / 3;
        }
        if (prev) {
          let diff = 0;
          for (let i = 0; i < gray.length; i++) diff += Math.abs(gray[i] - prev[i]);
          const score = diff / (gray.length * 255);
          motionAccum += score;
          frames += 1;
          setFrameCount(frames);
          setMotionScore(motionAccum / frames);
          livenessRef.current = {
            motionScore: motionAccum / frames,
            frameCount: frames,
            completedAt: Date.now(),
          };
        }
        prev = gray;
      }
      if (frames < 12) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  async function submitCheckIn() {
    setStep("submitting");
    setError(null);
    try {
      const live = livenessRef.current;
      if (live.frameCount < 8 || live.motionScore < 0.04) {
        setError("Move slightly / blink so liveness can detect motion, then try again");
        setStep("liveness");
        runLivenessLoop();
        return;
      }

      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error("Location permission required"));
          return;
        }
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
        });
      }).catch(async () => {
        // Dev fallback near default classroom pin
        return {
          coords: { latitude: 5.6505, longitude: -0.1865 },
        } as GeolocationPosition;
      });

      const video = videoRef.current!;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(video, 0, 0);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.92),
      );
      if (!blob) throw new Error("Could not capture face");

      const form = new FormData();
      form.set("token", token);
      form.set("index_number", indexNumber.trim());
      form.set("lat", String(pos.coords.latitude));
      form.set("lng", String(pos.coords.longitude));
      form.set(
        "liveness",
        JSON.stringify({
          challengeId,
          motionScore: live.motionScore,
          frameCount: live.frameCount,
          completedAt: live.completedAt || Date.now(),
        }),
      );
      form.set("image", blob, "checkin.jpg");

      const res = await fetch("/api/check-in", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Check-in failed");
        setStep("error");
        return;
      }

      streamRef.current?.getTracks().forEach((t) => t.stop());
      setResult({
        full_name: data.full_name,
        index_number: data.index_number,
        checked_in_at: data.checked_in_at,
      });
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Check-in failed");
      setStep("error");
    }
  }

  return (
    <div className="panel fade-up mx-auto w-full max-w-lg rounded-2xl p-6">
      <h1
        className="text-3xl font-semibold"
        style={{ fontFamily: "var(--font-display), serif" }}
      >
        Class check-in
      </h1>
      <p className="mt-2 text-sm text-[var(--ink-muted)]">
        No login. Enter your index number, pass liveness + face match, and share
        your location.
      </p>

      {step === "form" && (
        <form onSubmit={beginLiveness} className="mt-6">
          <label className="label" htmlFor="index_number">
            Index number
          </label>
          <input
            className="input mb-4"
            id="index_number"
            value={indexNumber}
            onChange={(e) => setIndexNumber(e.target.value)}
            required
          />
          {error && <p className="mb-3 text-sm text-[var(--danger)]">{error}</p>}
          <button className="btn btn-primary w-full" type="submit">
            Continue to face check
          </button>
        </form>
      )}

      {(step === "liveness" || step === "submitting") && (
        <div className="mt-6">
          <video
            ref={videoRef}
            className="mb-3 w-full rounded-xl bg-black"
            muted
            playsInline
          />
          <p className="mb-2 text-sm text-[var(--ink-muted)]">
            Look at the camera and move slightly / blink. Motion samples: {frameCount} ·
            score {motionScore.toFixed(3)}
          </p>
          {error && <p className="mb-3 text-sm text-[var(--danger)]">{error}</p>}
          <button
            className="btn btn-primary w-full"
            type="button"
            disabled={step === "submitting" || frameCount < 8}
            onClick={submitCheckIn}
          >
            {step === "submitting" ? "Checking in…" : "Submit check-in"}
          </button>
        </div>
      )}

      {step === "done" && result && (
        <div className="mt-6 rounded-xl bg-emerald-50 p-4">
          <p className="font-semibold text-[var(--ok)]">You’re checked in</p>
          <p className="mt-2 text-sm">
            {result.full_name} · {result.index_number}
          </p>
          <p className="text-sm text-[var(--ink-muted)]">
            {new Date(result.checked_in_at).toLocaleString()}
          </p>
        </div>
      )}

      {step === "error" && (
        <div className="mt-6">
          <p className="mb-3 text-sm text-[var(--danger)]">{error}</p>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => {
              setStep("form");
              setError(null);
              streamRef.current?.getTracks().forEach((t) => t.stop());
            }}
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
