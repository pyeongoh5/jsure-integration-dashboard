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

/** 인플루언서 개인 데이터 키 프리픽스 — 프라이빗 버킷에 저장하고 공개 URL 발급을 금지한다. */
const PRIVATE_KEY_PREFIXES = ["insights/", "attachments/"];

function isPrivateKey(objectKey: string): boolean {
  return PRIVATE_KEY_PREFIXES.some((prefix) => objectKey.startsWith(prefix));
}

@Injectable()
export class R2Service implements OnModuleInit {
  private readonly logger = new Logger(R2Service.name);
  private client!: S3Client;
  private bucket!: string;
  private privateBucket!: string;
  private publicBaseUrl: string | null = null;

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
    // 미설정이면 기존처럼 단일 버킷으로 동작 (하위 호환).
    this.privateBucket =
      this.config.get<string>("R2_PRIVATE_BUCKET") ?? bucket;
    this.publicBaseUrl =
      this.config.get<string>("R2_PUBLIC_BASE_URL")?.replace(/\/+$/, "") ??
      null;
  }

  /** 키 프리픽스로 대상 버킷 결정 — 개인 데이터는 프라이빗 버킷. */
  private bucketFor(objectKey: string): string {
    return isPrivateKey(objectKey) ? this.privateBucket : this.bucket;
  }

  /**
   * 공개 자산(캠페인 썸네일·공지 이미지 등)의 영구 공개 URL.
   * R2_PUBLIC_BASE_URL 미설정이거나 비공개 키면 null — 호출자가 presign 으로 fallback.
   */
  publicUrl(objectKey: string): string | null {
    if (!this.publicBaseUrl || isPrivateKey(objectKey)) return null;
    return `${this.publicBaseUrl}/${objectKey}`;
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
      Bucket: this.bucketFor(input.objectKey),
      Key: input.objectKey,
      ContentType: input.contentType,
      ContentLength: input.contentLength,
    });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSec });
  }

  async presignGet(objectKey: string, expiresInSec = 300): Promise<string> {
    this.ensureReady();
    const command = new GetObjectCommand({
      Bucket: this.bucketFor(objectKey),
      Key: objectKey,
    });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSec });
  }

  async headObject(
    objectKey: string,
  ): Promise<{ contentType: string | null; contentLength: number | null }> {
    this.ensureReady();
    const out = await this.client.send(
      new HeadObjectCommand({ Bucket: this.bucketFor(objectKey), Key: objectKey }),
    );
    return {
      contentType: out.ContentType ?? null,
      contentLength: out.ContentLength ?? null,
    };
  }

  async deleteObject(objectKey: string): Promise<void> {
    this.ensureReady();
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucketFor(objectKey), Key: objectKey }),
    );
  }
}
