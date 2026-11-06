"use client";

import ErrorScreen from "@/components/ErrorScreen";

export default function Error({ error }: { error: Error & { digest?: string } }) {
  return <ErrorScreen error={error} />;
}
