import { ButtonLink, EmptyState } from "@/components/ui";

export default function AppNotFound() {
  return (
    <div className="mx-auto max-w-lg py-16">
      <EmptyState title="Record not found">
        <p>It may have been removed, or the link is wrong.</p>
        <div className="mt-4"><ButtonLink variant="secondary" href="/dashboard">Back to dashboard</ButtonLink></div>
      </EmptyState>
    </div>
  );
}
