import { useMemo, useState, type KeyboardEvent } from "react";
import { HEARD, HEARD_GROUPS } from "@/lib/apply/fields";
import { Roll } from "@/components/story/Roll";

/*
  How people hear about FORGe, live: the answers to "How did you hear about
  FORGe?" as numbers, so the team can see which places bring builders and
  push those harder.

  Everything comes from /review/api/sources, which holds only counts (per
  day, answer and review status), refreshed every 30 seconds by the review
  page while it's open. Pick a channel to see it day by day and to list the
  people who came from it.

  One series at a time: every channel's bar is sky, and once one is picked
  the rest step back to grey (emphasis). Both clear 3:1 on the panel, and
  stay apart under colour blindness (checked with the dataviz skill's
  validate_palette.js: delta E 29 under deuteranopia).
*/

export type SourceCount = { day: string; heard: string; status: string; n: number };

export type Live = { at: string; total: number; newer: number; counts: SourceCount[] };

type Range = "all" | "30" | "7";

const RANGES: { value: Range; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "30", label: "Last 30 days" },
  { value: "7", label: "Last 7 days" },
];

const DAY = 86_400_000;
const isoDay = (t: number) => new Date(t).toISOString().slice(0, 10);
const dayFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const fmtDay = (day: string) => dayFmt.format(new Date(`${day}T00:00:00Z`));
const timeFmt = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

const channel = new Map<string, (typeof HEARD)[number]>(HEARD.map((h) => [h.value, h]));
const short = (heard: string) => channel.get(heard)?.short ?? heard;

const share = (n: number, of: number) => (of ? Math.round((n / of) * 100) : 0);

/** A round top for the day chart's scale: 1, 2, 5, 10, 20, 50... */
function niceMax(n: number): number {
  if (n <= 1) return 1;
  const step = 10 ** Math.floor(Math.log10(n));
  return [1, 2, 5, 10].map((k) => k * step).find((v) => v >= n) ?? 10 * step;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function Sources({
  live,
  stale,
  onShowChannel,
}: {
  live: Live | null;
  /** The last refresh failed: the numbers on screen are from before. */
  stale: boolean;
  onShowChannel: (heard: string) => void;
}) {
  const [range, setRange] = useState<Range>("all");
  const [picked, setPicked] = useState<string | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);

  const view = useMemo(() => {
    const counts = live?.counts ?? [];
    const now = live ? Date.parse(live.at) : Date.now();
    const today = isoDay(now);
    const weekFrom = isoDay(now - 6 * DAY);
    const firstDay = counts[0]?.day ?? today;
    const from = range === "all" ? firstDay : isoDay(now - (Number(range) - 1) * DAY);

    const per = new Map<string, { n: number; week: number; accepted: number }>();
    const perDay = new Map<string, { total: number; picked: number }>();
    let total = 0;
    for (const c of counts) {
      if (c.day < from) continue;
      total += c.n;
      const entry = per.get(c.heard) ?? { n: 0, week: 0, accepted: 0 };
      entry.n += c.n;
      if (c.day >= weekFrom) entry.week += c.n;
      if (c.status === "accepted") entry.accepted += c.n;
      per.set(c.heard, entry);
      const day = perDay.get(c.day) ?? { total: 0, picked: 0 };
      day.total += c.n;
      if (c.heard === picked) day.picked += c.n;
      perDay.set(c.day, day);
    }

    const days: { day: string; total: number; picked: number }[] = [];
    for (let t = Date.parse(`${from}T00:00:00Z`); isoDay(t) <= today; t += DAY) {
      const day = isoDay(t);
      days.push({ day, ...(perDay.get(day) ?? { total: 0, picked: 0 }) });
    }

    // Ranked by people; on a tie, in the form's order. A picked channel stays
    // listed even at zero, so it can be put down again.
    const ranked = HEARD.map((h) => ({
      ...h,
      ...(per.get(h.value) ?? { n: 0, week: 0, accepted: 0 }),
    }))
      .filter((c) => c.n > 0 || c.value === picked)
      .sort((a, b) => b.n - a.n);
    const unreached = HEARD.filter((h) => !per.get(h.value)?.n && h.value !== picked);
    const groups = HEARD_GROUPS.map((g) => ({
      ...g,
      n: HEARD.filter((h) => h.group === g.value).reduce(
        (a, h) => a + (per.get(h.value)?.n ?? 0),
        0,
      ),
    }));
    const busiest = days.reduce<(typeof days)[number] | null>(
      (best, d) => (d.total > (best?.total ?? 0) ? d : best),
      null,
    );

    return {
      total,
      today: perDay.get(today)?.total ?? 0,
      reached: HEARD.filter((h) => per.get(h.value)?.n).length,
      ranked,
      unreached,
      groups,
      days,
      busiest,
      top: ranked[0]?.n ? ranked[0] : null,
      most: Math.max(1, ...ranked.map((c) => c.n)),
      scale: niceMax(Math.max(0, ...days.map((d) => d.total))),
    };
  }, [live, range, picked]);

  if (!live) {
    return (
      <section className="rv-panel" aria-label="How people hear about FORGe">
        <div className="rv-empty">
          {stale ? "Couldn't load the numbers. Trying again." : "Loading the numbers"}
        </div>
      </section>
    );
  }

  const pickedRow = picked ? view.ranked.find((c) => c.value === picked) : undefined;
  const focusDay = hover !== null ? view.days[hover] : null;
  const readout = focusDay
    ? `${fmtDay(focusDay.day)}: ${plural(focusDay.total, "application")}${
        picked ? `, ${focusDay.picked} from ${short(picked)}` : ""
      }`
    : view.busiest
      ? `Busiest day: ${fmtDay(view.busiest.day)}, with ${plural(view.busiest.total, "application")}${
          picked ? ` (${view.busiest.picked} from ${short(picked)})` : ""
        }`
      : "No applications in this time.";

  const onChartKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const last = view.days.length - 1;
    const at = hover ?? last;
    const next =
      e.key === "ArrowLeft"
        ? Math.max(0, at - 1)
        : e.key === "ArrowRight"
          ? Math.min(last, at + 1)
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? last
              : null;
    if (next === null) return;
    e.preventDefault();
    setHover(next);
  };

  return (
    <section className="rv-panel rv-sources" aria-label="How people hear about FORGe">
      <div className="rv-scroll">
        <div className="rv-src">
          <header className="rv-src-head">
            <div>
              <h2>How people hear about FORGe</h2>
              <p className="rv-src-live" data-stale={stale || undefined}>
                <span className="rv-src-dot" aria-hidden="true" />
                {stale
                  ? "Couldn't refresh. Trying again."
                  : `Live. Updated ${timeFmt.format(new Date(live.at))}.`}
              </p>
            </div>
            <div className="rv-src-range" role="group" aria-label="Time">
              {RANGES.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  className="rv-choice"
                  data-tone="all"
                  aria-pressed={range === r.value}
                  data-cursor="Show"
                  onClick={() => {
                    setRange(r.value);
                    setHover(null);
                  }}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </header>

          {live.total === 0 ? (
            <div className="rv-empty">
              <strong>No applications yet</strong>
              Where people heard about FORGe shows here as soon as someone applies.
            </div>
          ) : (
            <>
              <div className="rv-src-tiles">
                <Tile label="Applications" value={String(view.total)} />
                <Tile
                  label="Top place"
                  value={view.top ? view.top.short : "None yet"}
                  note={
                    view.top
                      ? `${plural(view.top.n, "person", "people")}, ${share(view.top.n, view.total)}%`
                      : undefined
                  }
                />
                <Tile
                  label="Places reached"
                  value={String(view.reached)}
                  note={`of ${HEARD.length}`}
                />
                <Tile label="Today" value={String(view.today)} />
              </div>

              <div className="rv-src-groups" aria-label="By kind of place">
                {view.groups.map((g) => (
                  <div key={g.value} className="rv-src-group">
                    <span>{g.label}</span>
                    <strong>{g.n}</strong>
                    <span>{share(g.n, view.total)}%</span>
                  </div>
                ))}
              </div>

              <section className="rv-src-block" aria-labelledby="rv-src-ranked">
                <h3 id="rv-src-ranked">Where they heard first</h3>
                <p className="rv-src-hint">Pick one to see it day by day and to list the people.</p>
                <ul className="rv-src-ranked" data-picked={picked ? true : undefined}>
                  {view.ranked.map((c) => {
                    const on = c.value === picked;
                    return (
                      <li key={c.value}>
                        <button
                          type="button"
                          className="rv-src-row"
                          aria-pressed={on}
                          aria-label={`${c.label}: ${plural(c.n, "person", "people")}, ${share(c.n, view.total)}%, ${c.week} this week, ${c.accepted} accepted`}
                          data-on={on || undefined}
                          title={c.label}
                          data-cursor={on ? "Clear" : "Pick"}
                          onClick={() => {
                            setPicked(on ? null : c.value);
                            setHover(null);
                          }}
                        >
                          <span className="rv-src-name">{c.short}</span>
                          <span className="rv-src-track" aria-hidden="true">
                            <span
                              className="rv-src-bar"
                              style={{ width: `calc((100% - 5ch) * ${c.n / view.most})` }}
                            />
                            <span className="rv-src-value">{c.n}</span>
                          </span>
                          <span className="rv-src-meta">
                            {share(c.n, view.total)}%<span>{c.week} this week</span>
                            <span>{c.accepted} accepted</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {pickedRow && pickedRow.n > 0 && (
                  <button
                    type="button"
                    className="btn btn-light btn-sm rv-src-show"
                    data-cursor="Show"
                    onClick={() => onShowChannel(pickedRow.value)}
                  >
                    <Roll>{`Show the ${plural(pickedRow.n, "person", "people")} from ${pickedRow.short}`}</Roll>
                  </button>
                )}
              </section>

              {view.unreached.length > 0 && (
                <section className="rv-src-block" aria-labelledby="rv-src-unreached">
                  <h3 id="rv-src-unreached">No one from here yet</h3>
                  <p className="rv-src-hint">Push these harder, or stop spending time on them.</p>
                  <ul className="rv-src-unreached">
                    {view.unreached.map((h) => (
                      <li key={h.value} title={h.label}>
                        {h.short}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section className="rv-src-block" aria-labelledby="rv-src-days">
                <div className="rv-src-dayshead">
                  <h3 id="rv-src-days">
                    {picked ? `${short(picked)} per day` : "Applications per day"}
                  </h3>
                  <button
                    type="button"
                    className="rv-link"
                    aria-pressed={asTable}
                    data-cursor={asTable ? "Chart" : "Table"}
                    onClick={() => setAsTable(!asTable)}
                  >
                    {asTable ? "Show as a chart" : "Show as a table"}
                  </button>
                </div>
                {asTable ? (
                  <table className="rv-src-table">
                    <thead>
                      <tr>
                        <th scope="col">Day</th>
                        <th scope="col">Applications</th>
                        {picked && <th scope="col">From {short(picked)}</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {[...view.days].reverse().map((d) => (
                        <tr key={d.day}>
                          <th scope="row">{fmtDay(d.day)}</th>
                          <td>{d.total}</td>
                          {picked && <td>{d.picked}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <>
                    <p className="rv-src-readout" aria-live="polite">
                      {readout}
                    </p>
                    <div
                      className="rv-src-chart"
                      role="group"
                      tabIndex={0}
                      aria-label="Applications per day. Use the arrow keys to read each day."
                      onKeyDown={onChartKey}
                      onFocus={() => setHover(view.days.length - 1)}
                      onBlur={() => setHover(null)}
                      onPointerLeave={() => setHover(null)}
                    >
                      <span className="rv-src-scale" aria-hidden="true">
                        {view.scale}
                      </span>
                      <span className="rv-src-zero" aria-hidden="true">
                        0
                      </span>
                      <div
                        className="rv-src-cols"
                        style={{
                          gridTemplateColumns: `repeat(${view.days.length}, minmax(0, 1fr))`,
                        }}
                      >
                        {view.days.map((d, i) => {
                          const rest = picked ? d.total - d.picked : 0;
                          const main = picked ? d.picked : d.total;
                          return (
                            <div
                              key={d.day}
                              className="rv-src-col"
                              data-on={hover === i || undefined}
                              onPointerEnter={() => setHover(i)}
                            >
                              {rest > 0 && (
                                <span
                                  className="rv-src-seg"
                                  data-rest
                                  style={{ height: `${(rest / view.scale) * 100}%` }}
                                />
                              )}
                              {main > 0 && (
                                <span
                                  className="rv-src-seg"
                                  style={{ height: `${(main / view.scale) * 100}%` }}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="rv-src-axis" aria-hidden="true">
                      <span>{fmtDay(view.days[0].day)}</span>
                      <span>Today</span>
                    </div>
                  </>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rv-src-tile">
      <span className="rv-src-tile-label">{label}</span>
      <span className="rv-src-tile-value">{value}</span>
      {note && <span className="rv-src-tile-note">{note}</span>}
    </div>
  );
}
