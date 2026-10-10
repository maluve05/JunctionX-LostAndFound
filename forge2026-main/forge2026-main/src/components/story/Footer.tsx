import { useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { InstagramLogoIcon, LinkedinLogoIcon } from "@phosphor-icons/react";
import { EMAIL, NOVAE_URL, SOCIALS } from "./content";
import { watchTram } from "./eggs";

export function Footer() {
  const footer = useRef<HTMLElement>(null);

  // A secret (eggs.ts): "Lisbon" sends a tram along the line at the bottom.
  useEffect(() => (footer.current ? watchTram(footer.current) : undefined), []);

  return (
    <footer ref={footer} className="site-footer">
      <div className="shell">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-12">
          <div className="md:col-span-5">
            <img
              src="/brand/wordmark.webp"
              alt="FORGe Hackathon"
              width={325}
              height={95}
              loading="lazy"
              className="h-9 w-auto"
            />
            <p className="mt-6 max-w-[34ch] text-[15px] leading-relaxed text-white/60">
              Portugal&rsquo;s biggest hackathon. <span className="egg-lisbon">Lisbon</span>,
              November 2026, during Web Summit week.
            </p>
            <div className="mt-8 flex gap-3">
              <a
                href={SOCIALS.linkedin}
                target="_blank"
                rel="noreferrer noopener"
                aria-label="FORGe on LinkedIn"
                className="social press"
              >
                <LinkedinLogoIcon size={20} weight="fill" aria-hidden="true" />
              </a>
              <a
                href={SOCIALS.instagram}
                target="_blank"
                rel="noreferrer noopener"
                aria-label="FORGe on Instagram"
                className="social press"
              >
                <InstagramLogoIcon size={20} weight="regular" aria-hidden="true" />
              </a>
            </div>
          </div>

          <nav aria-label="Footer" className="grid grid-cols-2 gap-10 md:col-span-6 md:col-start-7">
            <ul className="space-y-3 text-[15px]">
              <li>
                <Link to="/" hash="event" className="footer-link">
                  The event
                </Link>
              </li>
              <li>
                <Link to="/builders" className="footer-link">
                  Builders
                </Link>
              </li>
              <li>
                <Link to="/partners" className="footer-link">
                  Partners
                </Link>
              </li>
              <li>
                <Link to="/" hash="novae" className="footer-link">
                  NOVAe
                </Link>
              </li>
            </ul>
            <ul className="space-y-3 text-[15px]">
              <li>
                <a href={`mailto:${EMAIL}`} className="footer-link break-all">
                  {EMAIL}
                </a>
              </li>
              <li>
                <a
                  href={NOVAE_URL}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="footer-link"
                >
                  unlnovae.org
                </a>
              </li>
            </ul>
          </nav>
        </div>

        <p className="footer-line mt-16 border-t border-white/8 pt-8 text-[13px] text-white/60">
          &copy; {new Date().getFullYear()} FORGe. Organised by NOVAe.
        </p>
      </div>
    </footer>
  );
}
