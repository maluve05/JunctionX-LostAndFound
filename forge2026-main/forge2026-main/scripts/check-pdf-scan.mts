/*
  Checks the CV scan (src/lib/apply/pdf.server.ts) against crafted PDFs:
  every attack it must refuse and every ordinary file it must accept. Run
  after any change to the scan:

    npm run check:pdf

  Pass paths to real PDFs as arguments to check those too (they should all be
  accepted unless they really contain scripts or attachments).
*/
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { deflateRawSync, deflateSync } from "node:zlib";
import { inspectPdf } from "../src/lib/apply/pdf.server.ts";

const enc = (s: string) => Buffer.from(s, "latin1");

function pdf(objects: Buffer[], trailerExtra = ""): Buffer {
  const parts: Buffer[] = [enc("%PDF-1.7\n%\xe2\xe3\xcf\xd3\n")];
  const offsets: number[] = [];
  let size = parts[0].length;
  objects.forEach((o, i) => {
    offsets.push(size);
    const chunk = Buffer.concat([enc(`${i + 1} 0 obj\n`), o, enc("\nendobj\n")]);
    parts.push(chunk);
    size += chunk.length;
  });
  const xref =
    `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` +
    offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("") +
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R ${trailerExtra}>>\nstartxref\n${size}\n%%EOF\n`;
  return Buffer.concat([...parts, enc(xref)]);
}

const stream = (dict: string, data: Buffer) =>
  Buffer.concat([
    enc(dict.replace(">>", ` /Length ${data.length} >>`)),
    enc("\nstream\n"),
    data,
    enc("\nendstream"),
  ]);

function objectStream(
  objects: [number, string][],
  options: { filter?: string; extra?: string; raw?: Buffer } = {},
) {
  let body = "";
  const index: string[] = [];
  for (const [num, text] of objects) {
    index.push(`${num} ${body.length}`);
    body += `${text}\n`;
  }
  const head = `${index.join(" ")}\n`;
  const data = enc(head + body);
  const filter = options.filter ?? "/FlateDecode";
  const packed = options.raw ?? (filter ? deflateSync(data) : data);
  const dict = `<< /Type /ObjStm /N ${objects.length} /First ${head.length}${filter ? ` /Filter ${filter}` : ""}${options.extra ?? ""} >>`;
  return stream(dict, packed);
}

const catalog = enc("<< /Type /Catalog /Pages 2 0 R >>");
const pages = enc("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
const page = enc("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>");
const content = stream(
  "<< /Filter /FlateDecode >>",
  deflateSync(enc("BT /F1 12 Tf 72 720 Td (CV) Tj ET")),
);
const base = [catalog, pages, page, content];
const link = (uri: string) =>
  enc(`<< /Type /Annot /Subtype /Link /Rect [0 0 1 1] /A << /S /URI /URI ${uri} >> >>`);
const withCatalog = (extra: string) => [
  enc(`<< /Type /Catalog /Pages 2 0 R ${extra} >>`),
  pages,
  page,
  content,
];

// A compressed object stream that a scanner trusting the first "endstream"
// would cut short: a stored block holding a fake "endstream", then the real
// payload in a compressed block.
function fakeEndstream(): Buffer {
  const first = enc("10 0 11 60\n<< /Type /Font >> endstream endobj % fooling scanners\n");
  const second = enc("<< /S /JavaScript /JS (app.alert(2)) >>\n");
  const stored = Buffer.concat([
    Buffer.from([0x00]),
    Buffer.from([
      first.length & 0xff,
      first.length >> 8,
      ~first.length & 0xff,
      (~first.length >> 8) & 0xff,
    ]),
    first,
  ]);
  const tail = deflateRawSync(second);
  const adler = deflateSync(Buffer.concat([first, second])).subarray(-4);
  return Buffer.concat([Buffer.from([0x78, 0x01]), stored, tail, adler]);
}

function packedFileLink(): Buffer {
  const annot = "<< /Type /Annot /Subtype /Link /A << /S /URI /URI 10 0 R >> >>\n";
  const target = "(file:///C:/Windows/System32/calc.exe)\n";
  const head = `9 0 10 ${annot.length}\n`;
  const data = deflateSync(enc(head + annot + target));
  return stream(`<< /Type /ObjStm /N 2 /First ${head.length} /Filter /FlateDecode >>`, data);
}

const benignObjects: [number, string][] = [
  [10, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"],
  [11, "<< /Type /Annot /Subtype /Link /A << /S /URI /URI (https://www.linkedin.com/in/x) >> >>"],
];

const cases: [string, Buffer, string][] = [
  ["plain CV", pdf(base), "ok"],
  [
    "big image (5 MB of random bytes)",
    pdf([
      catalog,
      pages,
      page,
      stream("<< /Filter /DCTDecode >>", randomBytes(5 * 1024 * 1024 - 8192)),
    ]),
    "ok",
  ],
  [
    "JavaScript on open",
    pdf(withCatalog("/OpenAction << /S /JavaScript /JS (app.alert(1)) >>")),
    "active",
  ],
  [
    "JavaScript behind #xx escapes",
    pdf(withCatalog("/OpenAction << /S /Java#53cript /JS (x) >>")),
    "active",
  ],
  [
    "JavaScript in an object stream",
    pdf([...base, objectStream([[10, "<< /S /JavaScript /JS (x) >>"]])]),
    "active",
  ],
  ["benign object stream", pdf([...base, objectStream(benignObjects)]), "ok"],
  [
    "fake endstream in an object stream",
    pdf([...base, objectStream([[10, ""]], { raw: fakeEndstream() })]),
    "active",
  ],
  ["encrypted", pdf(base, "/Encrypt 9 0 R "), "encrypted"],
  ["link to a network share", pdf([...base, link(String.raw`(\\\\attacker\\share)`)]), "active"],
  [
    "network share in octal escapes",
    pdf([...base, link(String.raw`(\134\134attacker\134share)`)]),
    "active",
  ],
  ["https link", pdf([...base, link("(https://github.com/ines)")]), "ok"],
  [
    "file link in hex",
    pdf([...base, link(`<${Buffer.from("file:///etc/passwd").toString("hex")}>`)]),
    "active",
  ],
  [
    "file link in UTF-16",
    pdf([
      ...base,
      link(
        `<${Buffer.concat([Buffer.from([0xfe, 0xff]), Buffer.from("file:///x", "utf16le").swap16()]).toString("hex")}>`,
      ),
    ]),
    "active",
  ],
  [
    "link held in its own object (macOS)",
    pdf([...base, link("6 0 R"), enc("(https://www.linkedin.com/in/ines)")]),
    "ok",
  ],
  [
    "share link held in its own object",
    pdf([...base, link("6 0 R"), enc(String.raw`(\\\\attacker\\share\\cv.docx)`)]),
    "active",
  ],
  ["file link packed in an object stream", pdf([...base, packedFileLink()]), "active"],
  ["javascript: link", pdf([...base, link("(javascript:app.alert(1))")]), "active"],
  [
    "chained filters on an object stream",
    pdf([...base, objectStream(benignObjects, { filter: "[/FlateDecode /ASCIIHexDecode]" })]),
    "unreadable",
  ],
  [
    "predictor on an object stream",
    pdf([
      ...base,
      objectStream(benignObjects, { extra: " /DecodeParms << /Predictor 12 /Columns 5 >>" }),
    ]),
    "unreadable",
  ],
  [
    "/ObjStm behind #xx escapes",
    pdf([
      ...base,
      stream(
        "<< /Type /Obj#53tm /N 1 /First 5 /Filter /FlateDecode >>",
        deflateSync(enc("10 0\n<< /S /JavaScript >>")),
      ),
    ]),
    "active",
  ],
  ["launch a program", pdf(withCatalog("/OpenAction << /S /Launch /F (cmd.exe) >>")), "active"],
  ["embedded files", pdf(withCatalog("/Names << /EmbeddedFiles 9 0 R >>")), "active"],
  [
    "PNG renamed .pdf",
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(2000),
    ]),
    "not-pdf",
  ],
];

let failed = 0;
for (const [name, bytes, want] of cases) {
  const started = performance.now();
  const verdict = inspectPdf(new Uint8Array(bytes));
  const got = verdict.ok ? "ok" : verdict.reason;
  const ms = (performance.now() - started).toFixed(1);
  if (got !== want) failed++;
  console.log(`${got === want ? "pass" : "FAIL"}  ${name.padEnd(40)} ${got.padEnd(11)} ${ms} ms`);
}

for (const path of process.argv.slice(2)) {
  const verdict = inspectPdf(new Uint8Array(readFileSync(path)));
  console.log(`real  ${path}: ${verdict.ok ? "ok" : verdict.reason}`);
}

if (failed) {
  console.error(`\n${failed} case(s) failed.`);
  process.exit(1);
}
console.log(`\nAll ${cases.length} cases behave as expected.`);
