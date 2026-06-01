import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  HeadObjectCommand,
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export type PresignPutInput = {
  objectKey: string;
  contentType: string;
  contentLength: number;
};

@Injectable()
export class R2Service implements OnModuleInit {
  private readonly logger = new Logger(R2Service.name);
  private client!: S3Client;
  private bucket!: string;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const accountId = this.config.get<string>("R2_ACCOUNT_ID");
    const accessKeyId = this.config.get<string>("R2_ACCESS_KEY_ID");
    const secretAccessKey = this.config.get<string>("R2_SECRET_ACCESS_KEY");
    const bucket = this.config.get<string>("R2_BUCKET");
    const endpoint =
      this.config.get<string>("R2_ENDPOINT") ??
      (accountId
        ? `https://${accountId}.r2.cloudflarestorage.com`
        : undefined);

    if (!accessKeyId || !secretAccessKey || !bucket || !endpoint) {
      this.logger.warn(
        "R2 환경변수가 누락되어 업로드 기능이 비활성화됩니다.",
      );
      return;
    }

    this.client = new S3Client({
      region: "auto",
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
    });
    this.bucket = bucket;
  }

  private ensureReady(): void {
    if (!this.client || !this.bucket) {
      throw new Error("R2가 설정되지 않았습니다");
    }
  }

  async presignPut(
    input: PresignPutInput,
    expiresInSec = 300,
  ): Promise<string> {
    this.ensureReady();
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: input.objectKey,
      ContentType: input.contentType,
      ContentLength: input.contentLength,
    });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSec });
  }

  async presignGet(objectKey: string, expiresInSec = 300): Promise<string> {
    this.ensureReady();
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
    });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSec });
  }

  async headObject(
    objectKey: string,
  ): Promise<{ contentType: string | null; contentLength: number | null }> {
    this.ensureReady();
    const out = await this.client.send(
      new HeadObjectCommand({ Bucket: this.bucket, Key: objectKey }),
    );
    return {
      contentType: out.ContentType ?? null,
      contentLength: out.ContentLength ?? null,
    };
  }

  async deleteObject(objectKey: string): Promise<void> {
    this.ensureReady();
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: objectKey }),
    );
  }
}
