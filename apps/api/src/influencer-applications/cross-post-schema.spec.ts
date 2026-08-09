import {
  MAX_CROSS_POSTS,
  SubmitSubmissionRequestSchema,
} from "@jsure/shared";

const posts = [{ subType: "INSTAGRAM", url: "https://www.instagram.com/p/1" }];

function parse(crossPosts: unknown) {
  return SubmitSubmissionRequestSchema.safeParse({ posts, crossPosts });
}

describe("SubmitSubmissionRequestSchema.crossPosts", () => {
  it("미전달이면 빈 배열로 채워진다", () => {
    const result = SubmitSubmissionRequestSchema.safeParse({ posts });
    expect(result.success).toBe(true);
    expect(result.success && result.data.crossPosts).toEqual([]);
  });

  it("OTHER 는 platformName 이 없으면 거부한다", () => {
    expect(parse([{ platform: "OTHER", url: "https://blog.example.jp/1" }]).success).toBe(
      false,
    );
  });

  it("OTHER 는 platformName 이 있으면 통과한다", () => {
    expect(
      parse([
        {
          platform: "OTHER",
          platformName: "はてなブログ",
          url: "https://blog.example.jp/1",
        },
      ]).success,
    ).toBe(true);
  });

  it("OTHER 가 아닌데 platformName 이 오면 거부한다", () => {
    expect(
      parse([
        {
          platform: "LIPS",
          platformName: "LIPS",
          url: "https://lipscosme.com/posts/1",
        },
      ]).success,
    ).toBe(false);
  });

  it(`${MAX_CROSS_POSTS}건까지 허용하고 초과하면 거부한다`, () => {
    const row = { platform: "LIPS", url: "https://lipscosme.com/posts/1" };
    expect(parse(Array(MAX_CROSS_POSTS).fill(row)).success).toBe(true);
    expect(parse(Array(MAX_CROSS_POSTS + 1).fill(row)).success).toBe(false);
  });

  it("URL 형식이 아니면 거부한다", () => {
    expect(parse([{ platform: "LIPS", url: "lipscosme.com/posts/1" }]).success).toBe(
      false,
    );
  });
});
