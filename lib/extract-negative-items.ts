// lib/letters/extract-negative-items.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { OpenAI } from 'openai';
// import pdfParse from 'pdf-parse';
// import sharp from 'sharp';
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export type NegativeItem = {
  creditor: string;
  account_type: string;
  account_last4?: string;
  bureaus: ('Experian' | 'Equifax' | 'TransUnion')[];
  reason: string; // short reason text
  status: 'Open' | 'Closed';
  suggested_letter_type:
    | '609'
    | 'Debt Validation'
    | 'Incorrect Information'
    | 'Cease & Desist';
};

// export async function extractTextFromPdf(
//   buffer: ArrayBuffer | Buffer
// ): Promise<string> {
//   // Try the UMD/CJS build first (works well in Node, no worker file)
//   let pdfjs: any;
//   // try {
//   //   const mod = await import('pdfjs-dist/build/pdf.mjs'); // UMD/CJS-ish
//   //   pdfjs = (mod as any).default ?? mod;
//   // } catch {
//   // Fallback: legacy ESM build (works when properly externalized + non-eval devtool)
//   const mod = await import('pdfjs-dist/legacy/build/pdf.mjs');
//   pdfjs = mod as any;
//   // }

//   // No worker in a route handler
//   if (pdfjs?.GlobalWorkerOptions) {
//     pdfjs.GlobalWorkerOptions.workerSrc = undefined;
//   }

//   const data = Buffer.isBuffer(buffer)
//     ? new Uint8Array(buffer)
//     : new Uint8Array(buffer);
//   const loadingTask = pdfjs.getDocument({ data });
//   const pdf = await loadingTask.promise;

//   let out = '';
//   for (let p = 1; p <= pdf.numPages; p++) {
//     const page = await pdf.getPage(p);
//     const tc = await page.getTextContent();
//     out +=
//       (tc.items as any[])
//         .map((i) => (typeof i?.str === 'string' ? i.str : ''))
//         .join(' ') + '\n';
//   }
//   return out.trim();
// }

// // ---------- OCR HELPERS (image -> text) ----------
// async function preprocessImageForOCR(input: Buffer): Promise<Buffer> {
//   // auto-orient using EXIF, grayscale, mild sharpening, slight binarization
//   return await sharp(input)
//     .rotate()
//     .grayscale()
//     .sharpen()
//     .normalise()
//     .threshold(180) // tweak if needed (160–200)
//     .toFormat('png') // tesseract likes PNG
//     .toBuffer();
// }

// export async function ocrImageToText(
//   imageBuf: ArrayBuffer | Buffer
// ): Promise<string> {
//   const buf = Buffer.isBuffer(imageBuf) ? imageBuf : Buffer.from(imageBuf);
//   const prepped = await preprocessImageForOCR(buf);

//   // NOTE: First run downloads eng.traineddata (~10–15MB) and caches it.
//   const result = await Tesseract.recognize(prepped, 'eng', {
//     // logger: (m) => console.log(m), // uncomment for debugging
//   });

//   const text = (result.data?.text || '').trim();
//   return text;
// }

// lib/extract-negative-items.ts

// lib/extract-negative-items.ts

// export async function extractTextFromPdf(
//   buffer: ArrayBuffer | Buffer
// ): Promise<string> {
//   // ✅ Correctly get the constructor
//   const mod: any = await import('pdf2json');
//   const PDFParser = mod.default ?? mod; // pdf2json exports the class as default
//   const pdfParser = new PDFParser();

//   const nodeBuf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);

//   return await new Promise<string>((resolve, reject) => {
//     pdfParser.on('pdfParser_dataError', (err: any) => {
//       reject(err?.parserError || err);
//     });

//     pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
//       try {
//         // 1) built-in aggregator
//         let raw = '';
//         if (typeof pdfParser.getRawTextContent === 'function') {
//           raw = String(pdfParser.getRawTextContent() || '').trim();
//         }

//         // 2) manual decode fallback if raw looks too small
//         if (!raw || raw.length < 10) {
//           const pages = pdfData?.formImage?.Pages ?? [];
//           const chunks: string[] = [];
//           for (const page of pages) {
//             const texts = page?.Texts ?? [];
//             for (const t of texts) {
//               const runs = t?.R ?? [];
//               for (const r of runs) {
//                 if (r?.T) {
//                   // pdf2json stores URL-encoded text; '+' = space
//                   const decoded = decodeURIComponent(
//                     String(r.T).replace(/\+/g, '%20')
//                   );
//                   if (decoded) chunks.push(decoded);
//                 }
//               }
//             }
//             chunks.push('\n'); // page break
//           }
//           raw = chunks
//             .join(' ')
//             .replace(/\s+\n\s+/g, '\n')
//             .trim();
//         }

//         resolve(raw);
//       } catch (e) {
//         resolve(''); // let your OCR fallback handle scanned PDFs
//       }
//     });

//     // Use buffer-based API (no temp file)
//     if (typeof pdfParser.parseBuffer === 'function') {
//       pdfParser.parseBuffer(nodeBuf);
//     } else {
//       reject(new Error('pdf2json version missing parseBuffer()'));
//     }
//   });
// }

// --- PDF text extraction: pdf2json first, Poppler pdftotext fallback ---
export async function extractTextFromPdf(
  buffer: ArrayBuffer | Buffer
): Promise<string> {
  // First try pdf2json (Node-safe, no extra binaries)
  const textViaPdf2json = await extractTextViaPdf2json(buffer);
  if (textViaPdf2json && textViaPdf2json.trim().length >= 20)
    return textViaPdf2json;

  // If pdf2json yields little/none (common with “empty text layer” PDFs), use Poppler
  const textViaPoppler = await extractTextViaPdftotext(buffer).catch(() => '');
  if (textViaPoppler && textViaPoppler.trim().length > 0) return textViaPoppler;

  // Nothing meaningful; let your caller decide to OCR pages if desired
  return '';
}

// ---- pdf2json path (constructor + decoding fixed) ----
async function extractTextViaPdf2json(
  buffer: ArrayBuffer | Buffer
): Promise<string> {
  const mod: any = await import('pdf2json');
  const PDFParser = mod.default ?? mod; // default export is the class
  const pdfParser = new PDFParser(undefined, 1); // <-- “1” enables raw text aggregation (per docs/answers)

  const nodeBuf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);

  return await new Promise<string>((resolve, reject) => {
    pdfParser.on('pdfParser_dataError', (err: any) =>
      reject(err?.parserError || err)
    );
    pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
      try {
        // 1) built-in raw dump
        let text = '';
        if (typeof pdfParser.getRawTextContent === 'function') {
          text = String(pdfParser.getRawTextContent() || '').trim();
        }

        // 2) manual decode of URL-encoded runs if raw is too small
        if (!text || text.length < 20) {
          const pages = pdfData?.formImage?.Pages ?? [];
          const pieces: string[] = [];
          for (const p of pages) {
            for (const t of p?.Texts ?? []) {
              for (const r of t?.R ?? []) {
                if (r?.T) {
                  // IMPORTANT: pdf2json encodes spaces as "+"; convert BEFORE decoding
                  const s = String(r.T).replace(/\+/g, '%20');
                  pieces.push(decodeURIComponent(s));
                }
              }
            }
            pieces.push('\n');
          }
          text = pieces
            .join(' ')
            .replace(/\s+\n\s+/g, '\n')
            .trim();
        }

        resolve(text);
      } catch {
        resolve('');
      }
    });

    pdfParser.parseBuffer(nodeBuf);
  });
}

// ---- Poppler pdftotext fallback (requires Poppler installed or provided path) ----
async function extractTextViaPdftotext(
  buffer: ArrayBuffer | Buffer
): Promise<string> {
  const { spawn } = await import('child_process');
  const fs = await import('fs/promises');
  const os = await import('os');
  const path = await import('path');

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pdftotext-'));
  const inFile = path.join(tmpDir, 'in.pdf');

  try {
    const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
    await fs.writeFile(inFile, buf);

    // Use env PDFTOTEXT_PATH if set, otherwise rely on PATH
    const bin = process.env.PDFTOTEXT_PATH || 'pdftotext';
    // -layout keeps columns, -nopgbrk avoids formfeed chars, output "-" writes to stdout
    const child = spawn(bin, ['-layout', '-nopgbrk', inFile, '-'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let out = '';
    let err = '';
    child.stdout.on('data', (d) => (out += d.toString()));
    child.stderr.on('data', (d) => (err += d.toString()));

    await new Promise((res, rej) =>
      child.on('close', (code) =>
        code === 0 ? res(null) : rej(new Error(err || `pdftotext exit ${code}`))
      )
    );

    return out.trim();
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function ocrImageToText(
  imageBuf: ArrayBuffer | Buffer
): Promise<string> {
  const buf = Buffer.isBuffer(imageBuf) ? imageBuf : Buffer.from(imageBuf);

  // Lazy‑load sharp + tesseract ONLY here
  const sharp = (await import('sharp')).default;
  const Tesseract = (await import('tesseract.js')).default;

  const prepped = await sharp(buf)
    .rotate()
    .grayscale()
    .sharpen()
    .normalise()
    .threshold(180)
    .toFormat('png')
    .toBuffer();
  const result = await Tesseract.recognize(prepped, 'eng');
  return (result.data?.text || '').trim();
}

export async function extractNegativeItemsFromText(
  text: string
): Promise<NegativeItem[]> {
  const system = `You are a credit dispute expert. Read the given credit report text and extract ONLY negative or disputable items. 
Return strict JSON array of items with keys:
- creditor
- account_type
- account_last4 (if available)
- bureaus (array from ["Experian","Equifax","TransUnion"])
- reason (short)
- status ("Open" | "Closed")
- suggested_letter_type: one of ["609","Debt Validation","Incorrect Information","Cease & Desist"].

If nothing found, return [].`;

  const user = `CREDIT REPORT TEXT:\n\n${text}`;

  const resp = await openai.responses.create({
    model: 'gpt-4.1-mini',
    input: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0.2,
  });

  const raw = (resp.output_text || '[]').trim();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as NegativeItem[];
  } catch {}
  // Fallback: try to pull JSON block if model added prose around it.
  const match = raw.match(/\[[\s\S]*\]$/);
  if (match) {
    return JSON.parse(match[0]) as NegativeItem[];
  }
  return [];
}
