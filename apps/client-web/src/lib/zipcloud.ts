export interface ZipcloudResult {
  prefecture: string;
  city: string;
  town: string;
}

interface ZipcloudResponseItem {
  address1: string;
  address2: string;
  address3: string;
}

interface ZipcloudResponse {
  status: number;
  message: string | null;
  results: ZipcloudResponseItem[] | null;
}

const ENDPOINT = "https://zipcloud.ibsnet.co.jp/api/search";

export async function lookupPostalCode(
  postalCode: string,
): Promise<ZipcloudResult | null> {
  const digits = postalCode.replace(/[^\d]/g, "");
  if (digits.length !== 7) return null;
  const url = `${ENDPOINT}?zipcode=${digits}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`zipcloud error: ${res.status}`);
  const json = (await res.json()) as ZipcloudResponse;
  if (json.status !== 200 || !json.results || json.results.length === 0) {
    return null;
  }
  const first = json.results[0];
  return {
    prefecture: first.address1,
    city: first.address2,
    town: first.address3,
  };
}
