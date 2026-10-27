import { gzipSync, gunzipSync } from "node:zlib";
const MiB = 1024 * 1024;
function safeName(name) {
  if (
    !name ||
    name.startsWith("/") ||
    name.includes("\\") ||
    name.split("/").some((p) => p === ".." || p === "." || !p) ||
    Buffer.byteLength(name) > 100
  )
    throw new Error(`Unsafe archive path: ${name}`);
}
const octal = (value, length) =>
  value.toString(8).padStart(length - 1, "0") + "\0";
export function createArchive(files) {
  if (files.length > 2000) throw new Error("Too many archive entries");
  let total = 0;
  const blocks = [];
  const names = new Set();
  for (const { name, data } of files) {
    safeName(name);
    if (names.has(name)) throw new Error("Duplicate archive path");
    names.add(name);
    if (data.length > 8 * MiB) throw new Error(`File exceeds 8 MiB: ${name}`);
    total += data.length;
    if (total > 64 * MiB) throw new Error("Unpacked size exceeds 64 MiB");
    const header = Buffer.alloc(512);
    header.write(name, 0, 100, "utf8");
    header.write(octal(0o644, 8), 100);
    header.write(octal(0, 8), 108);
    header.write(octal(0, 8), 116);
    header.write(octal(data.length, 12), 124);
    header.write(octal(0, 12), 136);
    header.fill(32, 148, 156);
    header[156] = 48;
    header.write("ustar\0", 257);
    header.write("00", 263);
    const checksum = header.reduce((sum, b) => sum + b, 0);
    header.write(checksum.toString(8).padStart(6, "0") + "\0 ", 148);
    blocks.push(header, data, Buffer.alloc((512 - (data.length % 512)) % 512));
  }
  blocks.push(Buffer.alloc(1024));
  const gzip = gzipSync(Buffer.concat(blocks), { level: 9 });
  if (gzip.length > 32 * MiB) throw new Error("Archive exceeds 32 MiB");
  return gzip;
}
export function inspectArchive(gzip) {
  if (gzip.length > 32 * MiB) throw new Error("Archive exceeds 32 MiB");
  const tar = gunzipSync(gzip, { maxOutputLength: 66 * MiB }),
    names = [];
  let offset = 0,
    total = 0;
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((b) => b === 0)) {
      if (
        tar.length - offset < 1024 ||
        !tar.subarray(offset, offset + 1024).every((b) => b === 0)
      )
        throw new Error("Missing tar terminator");
      if (
        tar.length - offset - 1024 > MiB ||
        !tar.subarray(offset + 1024).every((b) => b === 0)
      )
        throw new Error("Invalid tar padding");
      return names;
    }
    const name = header.subarray(0, 100).toString("utf8").replace(/\0.*$/s, "");
    safeName(name);
    const type = header[156];
    if (type !== 48 && type !== 0) throw new Error("Non-regular archive entry");
    const sum = Number.parseInt(header.subarray(148, 156).toString().trim(), 8);
    const actual = header.reduce(
      (s, b, i) => s + (i >= 148 && i < 156 ? 32 : b),
      0,
    );
    if (sum !== actual) throw new Error("Invalid tar checksum");
    const size = Number.parseInt(
      header.subarray(124, 136).toString().trim(),
      8,
    );
    if (!Number.isFinite(size) || size < 0 || size > 8 * MiB)
      throw new Error("Invalid tar file size");
    total += size;
    if (total > 64 * MiB || names.length >= 2000)
      throw new Error("Archive limits exceeded");
    if (names.includes(name)) throw new Error("Duplicate archive path");
    names.push(name);
    offset += 512 + Math.ceil(size / 512) * 512;
    if (offset > tar.length) throw new Error("Truncated tar data");
  }
  throw new Error("Missing tar terminator");
}
