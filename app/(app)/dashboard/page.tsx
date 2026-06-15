"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// The platform is project-first for every role: standalone dashboards were
// replaced by per-project views (admins get the Analytics tab inside each
// project). This route survives only to catch old links/bookmarks.
export default function DashboardPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/projects");
  }, [router]);
  return null;
}
