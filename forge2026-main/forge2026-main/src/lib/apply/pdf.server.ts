import { constants, inflateSync } from "node:zlib";

/*
  CVs are files from strangers, and the team opens every one. A PDF can
  carry more than text: scripts, actions that launch programs or open
  network shares (on Windows that alone can leak a password hash), embedded
  files, Flash-era media, forms that post data elsewhere. A CV needs none of
  that, so a PDF that has any of it is refused, and the applicant is asked
  to export a plain one.

  This is a scan, not a full PDF parser, so it is deliberately strict:

  - It reads the whole file, including stream data, for the names of those
    features (/JavaScript, /Launch, /EmbeddedFile, ...). They are long enough
    that random compressed bytes never spell them by chance.
  - Names written with #xx escapes are decoded first: /Java#53cript is still
    /JavaScript.
  - Modern PDFs pack objects into compressed object streams (/ObjStm). Each
    one is inflated the way a reader would (from the start of its data until
    the compressed stream itself ends) and scanned the same way. One that
    cannot be inflated, or is packed in any way other than plain
    FlateDecode, is refused rather than waved through.
  - Encrypted PDFs cannot be inspected, so they are refused too.

  On top of this, the review page never opens a CV in the browser: it
  downloads it (see review.api.$.ts), so nothing in a file runs on the page
  that holds everyone's data.
*/

export type PdfVerdict =
  | { ok: true }
  | { ok: false; reason: "not-pdf" | "encrypted" | "active" | "unreadable" };

/** PDF delimiters and whitespace: a name ends at any of these. */
const DELIM = String.raw`\x00\t\n\f\r ()<>\[\]{}\/%`;

/** Features a CV never needs, refused wherever they appear. */
const ACTIVE = [
  "JavaScript",
  "Launch",
  "EmbeddedFile",
  "EmbeddedFiles",
  "FileAttachment",
  "RichMedia",
  "XFA",
  "SubmitForm",
  "ImportData",
  "GoToE",
  "GoToR",
  "Rendition",
  "Movie",
  "Sound",
];

/** Names an attacker would escape to slip past this scan; refused when written escaped. */
const ESCAPED_REFUSED = new Set([
  ...ACTIVE,
  "URI",
  "ObjStm",
  "Type",
  "Filter",
  "FlateDecode",
  "DecodeParms",
  "Encrypt",
]);

const ACTIVE_NAME = new RegExp(`\\/(?:${ACTIVE.join("|")})(?=[${DELIM}]|$)`);
const ENCRYPT_NAME = new RegExp(`\\/Encrypt(?=[${DELIM}]|$)`);
const ESCAPED_NAME = new RegExp(`\\/([^${DELIM}]{0,40}#[0-9A-Fa-f]{2}[^${DELIM}]{0,40})`, "g");
const OBJSTM_NAME = new RegExp(`\\/ObjStm(?=[${DELIM}]|$)`, "g");
const URI_VALUE = /\/URI\s*(\(|<|\d+\s+\d+\s+R)/g;
const STREAM_KEYWORD = /(?<![A-Za-z])stream(?:\r\n|\n|\r)/g;
const RISKY_LINK = /^\s*(?:file:|smb:|javascript:|\\\\)/i;

/** Object streams inflated per file, and their total size, at most. */
const MAX_OBJECT_STREAMS = 500;
const MAX_INFLATED = 32 * 1024 * 1024;

const latin1 = (bytes: Uint8Array) => new TextDecoder("latin1").decode(bytes);

function decodeName(name: string): string {
  return name.replace(/#([0-9A-Fa-f]{2})/g, (_, hex: string) =>
    String.fromCharCode(parseInt(hex, 16)),
  );
}

/** The start of a literal string `( ... )`, decoded far enough to read a link's scheme. */
function literalPrefix(text: string, open: number): string {
  let out = "";
  for (let i = open + 1; i < text.length && out.length < 24; i++) {
    const c = text[i];
    if (c === ")") break;
    if (c !== "\\") {
      out += c;
      continue;
    }
    const next = text[++i];
    if (next === undefined) break;
    if (/[0-7]/.test(next)) {
      let oct = next;
      while (oct.length < 3 && /[0-7]/.test(text[i + 1] ?? "")) oct += text[++i];
      out += String.fromCharCode(parseInt(oct, 8) & 0xff);
    } else if (next === "\r" || next === "\n") {
      if (next === "\r" && text[i + 1] === "\n") i++;
    } else {
      out +=
        ({ n: "\n", r: "\r", t: "\t", b: "\b", f: "\f" } as Record<string, string>)[next] ?? next;
    }
  }
  return out;
}

/** UTF-16BE strings (with a byte order mark) read as their characters. */
function unwrapUtf16(s: string): string {
  if (!s.startsWith("\xfe\xff")) return s;
  let out = "";
  for (let i = 2; i + 1 < s.length; i += 2) out += String.fromCharCode(s.charCodeAt(i + 1));
  return out;
}

/** The first characters of the string starting at `at`: literal `( )` or hex `< >`. */
function stringPrefix(text: string, at: number): string | null {
  if (text[at] === "(") return literalPrefix(text, at);
  if (text[at] === "<" && text[at + 1] !== "<") {
    const end = text.indexOf(">", at);
    const digits = text.slice(at + 1, end < 0 ? at + 80 : Math.min(end, at + 80));
    return digits
      .replace(/[^0-9A-Fa-f]/g, "")
      .replace(/(..)/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)));
  }
  return null;
}

/** Strings that are whole objects ("12 0 obj (https://...)"), by object number. */
type Strings = Map<string, string>;

function topLevelStrings(text: string, into: Strings) {
  const re = /(?<![0-9])(\d+)\s+(\d+)\s+obj\s*(?=[(<])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const value = stringPrefix(text, m.index + m[0].length);
    if (value !== null) into.set(`${m[1]} ${m[2]}`, value);
  }
}

/** The same, for objects packed in an object stream (numbered by its header). */
function packedStrings(dict: string, inner: string, into: Strings) {
  const first = Number(/\/First\s+(\d+)/.exec(dict)?.[1]);
  if (!Number.isFinite(first)) return;
  const nums = inner.slice(0, first).trim().split(/\s+/).map(Number);
  for (let i = 0; i + 1 < nums.length; i += 2) {
    let at = first + nums[i + 1];
    while (/\s/.test(inner[at] ?? "")) at++;
    const value = stringPrefix(inner, at);
    if (value !== null) into.set(`${nums[i]} 0`, value);
  }
}

/**
 * Links to local files, network shares or scripts. A link held in its own
 * object (macOS writes them that way) is looked up; one that points at
 * nothing gives a reader nothing to open either.
 */
function riskyLink(text: string, strings: Strings): boolean {
  URI_VALUE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = URI_VALUE.exec(text))) {
    let value: string | null | undefined;
    if (m[1] === "(" || m[1] === "<") {
      value = stringPrefix(text, m.index + m[0].length - 1);
    } else {
      const [num, gen] = m[1].split(/\s+/);
      value = strings.get(`${num} ${gen}`);
    }
    if (value && RISKY_LINK.test(unwrapUtf16(value))) return true;
  }
  return false;
}

function activeNames(text: string): boolean {
  if (ACTIVE_NAME.test(text)) return true;
  ESCAPED_NAME.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ESCAPED_NAME.exec(text))) {
    if (ESCAPED_REFUSED.has(decodeName(m[1]))) return true;
  }
  return false;
}

/** The "N G obj" that opens the object around `index` (not an "endobj"). */
function objectStart(text: string, index: number): number {
  let i = text.lastIndexOf("obj", index);
  while (i > 2 && text.slice(i - 3, i) === "end") i = text.lastIndexOf("obj", i - 1);
  return Math.max(0, i);
}

/**
 * Everything a reader would get from an object stream: inflated from the
 * start of its data until the compressed stream ends. Not cut at /Length or
 * at "endstream", which a crafted file can place to hide objects from a
 * scanner that trusts them.
 */
function inflateFrom(bytes: Uint8Array, start: number, budget: number): Uint8Array | null {
  try {
    return inflateSync(bytes.subarray(start), {
      finishFlush: constants.Z_SYNC_FLUSH,
      maxOutputLength: Math.max(1, budget),
    });
  } catch {
    return null;
  }
}

export function inspectPdf(bytes: Uint8Array): PdfVerdict {
  if (bytes.byteLength < 32) return { ok: false, reason: "not-pdf" };
  const text = latin1(bytes);
  if (!text.startsWith("%PDF-")) return { ok: false, reason: "not-pdf" };

  if (ENCRYPT_NAME.test(text)) return { ok: false, reason: "encrypted" };
  if (activeNames(text)) return { ok: false, reason: "active" };

  // Everything a reader would parse as objects: the file itself, and each
  // object stream unpacked.
  const texts = [text];
  const strings: Strings = new Map();
  topLevelStrings(text, strings);

  let streams = 0;
  let inflated = 0;
  OBJSTM_NAME.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = OBJSTM_NAME.exec(text))) {
    if (++streams > MAX_OBJECT_STREAMS) return { ok: false, reason: "unreadable" };

    STREAM_KEYWORD.lastIndex = m.index;
    const keyword = STREAM_KEYWORD.exec(text);
    if (!keyword) continue;
    // /ObjStm outside a stream's dictionary declares nothing a reader acts on.
    const end = text.indexOf("endobj", m.index);
    if (end !== -1 && end < keyword.index) continue;

    const dict = text.slice(objectStart(text, m.index), keyword.index);
    const dataStart = keyword.index + keyword[0].length;
    let inner: string;
    if (/\/Filter/.test(dict)) {
      const filter = /\/Filter\s*(\[[^\]]*\]|\/[^\s/[\]<>()%]+)/.exec(dict)?.[1];
      const only = filter?.replace(/[[\]\s]/g, "");
      // Plain FlateDecode only: chained or parameterised filters (predictors)
      // would make the scan read scrambled bytes.
      if (only !== "/FlateDecode" || /\/DecodeParms/.test(dict)) {
        return { ok: false, reason: "unreadable" };
      }
      const out = inflateFrom(bytes, dataStart, MAX_INFLATED - inflated);
      if (!out || out.byteLength === 0) return { ok: false, reason: "unreadable" };
      inflated += out.byteLength;
      inner = latin1(out);
      if (activeNames(inner)) return { ok: false, reason: "active" };
    } else {
      // Uncompressed: plain text, already scanned with the file itself.
      const stop = text.indexOf("endstream", dataStart);
      inner = text.slice(dataStart, stop < 0 ? undefined : stop);
    }
    texts.push(inner);
    packedStrings(dict, inner, strings);
  }

  for (const t of texts) if (riskyLink(t, strings)) return { ok: false, reason: "active" };
  return { ok: true };
}

/** What to tell the applicant when their CV was refused. */
export function pdfProblem(reason: Exclude<PdfVerdict, { ok: true }>["reason"]): string {
  switch (reason) {
    case "not-pdf":
      return "This file isn't a PDF. Please upload your CV as a PDF.";
    case "encrypted":
      return "This PDF is password protected. Please upload a version without a password.";
    case "active":
    case "unreadable":
      return "We can't accept this PDF because it contains interactive parts, such as scripts or attachments. Please export your CV again as a plain PDF (Print, then Save as PDF works well).";
  }
}
