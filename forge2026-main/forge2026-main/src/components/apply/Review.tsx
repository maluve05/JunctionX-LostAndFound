import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  DIETARY,
  EXPERIENCE,
  HEARD,
  labelOf,
  REVIEW_STATUSES,
  SKILLS,
  STATUSES,
} from "@/lib/apply/fields";
import type { ReviewRow } from "@/routes/review.api.$";
import { Roll } from "@/components/story/Roll";
import { PlainCursor } from "./PlainCursor";
import { Sources, type Live } from "./Sources";
import { groupTeams, type Team } from "./teams";

/*
  The team's review page: every application, filtered by review status (the
  tiles), searchable, and one open at a time with its answers, CV and the
  team's verdict. Teammates are grouped into one block (teams.ts); a team
  opens on its own, with one decision for all of them. Up and Down move
  through the list. Sources shows, live, how people heard about FORGe
  (Sources.tsx). Admins also get the export, deletion, and the audit log of
  who did what.

  Everything here comes from /review/api, which checks the Access sign-in
  and the reviewer list on every call; this page holds nothing on its own.
*/

type Load =
  | { state: "loading" }
  | { state: "signed-out" }
  | { state: "expired" }
  | { state: "error"; message: string }
  | { state: "ready"; email: string; admin: boolean; rows: ReviewRow[] };

type Sort = "newest" | "oldest" | "rating";

type Activity = {
  id: number;
  at: string;
  actor: string;
  action: "list" | "cv" | "review" | "export" | "delete" | "activity";
  target: string;
  detail: string;
};

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
const fmtDate = (iso: string | null) => (iso ? dateFmt.format(new Date(iso)) : "");

const birthFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const fmtBirth = (date: string) => (date ? birthFmt.format(new Date(`${date}T00:00:00Z`)) : "");

/** In the list: a team as one block, or someone on their own. */
type Item = { kind: "team"; team: Team; hits: Set<string> } | { kind: "one"; row: ReviewRow };

const TEAM = "team:";

/** Access answers an expired session with a redirect to its sign-in page, which fetch cannot follow. */
class SessionExpired extends Error {}

async function api<T>(path: string, init?: RequestInit): Promise<{ status: number; body: T }> {
  let res: Response;
  try {
    res = await fetch(path, { credentials: "same-origin", ...init });
  } catch {
    throw new SessionExpired();
  }
  if (res.redirected) throw new SessionExpired();
  const body = (await res.json().catch(() => ({}))) as T;
  return { status: res.status, body };
}

function statusLabel(r: ReviewRow) {
  return r.status === "other" ? r.status_other || "Other" : labelOf(STATUSES, r.status);
}

function initials(r: ReviewRow) {
  return `${r.first_name[0] ?? ""}${r.last_name[0] ?? ""}`.toUpperCase();
}

function skillsOf(r: ReviewRow) {
  return r.skills
    .map((s) => (s === "other" ? r.skills_other || "Other" : labelOf(SKILLS, s)))
    .join(", ");
}

/** A steady colour per person, from their email. */
function hue(seed: string) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return String(h % 6);
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

const typing = (el: EventTarget | null) =>
  el instanceof HTMLElement &&
  (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

export function Review() {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [filter, setFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("newest");
  const [openId, setOpenId] = useState<string | null>(null);
  const [view, setView] = useState<"applications" | "sources" | "activity">("applications");
  /** Only people who heard about FORGe here (picked on Sources). */
  const [heardFilter, setHeardFilter] = useState<string | null>(null);
  const [live, setLive] = useState<Live | null>(null);
  const [stale, setStale] = useState(false);
  const dirty = useRef(false);

  const fetchList = useCallback(async () => {
    try {
      const { status, body } = await api<{
        ok: boolean;
        email?: string;
        admin?: boolean;
        applications?: ReviewRow[];
        error?: string;
      }>("/review/api/list");
      if (status === 401) return setLoad({ state: "signed-out" });
      if (!body.ok) {
        return setLoad({ state: "error", message: body.error ?? "Couldn't load applications." });
      }
      setLoad({
        state: "ready",
        email: body.email ?? "",
        admin: Boolean(body.admin),
        rows: body.applications ?? [],
      });
    } catch (error) {
      setLoad(
        error instanceof SessionExpired
          ? { state: "expired" }
          : { state: "error", message: "Couldn't reach the server." },
      );
    }
  }, []);

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  const rows = useMemo(() => (load.state === "ready" ? load.rows : []), [load]);
  /** When the newest application on the page was sent. */
  const loadedUpTo = useMemo(
    () => rows.reduce((a, r) => (r.created_at > a ? r.created_at : a), ""),
    [rows],
  );

  // Live: the counts behind Sources, every 30 seconds while the tab is in
  // view. They hold nothing about anyone, so refreshing them writes no audit
  // entry; they also say when applications arrived after the list loaded.
  const signedIn = load.state === "ready";
  useEffect(() => {
    if (!signedIn) return;
    let stopped = false;
    const refresh = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const { status, body } = await api<Live & { ok: boolean }>(
          `/review/api/sources?since=${encodeURIComponent(loadedUpTo)}`,
        );
        if (stopped) return;
        if (status === 200 && body.ok) {
          setLive({ at: body.at, total: body.total, newer: body.newer, counts: body.counts });
          setStale(false);
        } else setStale(true);
      } catch {
        if (!stopped) setStale(true);
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    const onVisible = () => void refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [signedIn, loadedUpTo]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length };
    for (const r of rows) c[r.review_status] = (c[r.review_status] ?? 0) + 1;
    return c;
  }, [rows]);

  const teams = useMemo(() => groupTeams(rows), [rows]);
  const teamOf = useMemo(() => {
    const map = new Map<string, Team>();
    for (const t of teams) for (const r of t.members) map.set(r.id, t);
    return map;
  }, [teams]);

  /**
   * What the list shows, in order. A team shows whole when any member
   * matches the filter and search (the others are dimmed), so a team decision
   * always sees everyone.
   */
  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = (r: ReviewRow) => {
      if (filter !== "all" && r.review_status !== filter) return false;
      if (heardFilter && r.heard !== heardFilter) return false;
      if (!q) return true;
      return [r.first_name, r.last_name, r.email, r.team_name, r.university, r.course]
        .join(" ")
        .toLowerCase()
        .includes(q);
    };
    const list: Item[] = [];
    for (const team of teams) {
      const hits = new Set(team.members.filter(matches).map((r) => r.id));
      if (hits.size) list.push({ kind: "team", team, hits });
    }
    for (const row of rows)
      if (!teamOf.has(row.id) && matches(row)) list.push({ kind: "one", row });

    const people = (i: Item) => (i.kind === "one" ? [i.row] : i.team.members);
    const newest = (i: Item) =>
      people(i).reduce((a, r) => (r.created_at > a ? r.created_at : a), "");
    const oldest = (i: Item) => people(i)[0].created_at;
    const score = (i: Item) => {
      const scores = people(i)
        .map((r) => r.review_rating)
        .filter((n): n is number => n != null);
      return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    };
    if (sort === "oldest") list.sort((a, b) => oldest(a).localeCompare(oldest(b)));
    else if (sort === "rating") {
      list.sort((a, b) => score(b) - score(a) || newest(b).localeCompare(newest(a)));
    } else list.sort((a, b) => newest(b).localeCompare(newest(a)));
    return list;
  }, [rows, teams, teamOf, filter, heardFilter, query, sort]);

  /** Everyone in the list, in the order shown: what Up and Down move through. */
  const shown = useMemo(
    () => items.flatMap((i) => (i.kind === "one" ? [i.row] : i.team.members)),
    [items],
  );

  /** Opens another application, unless that would throw away a review being written. */
  const pick = useCallback((id: string | null) => {
    if (
      dirty.current &&
      !window.confirm("Leave this application? Your unsaved review will be lost.")
    ) {
      return false;
    }
    dirty.current = false;
    setOpenId(id);
    return true;
  }, []);

  // Up and Down move through the list (not while typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (view !== "applications" || typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      if (!shown.length) return;
      e.preventDefault();
      // From an open team, Down steps into its first member.
      const team = openId?.startsWith(TEAM)
        ? teams.find((t) => `${TEAM}${t.key}` === openId)
        : undefined;
      const at = shown.findIndex((r) => r.id === (team ? team.members[0].id : openId));
      const nextIndex =
        at === -1
          ? 0
          : team
            ? at
            : Math.min(shown.length - 1, Math.max(0, at + (e.key === "ArrowDown" ? 1 : -1)));
      const id = shown[nextIndex].id;
      if (id !== openId && pick(id)) {
        document.querySelector(`[data-row="${id}"]`)?.scrollIntoView({ block: "nearest" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shown, teams, openId, view, pick]);

  // Closing the tab with a review half written asks first.
  useEffect(() => {
    const onLeave = (e: BeforeUnloadEvent) => {
      if (dirty.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, []);

  const open = rows.find((r) => r.id === openId) ?? null;
  const openTeam = openId?.startsWith(TEAM)
    ? (teams.find((t) => `${TEAM}${t.key}` === openId) ?? null)
    : null;

  const replace = (...updated: ReviewRow[]) => {
    const byId = new Map(updated.map((r) => [r.id, r]));
    setLoad((l) =>
      l.state === "ready" ? { ...l, rows: l.rows.map((r) => byId.get(r.id) ?? r) } : l,
    );
  };
  const remove = (id: string) => {
    dirty.current = false;
    setOpenId(null);
    setLoad((l) => (l.state === "ready" ? { ...l, rows: l.rows.filter((r) => r.id !== id) } : l));
  };

  if (load.state === "loading") {
    return (
      <State title="Loading applications">
        <p>One moment.</p>
      </State>
    );
  }
  if (load.state === "signed-out" || load.state === "expired") {
    return (
      <State title={load.state === "expired" ? "Signed out" : "Team only"}>
        <p>
          {load.state === "expired"
            ? "Your session ended. Sign in again to keep reviewing."
            : "This page is for the FORGe team. Sign in with the email the team added."}
        </p>
        <a className="btn btn-light" href="/review" data-cursor="Sign in">
          <Roll>Sign in</Roll>
        </a>
      </State>
    );
  }
  if (load.state === "error") {
    return (
      <State title="Something went wrong">
        <p>{load.message}</p>
        <button
          type="button"
          className="btn btn-light"
          data-cursor="Retry"
          onClick={() => void fetchList()}
        >
          <Roll>Try again</Roll>
        </button>
      </State>
    );
  }

  const tiles = [{ value: "all", label: "All" }, ...REVIEW_STATUSES];

  return (
    <div
      className="rv-app"
      data-detail={(open || openTeam) && view === "applications" ? "open" : undefined}
    >
      <PlainCursor />
      <header className="rv-top">
        <div className="rv-brand">
          <img src="/brand/wordmark.webp" alt="FORGe Hackathon" width={296} height={95} />
          <h1>Applications</h1>
        </div>
        <div className="rv-top-actions">
          <span className="rv-me">
            {load.email}
            {load.admin && <span className="rv-admin">Admin</span>}
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            data-on={view === "sources" || undefined}
            aria-pressed={view === "sources"}
            data-cursor={view === "sources" ? "Close" : "Sources"}
            onClick={() => setView(view === "sources" ? "applications" : "sources")}
          >
            <Roll>Sources</Roll>
          </button>
          {load.admin && (
            <>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                data-on={view === "activity" || undefined}
                aria-pressed={view === "activity"}
                data-cursor={view === "activity" ? "Close" : "Log"}
                onClick={() => setView(view === "activity" ? "applications" : "activity")}
              >
                <Roll>Activity</Roll>
              </button>
              <a
                className="btn btn-ghost btn-sm"
                href="/review/api/export.csv"
                download
                data-cursor="Export"
              >
                <Roll>Export CSV</Roll>
              </a>
            </>
          )}
          <a className="btn btn-ghost btn-sm" href="/cdn-cgi/access/logout" data-cursor="Sign out">
            <Roll>Sign out</Roll>
          </a>
        </div>
      </header>

      <div className="rv-main">
        {view === "activity" ? (
          <ActivityPanel rows={rows} />
        ) : view === "sources" ? (
          <Sources
            live={live}
            stale={stale}
            onShowChannel={(heard) => {
              setHeardFilter(heard);
              setFilter("all");
              setView("applications");
            }}
          />
        ) : (
          <>
            <div className="rv-stats" role="group" aria-label="Filter by review status">
              {tiles.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  className="rv-stat"
                  data-tone={t.value}
                  data-on={filter === t.value || undefined}
                  aria-pressed={filter === t.value}
                  data-cursor="Filter"
                  onClick={() => setFilter(t.value)}
                >
                  <span className="rv-stat-label">{t.label}</span>
                  <span className="rv-stat-count">{counts[t.value] ?? 0}</span>
                </button>
              ))}
            </div>

            <div className="rv-body">
              <section className="rv-panel rv-list" aria-label="Applications">
                <div className="rv-tools">
                  <input
                    type="search"
                    className="ap-input"
                    placeholder="Search name, email, team or university"
                    aria-label="Search applications"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  <select
                    className="ap-input ap-select"
                    aria-label="Sort"
                    value={sort}
                    data-cursor="Sort"
                    onChange={(e) => setSort(e.target.value as Sort)}
                  >
                    <option value="newest">Newest</option>
                    <option value="oldest">Oldest</option>
                    <option value="rating">Top rated</option>
                  </select>
                </div>
                {live && live.newer > 0 && (
                  <p className="rv-fresh" role="status">
                    <span>
                      {live.newer === 1
                        ? "1 new application since this list loaded."
                        : `${live.newer} new applications since this list loaded.`}
                    </span>
                    <button
                      type="button"
                      className="rv-link"
                      data-cursor="Load"
                      onClick={() => void fetchList()}
                    >
                      Load {live.newer === 1 ? "it" : "them"}
                    </button>
                  </p>
                )}
                {heardFilter && (
                  <p className="rv-heard-filter">
                    <span>
                      Heard about FORGe from{" "}
                      <strong>
                        {HEARD.find((h) => h.value === heardFilter)?.short ?? heardFilter}
                      </strong>
                    </span>
                    <button
                      type="button"
                      className="rv-link"
                      data-cursor="Clear"
                      onClick={() => setHeardFilter(null)}
                    >
                      Show everyone
                    </button>
                  </p>
                )}
                <p className="rv-hint">Up and Down move through the list</p>
                <div className="rv-scroll">
                  {items.length === 0 ? (
                    <div className="rv-empty">
                      <strong>
                        {rows.length === 0 ? "No applications yet" : "Nothing matches"}
                      </strong>
                      {rows.length === 0
                        ? "They appear here as soon as someone applies."
                        : "Try another search or status."}
                    </div>
                  ) : (
                    <ul className="rv-rows">
                      {items.map((item) =>
                        item.kind === "one" ? (
                          <li key={item.row.id}>
                            <Row
                              row={item.row}
                              on={item.row.id === openId}
                              onPick={() => item.row.id !== openId && pick(item.row.id)}
                            />
                          </li>
                        ) : (
                          <li key={`${TEAM}${item.team.key}`} className="rv-teamblock">
                            <TeamHead
                              team={item.team}
                              on={`${TEAM}${item.team.key}` === openId}
                              onPick={() => {
                                const id = `${TEAM}${item.team.key}`;
                                if (id !== openId) pick(id);
                              }}
                            />
                            <ul className="rv-teamrows">
                              {item.team.members.map((r) => (
                                <li key={r.id}>
                                  <Row
                                    row={r}
                                    inTeam
                                    on={r.id === openId}
                                    dim={!item.hits.has(r.id)}
                                    onPick={() => r.id !== openId && pick(r.id)}
                                  />
                                </li>
                              ))}
                            </ul>
                          </li>
                        ),
                      )}
                    </ul>
                  )}
                </div>
              </section>

              <section className="rv-panel rv-detail" aria-label="Application">
                <div className="rv-scroll">
                  {openTeam ? (
                    <TeamView
                      key={openTeam.key}
                      team={openTeam}
                      onOpen={(id) => pick(id)}
                      onClose={() => pick(null)}
                      onSaved={(updated) => replace(...updated)}
                    />
                  ) : open ? (
                    <Detail
                      key={open.id}
                      row={open}
                      admin={load.admin}
                      team={teamOf.get(open.id)}
                      others={rows.filter((r) => r.id !== open.id)}
                      onOpen={(id) => pick(id)}
                      onClose={() => pick(null)}
                      onDirty={(d) => (dirty.current = d)}
                      onSaved={replace}
                      onDeleted={remove}
                    />
                  ) : (
                    <div className="rv-empty">
                      <strong>Pick an application</strong>
                      Its answers, CV and your review open here.
                    </div>
                  )}
                </div>
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function State({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rv-state">
      <PlainCursor />
      <img src="/brand/wordmark.webp" alt="FORGe Hackathon" width={296} height={95} />
      <h1>{title}</h1>
      {children}
    </div>
  );
}

/** One applicant in the list. */
function Row({
  row: r,
  on,
  dim,
  inTeam,
  onPick,
}: {
  row: ReviewRow;
  on: boolean;
  /** In a shown team, but outside the filter or search. */
  dim?: boolean;
  /** Inside a team block, which already names the team. */
  inTeam?: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      className="rv-row"
      data-row={r.id}
      data-tone={r.review_status}
      data-on={on || undefined}
      data-dim={dim || undefined}
      data-cursor="Open"
      onClick={onPick}
    >
      <span className="rv-avatar" data-hue={hue(r.email)} aria-hidden="true">
        {initials(r)}
      </span>
      <span className="rv-row-name">
        {r.first_name} {r.last_name}
      </span>
      <span className="rv-tag" data-tone={r.review_status}>
        {labelOf(REVIEW_STATUSES, r.review_status)}
      </span>
      <span className="rv-row-meta">
        {statusLabel(r)}
        {r.university && `, ${r.university}`}
      </span>
      <span className="rv-row-side">
        {r.review_rating ? <span className="rv-rating">{r.review_rating}/5</span> : null}
        {r.has_team && !inTeam && <span className="rv-team">{r.team_name}</span>}
        {fmtDate(r.created_at)}
      </span>
    </button>
  );
}

const teamTitle = (team: Team) => team.name || "Unnamed team";

function teamCount(team: Team) {
  const applied = `${team.members.length} applied`;
  return team.missing.length ? `${applied}, ${team.missing.length} not yet` : applied;
}

/** A team's header in the list: opens the team on its own. */
function TeamHead({ team, on, onPick }: { team: Team; on: boolean; onPick: () => void }) {
  const check = team.crowded || team.nameOnly.size > 0;
  return (
    <button
      type="button"
      className="rv-teamhead"
      data-on={on || undefined}
      data-cursor="Team"
      aria-label={`Team ${teamTitle(team)}, ${teamCount(team)}${check ? ", needs a check" : ""}`}
      onClick={onPick}
    >
      <span className="rv-teamhead-kind" aria-hidden="true">
        Team
      </span>
      <span className="rv-teamhead-name">{teamTitle(team)}</span>
      <span className="rv-teamhead-count">{teamCount(team)}</span>
      {check && <span className="rv-flag">Check</span>}
    </button>
  );
}

/** A team on its own: everyone in it side by side, and one decision for all of them. */
function TeamView({
  team,
  onOpen,
  onClose,
  onSaved,
}: {
  team: Team;
  onOpen: (id: string) => void;
  onClose: () => void;
  onSaved: (rows: ReviewRow[]) => void;
}) {
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const count = team.members.length;
  const statuses = new Set(team.members.map((m) => m.review_status));
  const now =
    statuses.size === 1
      ? `Now: ${count === 1 ? "" : "all "}${labelOf(REVIEW_STATUSES, [...statuses][0]).toLowerCase()}`
      : "Now: different for each";

  const save = async () => {
    if (!status) return;
    setSaving(true);
    setMessage("");
    try {
      const { body } = await api<{ ok: boolean; applications?: ReviewRow[]; error?: string }>(
        "/review/api/team",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: team.members.map((m) => m.id), status }),
        },
      );
      if (!body.ok || !body.applications) {
        setMessage(body.error ?? "Couldn't save. Try again.");
      } else {
        onSaved(body.applications);
        setStatus(null);
        setMessage(count === 1 ? "Saved." : `Saved for all ${count}.`);
      }
    } catch (error) {
      setMessage(
        error instanceof SessionExpired
          ? "Your session ended. Reload the page to sign in again."
          : "Couldn't reach the server.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <article className="rv-card">
      <button
        type="button"
        className="btn btn-ghost btn-sm rv-close"
        data-cursor="Back"
        onClick={onClose}
      >
        <Roll>All applications</Roll>
      </button>

      <header className="rv-head">
        <span className="rv-avatar rv-teambadge" data-size="lg" aria-hidden="true">
          {count}
        </span>
        <div>
          <h2>{teamTitle(team)}</h2>
          <p>
            {teamCount(team)}. First applied {fmtDate(team.members[0].created_at)}.
          </p>
        </div>
      </header>

      {team.crowded ? (
        <p className="rv-warn">
          <strong>More people than one team can have.</strong> Two teams may have picked the same
          name, so decide for each person on their own.
        </p>
      ) : (
        <>
          {team.nameOnly.size > 0 && (
            <p className="rv-warn">
              <strong>Check who belongs here.</strong> Some members share the team name but
              don&apos;t list each other&apos;s email.
            </p>
          )}
          <div className="rv-verdict">
            <span className="rv-verdict-title">
              {count === 1 ? "Your review" : `One decision for all ${count}`}
            </span>
            <div className="rv-choices" role="radiogroup" aria-label="Status for the whole team">
              {REVIEW_STATUSES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  role="radio"
                  className="rv-choice"
                  data-tone={s.value}
                  aria-checked={status === s.value}
                  data-cursor="Set"
                  onClick={() => setStatus(status === s.value ? null : s.value)}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <div className="rv-save">
              <button
                type="button"
                className="btn btn-light btn-sm"
                disabled={!status || saving}
                data-cursor="Save"
                onClick={() => void save()}
              >
                <Roll>{saving ? "Saving" : count === 1 ? "Save" : `Set for all ${count}`}</Roll>
              </button>
              <span role="status">{message || now}</span>
            </div>
            <p className="rv-verdict-note">Each person&apos;s score and notes stay as they are.</p>
          </div>
        </>
      )}

      <section className="rv-section" data-tone="lilac">
        <h3>Applied</h3>
        <ul className="rv-members">
          {team.members.map((m) => (
            <li key={m.id} className="rv-member">
              <span className="rv-avatar" data-hue={hue(m.email)} aria-hidden="true">
                {initials(m)}
              </span>
              <div className="rv-member-main">
                <strong>
                  {m.first_name} {m.last_name}
                </strong>
                <span>
                  {statusLabel(m)}
                  {m.university && `, ${m.university}`}. {labelOf(EXPERIENCE, m.experience)}.
                </span>
                <span className="rv-member-skills">{skillsOf(m)}</span>
                {team.nameOnly.has(m.id) && (
                  <span className="rv-muted">Joined by the team name only</span>
                )}
                {!m.has_team && <span className="rv-muted">Applied without a team</span>}
              </div>
              <div className="rv-member-side">
                <span className="rv-tag" data-tone={m.review_status}>
                  {labelOf(REVIEW_STATUSES, m.review_status)}
                </span>
                {m.review_rating ? <span className="rv-rating">{m.review_rating}/5</span> : null}
                <button
                  type="button"
                  className="rv-link"
                  data-cursor="Open"
                  onClick={() => onOpen(m.id)}
                >
                  Open
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {team.missing.length > 0 && (
        <section className="rv-section" data-tone="sun">
          <h3>Not applied yet</h3>
          <ul className="rv-mates">
            {team.missing.map((m) => (
              <li key={m.email}>
                <span>
                  {m.name} ({m.email})
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}

function Detail({
  row,
  admin,
  team,
  others,
  onOpen,
  onClose,
  onDirty,
  onSaved,
  onDeleted,
}: {
  row: ReviewRow;
  admin: boolean;
  /** The team this applicant is grouped into, if any. */
  team?: Team;
  /** Every other application, to show which teammates have applied. */
  others: ReviewRow[];
  onOpen: (id: string) => void;
  onClose: () => void;
  onDirty: (dirty: boolean) => void;
  onSaved: (row: ReviewRow) => void;
  onDeleted: (id: string) => void;
}) {
  const [status, setStatus] = useState(row.review_status);
  const [rating, setRating] = useState<number | null>(row.review_rating);
  const [notes, setNotes] = useState(row.review_notes);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [armed, setArmed] = useState(false);

  const dirty =
    status !== row.review_status || rating !== row.review_rating || notes !== row.review_notes;

  useEffect(() => {
    onDirty(dirty);
  }, [dirty, onDirty]);

  const post = async (path: string, payload: unknown) => {
    const { body } = await api<{ ok: boolean; application?: ReviewRow; error?: string }>(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return body;
  };

  const save = async () => {
    setSaving(true);
    setMessage("");
    try {
      const body = await post("/review/api/review", { id: row.id, status, rating, notes });
      if (!body.ok || !body.application) setMessage(body.error ?? "Couldn't save. Try again.");
      else {
        onDirty(false);
        onSaved(body.application);
        setMessage("Saved.");
      }
    } catch (error) {
      setMessage(
        error instanceof SessionExpired
          ? "Your session ended. Reload the page to sign in again."
          : "Couldn't reach the server.",
      );
    } finally {
      setSaving(false);
    }
  };

  const destroy = async () => {
    if (!armed) {
      setArmed(true);
      return;
    }
    try {
      const body = await post("/review/api/delete", { id: row.id, confirm: "DELETE" });
      if (body.ok) onDeleted(row.id);
      else setMessage(body.error ?? "Couldn't delete.");
    } catch {
      setMessage("Couldn't reach the server.");
    } finally {
      setArmed(false);
    }
  };

  const dietary = row.dietary
    .map((d) => (d === "other" ? row.dietary_other : labelOf(DIETARY, d)))
    .join(", ");
  const skills = skillsOf(row);

  return (
    <article className="rv-card">
      <button
        type="button"
        className="btn btn-ghost btn-sm rv-close"
        data-cursor="Back"
        onClick={onClose}
      >
        <Roll>All applications</Roll>
      </button>

      <header className="rv-head">
        <span className="rv-avatar" data-size="lg" data-hue={hue(row.email)} aria-hidden="true">
          {initials(row)}
        </span>
        <div>
          <h2>
            {row.first_name} {row.last_name}
          </h2>
          <p>
            {statusLabel(row)}, {row.age}
            {row.birth_date && ` (born ${fmtBirth(row.birth_date)})`}. Applied{" "}
            {fmtDate(row.created_at)}.
          </p>
        </div>
      </header>

      <div className="rv-links">
        <a
          className="btn btn-light btn-sm"
          href={`/review/api/cv/${row.id}`}
          download
          data-cursor="Download"
        >
          <Roll>Download CV</Roll>
        </a>
        {row.linkedin && (
          <a
            className="btn btn-ghost btn-sm"
            href={row.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            data-cursor="Open"
          >
            <Roll>LinkedIn</Roll>
            <span className="rv-host">{hostOf(row.linkedin)}</span>
          </a>
        )}
        {row.portfolio && (
          <a
            className="btn btn-ghost btn-sm"
            href={row.portfolio}
            target="_blank"
            rel="noopener noreferrer"
            data-cursor="Open"
          >
            <Roll>Portfolio</Roll>
            <span className="rv-host">{hostOf(row.portfolio)}</span>
          </a>
        )}
      </div>

      <div className="rv-verdict">
        <span className="rv-verdict-title">Your review</span>
        <div className="rv-choices" role="radiogroup" aria-label="Review status">
          {REVIEW_STATUSES.map((s) => (
            <button
              key={s.value}
              type="button"
              role="radio"
              className="rv-choice"
              data-tone={s.value}
              aria-checked={status === s.value}
              data-cursor="Set"
              onClick={() => setStatus(s.value)}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="rv-score" role="radiogroup" aria-label="Score out of 5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} of 5`}
              data-on={rating !== null && n <= rating ? true : undefined}
              data-cursor="Score"
              onClick={() => setRating(rating === n ? null : n)}
            >
              {n}
            </button>
          ))}
          <span>{rating ? `${rating} of 5` : "No score yet"}</span>
        </div>
        <textarea
          className="ap-input ap-textarea"
          rows={3}
          aria-label="Notes for the team"
          placeholder="Notes for the team"
          value={notes}
          maxLength={4000}
          onChange={(e) => setNotes(e.target.value)}
        />
        <div className="rv-save">
          <button
            type="button"
            className="btn btn-light btn-sm"
            disabled={!dirty || saving}
            data-cursor="Save"
            onClick={() => void save()}
          >
            <Roll>{saving ? "Saving" : "Save review"}</Roll>
          </button>
          {dirty && <span className="rv-unsaved">Unsaved</span>}
          <span role="status">
            {message ||
              (row.reviewed_by
                ? `Last reviewed by ${row.reviewed_by}, ${fmtDate(row.reviewed_at)}`
                : "")}
          </span>
        </div>
      </div>

      <section className="rv-section" data-tone="sky">
        <h3>Contact</h3>
        <dl className="rv-answers">
          <Answer label="Email">
            <a href={`mailto:${row.email}`}>{row.email}</a>
          </Answer>
          <Answer label="Phone">{row.phone}</Answer>
        </dl>
      </section>

      <section className="rv-section" data-tone="lilac">
        <h3>Profile</h3>
        <dl className="rv-answers">
          {row.university && (
            <Answer label="Studies">
              {row.course}, {row.university}
            </Answer>
          )}
          <Answer label="Skills">{skills}</Answer>
          <Answer label="Hackathons">{labelOf(EXPERIENCE, row.experience)}</Answer>
          <Answer label="CV file">{row.cv_name}</Answer>
        </dl>
      </section>

      <section className="rv-section" data-tone="coral">
        <h3>In their words</h3>
        <dl className="rv-answers">
          <Answer label="Last thing built" long tone="coral">
            {row.last_built || (
              <span className="rv-muted">
                Skipped
                {row.experience === "first" ? ": optional on a first hackathon" : ""}
              </span>
            )}
          </Answer>
          <Answer label="Hopes to get" long tone="sky">
            {row.hopes}
          </Answer>
          <Answer label="Why pick them" long tone="lilac">
            {row.why_you}
          </Answer>
        </dl>
      </section>

      <section className="rv-section" data-tone="sun">
        <h3>Team and logistics</h3>
        <dl className="rv-answers">
          <Answer label="Team">
            {team && (
              <button
                type="button"
                className="rv-link rv-team-open"
                data-cursor="Team"
                onClick={() => onOpen(`${TEAM}${team.key}`)}
              >
                See the whole team ({teamCount(team)})
              </button>
            )}
            {row.has_team ? (
              <>
                <strong>{row.team_name}</strong>
                <ul className="rv-mates">
                  {row.teammates.map((m) => {
                    const applied = others.find(
                      (t) => t.email.toLowerCase() === m.email.toLowerCase(),
                    );
                    return (
                      <li key={m.email}>
                        <span>
                          {m.name} ({m.email})
                        </span>
                        {applied ? (
                          <>
                            <span className="rv-applied">Applied</span>
                            <button
                              type="button"
                              className="rv-link"
                              data-cursor="Open"
                              onClick={() => onOpen(applied.id)}
                            >
                              Open
                            </button>
                          </>
                        ) : (
                          <span className="rv-muted">not applied yet</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : (
              "Wants to be placed on a team"
            )}
          </Answer>
          <Answer label="Dietary">{dietary || "Not given"}</Answer>
          <Answer label="Heard via">
            {row.heard === "other" ? row.heard_other : labelOf(HEARD, row.heard)}
          </Answer>
          <Answer label="Consent">
            Emails {row.consent_comms ? "yes" : "no"}, photo and video{" "}
            {row.consent_media ? "yes" : "no"}
          </Answer>
        </dl>
      </section>

      {admin && (
        <div className="rv-danger">
          <span>
            <strong>Delete this application</strong>
            Removes the answers and the CV for good, for example when someone asks to be erased.
          </span>
          <button
            type="button"
            className="btn btn-sm rv-delete"
            data-armed={armed || undefined}
            data-cursor="Delete"
            onClick={() => void destroy()}
            onBlur={() => setArmed(false)}
          >
            <Roll>{armed ? "Click again to delete" : "Delete"}</Roll>
          </button>
        </div>
      )}
    </article>
  );
}

function Answer({
  label,
  long,
  tone,
  children,
}: {
  label: string;
  long?: boolean;
  tone?: string;
  children: ReactNode;
}) {
  return (
    <div className="rv-answer" data-long={long || undefined} data-tone={tone}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

const ACTION_TEXT: Record<Activity["action"], { tag: string; text: string; tone: string }> = {
  list: { tag: "List", text: "opened the list", tone: "new" },
  cv: { tag: "CV", text: "downloaded a CV", tone: "shortlist" },
  review: { tag: "Review", text: "saved a review", tone: "accepted" },
  export: { tag: "Export", text: "exported everything", tone: "waitlist" },
  delete: { tag: "Delete", text: "deleted an application", tone: "declined" },
  activity: { tag: "Log", text: "read the activity log", tone: "all" },
};

function ActivityPanel({ rows }: { rows: ReviewRow[] }) {
  const [items, setItems] = useState<Activity[] | null>(null);
  const [problem, setProblem] = useState("");

  useEffect(() => {
    api<{ ok: boolean; activity?: Activity[]; error?: string }>("/review/api/activity")
      .then(({ body }) => {
        if (body.ok) setItems(body.activity ?? []);
        else setProblem(body.error ?? "Couldn't load the activity.");
      })
      .catch(() => setProblem("Couldn't reach the server."));
  }, []);

  const names = useMemo(
    () => new Map(rows.map((r) => [r.id, `${r.first_name} ${r.last_name}`])),
    [rows],
  );

  return (
    <section className="rv-panel" aria-label="Activity">
      <div className="rv-scroll">
        {problem ? (
          <div className="rv-empty">{problem}</div>
        ) : !items ? (
          <div className="rv-empty">Loading</div>
        ) : items.length === 0 ? (
          <div className="rv-empty">Nothing yet.</div>
        ) : (
          <ol className="rv-activity">
            {items.map((a) => {
              const what = ACTION_TEXT[a.action] ?? { tag: a.action, text: a.action, tone: "all" };
              const who = a.target ? (names.get(a.target) ?? "a deleted application") : "";
              return (
                <li key={a.id} className="rv-event">
                  <span className="rv-tag" data-tone={what.tone}>
                    {what.tag}
                  </span>
                  <span>
                    <strong>{a.actor}</strong> <span className="rv-event-who">{what.text}</span>
                    {who && ` (${who})`}
                    {a.detail && <span className="rv-event-who">, {a.detail}</span>}
                  </span>
                  <time dateTime={a.at}>{fmtDate(a.at)}</time>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}
