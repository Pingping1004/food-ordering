"use client";

import { useEffect } from "react";
import { checkStorageVersion } from "@/lib/storage/version";

export default function StorageGuard() {
  useEffect(() => {
    checkStorageVersion();
  }, []);

  return null;
}