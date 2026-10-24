import { cp, mkdir } from "node:fs/promises";
// Browser-only text extraction needs the worker and character maps/fonts from
// the exact PDF.js version in package-lock.json. No CDN or runtime upload.
await mkdir("public/pdf-assets", { recursive: true });
await cp(
  "node_modules/pdfjs-dist/build/pdf.worker.min.mjs",
  "public/pdf.worker.min.mjs",
);
await Promise.all(
  ["cmaps", "standard_fonts"].map((name) =>
    cp(`node_modules/pdfjs-dist/${name}`, `public/pdf-assets/${name}`, {
      recursive: true,
    }),
  ),
);
await cp("node_modules/pdfjs-dist/LICENSE", "public/pdf-assets/LICENSE");
