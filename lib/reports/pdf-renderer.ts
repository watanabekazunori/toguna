/**
 * HTML → PDF レンダラー
 * @vercel/og 互換の Edge Runtime 想定、fallback として Node.js Puppeteer 使用
 * 印刷最適化 CSS を注入してレポートを PDF 出力
 */

export interface PdfRenderOptions {
  /** レンダリングするページの URL (相対パス可) */
  url: string;
  /** PDF ページサイズ */
  format?: "A4" | "Letter";
  /** ランドスケープ */
  landscape?: boolean;
  /** ベース URL (サーバー側レンダリング用) */
  baseUrl?: string;
}

export interface PdfResult {
  buffer: Buffer;
  sizeBytes: number;
  renderedAt: Date;
}

/**
 * Puppeteer で HTML ページを PDF に変換
 * Next.js Route Handler (Node.js Runtime) から呼び出す
 */
export async function renderPdf(options: PdfRenderOptions): Promise<PdfResult> {
  const { url, format = "A4", landscape = false, baseUrl } = options;

  // Puppeteer を動的 import (Edge Runtime では不可のため)
  const puppeteer = await import("puppeteer").catch(() => null);
  if (!puppeteer) {
    throw new Error("puppeteer is not available in this environment");
  }

  const fullUrl = url.startsWith("http")
    ? url
    : `${baseUrl ?? process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"}${url}`;

  const browser = await puppeteer.default.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    const page = await browser.newPage();

    // 認証 Cookie を引き継ぐ場合は呼び出し元で設定すること
    await page.goto(fullUrl, { waitUntil: "networkidle2", timeout: 30_000 });

    // 印刷用スタイル強制適用
    await page.emulateMediaType("print");

    const pdfBuffer = await page.pdf({
      format,
      landscape,
      margin: { top: "12mm", bottom: "12mm", left: "10mm", right: "10mm" },
      printBackground: true,
    });

    const buffer = Buffer.from(pdfBuffer);
    return { buffer, sizeBytes: buffer.byteLength, renderedAt: new Date() };
  } finally {
    await browser.close();
  }
}

/**
 * サーバー側 HTML 文字列から PDF を生成 (Puppeteer data: URL 方式)
 * 認証不要なシンプルなレポート向け
 */
export async function renderPdfFromHtml(
  html: string,
  options: Omit<PdfRenderOptions, "url"> = {}
): Promise<PdfResult> {
  const { format = "A4", landscape = false } = options;

  const puppeteer = await import("puppeteer").catch(() => null);
  if (!puppeteer) {
    throw new Error("puppeteer is not available");
  }

  const browser = await puppeteer.default.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle2" });
    await page.emulateMediaType("print");

    const pdfBuffer = await page.pdf({
      format,
      landscape,
      margin: { top: "12mm", bottom: "12mm", left: "10mm", right: "10mm" },
      printBackground: true,
    });

    const buffer = Buffer.from(pdfBuffer);
    return { buffer, sizeBytes: buffer.byteLength, renderedAt: new Date() };
  } finally {
    await browser.close();
  }
}

/** PDF レスポンスヘッダーを構築 */
export function buildPdfHeaders(filename: string): HeadersInit {
  return {
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    "Cache-Control": "no-store",
  };
}

// END_OF_FILE
