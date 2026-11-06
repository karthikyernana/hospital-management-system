"use client";

import { Alert, Button } from "@/components/ui";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg py-10">
      <Alert title="Something went wrong">
        <p>{error.digest ? `Reference: ${error.digest}` : "An unexpected error occurred while loading this page."}</p>
      </Alert>
      <Button className="mt-4" onClick={reset}>Try again</Button>
    </div>
  );
}
