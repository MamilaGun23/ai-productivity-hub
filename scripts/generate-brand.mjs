import { mkdir, writeFile } from "node:fs/promises";
// Original folded-pathway artwork, shared with RibbonMark. No external assets.
const mark = `<defs><linearGradient id="a" x1="18" y1="107" x2="88" y2="18" gradientUnits="userSpaceOnUse"><stop stop-color="#3144db"/><stop offset=".46" stop-color="#8475ff"/><stop offset="1" stop-color="#c3b7ff"/></linearGradient><linearGradient id="b" x1="65" y1="20" x2="111" y2="105" gradientUnits="userSpaceOnUse"><stop stop-color="#4888ff"/><stop offset=".5" stop-color="#43d8f1"/><stop offset="1" stop-color="#2355b8"/></linearGradient><linearGradient id="c" x1="36" y1="70" x2="104" y2="91" gradientUnits="userSpaceOnUse"><stop stop-color="#bba5ff"/><stop offset=".5" stop-color="#7159df"/><stop offset="1" stop-color="#30399a"/></linearGradient></defs><path d="M16 101 53 24Q60 10 73 20L87 30 49 111Q45 119 36 114Z" fill="url(#a)"/><path d="m65 19 20 10 29 73q3 8-6 12l-17 5-31-79Z" fill="url(#b)"/><path d="m40 70 46-9 12 28-46 12-20-11Z" fill="url(#c)"/><path d="m18 100 37-76q6-11 15-5M66 21l18 10 28 71M42 71l43-8" stroke="white" stroke-opacity=".62" stroke-width="1.8" stroke-linecap="round" fill="none"/><path d="m32 90 20 11 46-12-9 17-40 9Z" fill="#22265c" opacity=".35"/>`;
const svg = (content, width = 128, label = "AI Productivity Hub") => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 128" role="img" aria-label="${label}">${content}</svg>\n`;
await mkdir("public/brand", { recursive: true });
for (const variant of ["light", "dark"]) {
  const foreground = variant === "light" ? "#172548" : "#f2f5ff";
  await writeFile(`public/brand/icon-${variant}.svg`, svg(mark));
  await writeFile(`public/brand/logo-${variant}.svg`, svg(`${mark}<g fill="${foreground}" font-family="Geist,Inter,Arial,sans-serif"><text x="146" y="61" font-size="31" font-weight="600" letter-spacing="-1">AI Productivity</text><text x="147" y="92" font-size="19" letter-spacing="9">HUB</text><path d="M240 85h110" stroke="${foreground}" stroke-opacity=".3"/></g>`, 378));
}
await writeFile("src/app/icon.svg", svg(mark));
