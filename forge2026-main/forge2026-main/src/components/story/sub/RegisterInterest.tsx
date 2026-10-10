import { useId, useState } from "react";
import { ArrowRightIcon, CheckCircleIcon } from "@phosphor-icons/react";
import { subscribeToNewsletter } from "@/lib/newsletter.functions";
import { Roll } from "../Roll";

type Status = "idle" | "loading" | "success" | "error";

/**
 * Builder sign-up. Feeds the Brevo FORGe list, so applications can be
 * announced to everyone who registered interest.
 */
export function RegisterInterest() {
  const id = useId();
  const [email, setEmail] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || status === "loading") return;

    setStatus("loading");
    setMessage("");

    try {
      const result = await subscribeToNewsletter({
        data: { email, honeypot, list: "forge" },
      });
      if (result.ok) {
        setStatus("success");
        // The server answers the same for a new and an existing address, so
        // nobody can use this form to learn who is subscribed.
        setMessage("You're on the list. We'll email you when applications open.");
        setEmail("");
      } else {
        setStatus("error");
        setMessage(result.error ?? "Something went wrong. Please try again.");
      }
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again later.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label htmlFor={`${id}-email`} className="text-[14px] font-medium text-white/80">
        Your email
      </label>
      <input
        type="text"
        name="website"
        value={honeypot}
        onChange={(e) => setHoneypot(e.target.value)}
        style={{ display: "none" }}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
      />
      <input
        id={`${id}-email`}
        type="email"
        inputMode="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          if (status !== "idle" && status !== "loading") {
            setStatus("idle");
            setMessage("");
          }
        }}
        placeholder="you@email.com"
        disabled={status === "loading"}
        aria-invalid={status === "error" || undefined}
        aria-describedby={`${id}-status`}
        className="field"
      />
      <button
        type="submit"
        disabled={status === "loading"}
        data-cursor="Apply"
        data-glyph="access"
        className="btn btn-light w-full"
      >
        <Roll>{status === "loading" ? "Adding you" : "Get early access"}</Roll>
        {status !== "loading" && (
          <ArrowRightIcon size={16} weight="bold" className="arrow" aria-hidden="true" />
        )}
      </button>
      <p
        id={`${id}-status`}
        role="status"
        aria-live="polite"
        data-status={status}
        className="form-status"
      >
        {status === "success" && <CheckCircleIcon size={16} weight="fill" aria-hidden="true" />}
        {message || "Applications open closer to the event."}
      </p>
    </form>
  );
}
