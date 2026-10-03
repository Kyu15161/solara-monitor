"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="loading-page">
      <h1>We couldn’t load this view.</h1>
      <p>
        Your saved data has not been changed. Check that the database and
        application are running.
      </p>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
