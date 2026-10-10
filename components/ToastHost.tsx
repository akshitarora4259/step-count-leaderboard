"use client";

import { useEffect, useRef, useState } from "react";
import { subscribeToast } from "@/lib/toastBus";

const AUTO_DISMISS_MS = 2200;

export function ToastHost() {
  const [message, setMessage] = useState("");
  const [show, setShow] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return subscribeToast((next) => {
      setMessage(next);
      setShow(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setShow(false), AUTO_DISMISS_MS);
    });
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <div id="toast" role="status" aria-live="polite" className={show ? "show" : ""}>
      {message}
    </div>
  );
}
