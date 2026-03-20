import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../config/env.js";
import { v4 as uuidv4 } from "uuid";

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: env.AWS_REGION,
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY || "",
      },
    });
  }
  return s3Client;
}

/**
 * Upload a file to S3 and return the S3 key.
 */
export async function uploadToS3(
  buffer: Buffer,
  filename: string,
  mimeType: string,
): Promise<string> {
  const client = getS3Client();
  const key = `uploads/${uuidv4()}/${filename}`;

  await client.send(
    new PutObjectCommand({
      Bucket: env.AWS_S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    }),
  );

  return key;
}

/**
 * Get a presigned URL for downloading a file from S3.
 */
export async function getS3Url(key: string): Promise<string> {
  const client = getS3Client();

  const url = await getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: env.AWS_S3_BUCKET,
      Key: key,
    }),
    { expiresIn: 3600 },
  );

  return url;
}

/**
 * Get the raw file content from S3 as a Buffer.
 */
export async function getS3File(key: string): Promise<Buffer> {
  const client = getS3Client();

  const response = await client.send(
    new GetObjectCommand({
      Bucket: env.AWS_S3_BUCKET,
      Key: key,
    }),
  );

  const stream = response.Body;
  if (!stream) {
    throw new Error("Failed to get file from S3");
  }

  const chunks: Uint8Array[] = [];
  for await (const chunk of stream as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * Delete a file from S3.
 */
export async function deleteFromS3(key: string): Promise<void> {
  const client = getS3Client();

  await client.send(
    new DeleteObjectCommand({
      Bucket: env.AWS_S3_BUCKET,
      Key: key,
    }),
  );
}
