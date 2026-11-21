import type { CoachFeedback } from "@/lib/setra/types";

const feedbackTime = (value: string) =>
  new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));

export function CoachFeedbackCard({ feedback }: { feedback: CoachFeedback }) {
  return (
    <section className="coach-feedback-card">
      <span>COACH FEEDBACK</span>
      <p>{feedback.text}</p>
      <small>
        <b>{feedback.coachName}</b> · {feedbackTime(feedback.updatedAt)}
      </small>
    </section>
  );
}
