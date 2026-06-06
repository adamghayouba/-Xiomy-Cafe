function escapePdfText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function toLatin1Bytes(value: string) {
  const bytes = new Uint8Array(value.length);

  for (let index = 0; index < value.length; index += 1) {
    const codePoint = value.charCodeAt(index);
    bytes[index] = codePoint <= 255 ? codePoint : 63;
  }

  return bytes;
}

function joinBytes(chunks: Uint8Array[]) {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  chunks.forEach((chunk) => {
    result.set(chunk, offset);
    offset += chunk.length;
  });

  return result;
}

function buildSimplePdf(linesByPage: string[][]) {
  const objects: Uint8Array[] = [];

  const pageObjectNumbers = linesByPage.map((_, index) => 3 + index);
  const contentObjectNumbers = linesByPage.map((_, index) => 3 + linesByPage.length + index);
  const fontObjectNumber = 3 + linesByPage.length * 2;

  const pagesKids = pageObjectNumbers.map((objectNumber) => `${objectNumber} 0 R`).join(" ");

  objects.push(
    toLatin1Bytes("<< /Type /Catalog /Pages 2 0 R >>"),
    toLatin1Bytes(`<< /Type /Pages /Kids [${pagesKids}] /Count ${linesByPage.length} >>`)
  );

  linesByPage.forEach((pageLines, index) => {
    const pageObjectNumber = pageObjectNumbers[index];
    const contentObjectNumber = contentObjectNumbers[index];
    const streamText = [
      "BT",
      "/F1 11 Tf",
      "14 TL",
      "50 760 Td",
      ...pageLines.map((line, lineIndex) =>
        `${lineIndex === 0 ? "" : "T* " }(${escapePdfText(line)}) Tj`
      ),
      "ET"
    ].join("\n");
    const streamBytes = toLatin1Bytes(streamText);

    objects[pageObjectNumber - 1] = toLatin1Bytes(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontObjectNumber} 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`
    );
    objects[contentObjectNumber - 1] = joinBytes([
      toLatin1Bytes(`<< /Length ${streamBytes.length} >>\nstream\n`),
      streamBytes,
      toLatin1Bytes("\nendstream")
    ]);
  });

  objects[fontObjectNumber - 1] = toLatin1Bytes(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
  );

  const chunks: Uint8Array[] = [toLatin1Bytes("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n")];
  const xrefOffsets: number[] = [0];
  let currentOffset = chunks[0].length;

  objects.forEach((objectBody, index) => {
    xrefOffsets.push(currentOffset);
    const prefix = toLatin1Bytes(`${index + 1} 0 obj\n`);
    const suffix = toLatin1Bytes("\nendobj\n");
    chunks.push(prefix, objectBody, suffix);
    currentOffset += prefix.length + objectBody.length + suffix.length;
  });

  const xrefStart = currentOffset;
  const xrefLines = [`xref`, `0 ${objects.length + 1}`, "0000000000 65535 f "];

  for (let index = 1; index < xrefOffsets.length; index += 1) {
    xrefLines.push(`${xrefOffsets[index].toString().padStart(10, "0")} 00000 n `);
  }

  const trailer = [
    "trailer",
    `<< /Size ${objects.length + 1} /Root 1 0 R >>`,
    "startxref",
    `${xrefStart}`,
    "%%EOF"
  ].join("\n");

  chunks.push(toLatin1Bytes(`${xrefLines.join("\n")}\n${trailer}`));

  return joinBytes(chunks);
}

export function downloadSimplePdf(filename: string, lines: string[]) {
  const linesPerPage = 42;
  const pages: string[][] = [];

  for (let index = 0; index < lines.length; index += linesPerPage) {
    pages.push(lines.slice(index, index + linesPerPage));
  }

  const pdfBytes = buildSimplePdf(pages.length ? pages : [["Sin contenido"]]);
  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}
