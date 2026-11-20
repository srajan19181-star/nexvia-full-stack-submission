import "dotenv/config";
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { prisma } from "@aureva/database";

const apiUrl = (process.env.STORAGE_API_URL ?? "http://localhost:4100/api/v1").replace(/\/$/, "");
const endpoint = process.env.S3_ENDPOINT;
const bucket = process.env.S3_BUCKET;
const region = process.env.S3_REGION ?? "us-east-1";
const accessKeyId = process.env.S3_ACCESS_KEY;
const secretAccessKey = process.env.S3_SECRET_KEY;

if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) throw new Error("S3 environment variables are required");

const s3 = new S3Client({ endpoint, region, forcePathStyle: true, credentials: { accessKeyId, secretAccessKey } });
const content = Buffer.from("RIFF\u0004\u0000\u0000\u0000WEBPVP8 ", "binary");
let upload;

async function json(response) {
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) throw new Error(`${response.status} ${payload?.error?.code ?? "INVALID_RESPONSE"}: ${payload?.error?.message ?? "Request failed"}`);
  return payload.data;
}

try {
  const loginResponse = await fetch(`${apiUrl}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "vendor@aureva.local", password: "AurevaDemo2026!" }),
  });
  await json(loginResponse);
  const cookies = loginResponse.headers.getSetCookie().map((value) => value.split(";", 1)[0]).join("; ");
  const csrf = decodeURIComponent(cookies.split("; ").find((value) => value.startsWith("aureva_csrf="))?.split("=")[1] ?? "");
  if (!csrf) throw new Error("Login did not issue a CSRF cookie");

  upload = await json(await fetch(`${apiUrl}/vendors/uploads/presign`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: cookies, "x-csrf-token": csrf },
    body: JSON.stringify({ fileName: `storage-check-${Date.now()}.webp`, contentType: "image/webp", size: content.length }),
  }));

  const putResponse = await fetch(upload.uploadUrl, { method: "PUT", headers: { "content-type": "image/webp" }, body: content });
  if (!putResponse.ok) throw new Error(`Object upload failed with ${putResponse.status}`);

  const verified = await json(await fetch(`${apiUrl}/vendors/uploads/${upload.id}/complete`, {
    method: "POST",
    headers: { cookie: cookies, "x-csrf-token": csrf },
  }));
  if (verified.status !== "VERIFIED") throw new Error(`Unexpected media status: ${verified.status}`);

  const publicResponse = await fetch(upload.publicUrl);
  const downloaded = Buffer.from(await publicResponse.arrayBuffer());
  if (!publicResponse.ok || !downloaded.equals(content)) throw new Error("Public object response did not match the uploaded bytes");

  process.stdout.write(`${JSON.stringify({ verified: true, uploadId: upload.id, key: upload.key, bytes: downloaded.length }, null, 2)}\n`);
} finally {
  if (upload?.key) await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: upload.key })).catch(() => undefined);
  if (upload?.id) await prisma.mediaUpload.deleteMany({ where: { id: upload.id } }).catch(() => undefined);
  await prisma.$disconnect();
}
