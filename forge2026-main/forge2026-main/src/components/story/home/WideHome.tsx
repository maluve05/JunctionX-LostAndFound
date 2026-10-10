import { useRef } from "react";
import { useStoryPage } from "../useStoryPage";
import { StoryProgress } from "../chrome";
import { Footer } from "../Footer";
import { Hero } from "./Hero";
import { Idea } from "./Idea";
import { Weekend } from "./Weekend";
import { Crew } from "./Crew";
import { Record } from "./Record";
import { Novae } from "./Novae";
import { Fork } from "./Fork";

/**
 * The home page on wide screens: one story in seven chapters, told by the 3D
 * scene behind it. The forge strikes, its sparks become this year's builders,
 * they connect, build and ship, 2025 is replayed, NOVAe holds it together, and
 * the story splits into the two ways in.
 */
export function WideHome() {
  const ref = useRef<HTMLElement>(null);
  useStoryPage(ref, { intro: true });

  return (
    <main ref={ref} className="story-page">
      <StoryProgress />
      <Hero />
      <Idea />
      <Weekend />
      <Crew />
      <Record />
      <Novae />
      <Fork />
      <Footer />
    </main>
  );
}
