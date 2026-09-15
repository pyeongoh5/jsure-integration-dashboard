import { describe, expect, it } from 'vitest';
import { carouselFingerprint } from '../lib/ads-api';
import { buildCardPostText, buildPostText, shouldUseCarousel } from './scheduler';

const LP = 'https://jwin.example/c/demo';
const RULES = 'https://brand.example/rules';

describe('buildPostText', () => {
  it('규칙 링크가 없으면 LP URL 을 마지막 줄에 붙인다', () => {
    expect(buildPostText({ bodyText: '応募受付中！', lpUrl: LP, rulesUrl: null })).toBe(
      `応募受付中！\n${LP}`,
    );
  });

  it('규칙 링크는 LP URL 앞에 둔다 — 카드가 LP 로 잡히도록', () => {
    expect(buildPostText({ bodyText: '応募受付中！', lpUrl: LP, rulesUrl: RULES })).toBe(
      `応募受付中！\n${RULES}\n${LP}`,
    );
  });

  it('{{LP_URL}} 이 있으면 그 자리를 존중하고 규칙 링크를 뒤에 붙인다', () => {
    expect(
      buildPostText({ bodyText: `応募は ${'{{LP_URL}}'} から`, lpUrl: LP, rulesUrl: RULES }),
    ).toBe(`応募は ${LP} から\n${RULES}`);
  });
});

describe('buildCardPostText', () => {
  it('LP URL 을 자동으로 붙이지 않는다 — 카드가 목적지를 갖는다', () => {
    expect(buildCardPostText({ bodyText: '応募受付中！', lpUrl: LP, rulesUrl: null })).toBe(
      '応募受付中！',
    );
  });

  it('규칙 링크는 유지한다', () => {
    expect(buildCardPostText({ bodyText: '応募受付中！', lpUrl: LP, rulesUrl: RULES })).toBe(
      `応募受付中！\n${RULES}`,
    );
  });

  it('{{LP_URL}} 을 명시한 소재는 그 자리를 치환한다', () => {
    expect(
      buildCardPostText({ bodyText: `応募は ${'{{LP_URL}}'} から`, lpUrl: LP, rulesUrl: null }),
    ).toBe(`応募は ${LP} から`);
  });
});

describe('shouldUseCarousel', () => {
  it('헤드라인 + 이미지 2장 이상일 때만 카드로 게시한다', () => {
    expect(shouldUseCarousel({ cardTitle: '応募はこちら', mediaUrls: ['a', 'b'] })).toBe(true);
    expect(shouldUseCarousel({ cardTitle: '応募はこちら', mediaUrls: ['a'] })).toBe(false);
    expect(shouldUseCarousel({ cardTitle: null, mediaUrls: ['a', 'b'] })).toBe(false);
  });
});

describe('carouselFingerprint', () => {
  it('구성이 같으면 같은 값, 하나라도 다르면 다른 값', () => {
    const base = { mediaUrls: ['a', 'b'], title: 't', destinationUrl: LP };
    expect(carouselFingerprint(base)).toBe(carouselFingerprint({ ...base }));
    expect(carouselFingerprint(base)).not.toBe(
      carouselFingerprint({ ...base, mediaUrls: ['b', 'a'] }),
    );
    expect(carouselFingerprint(base)).not.toBe(carouselFingerprint({ ...base, title: 'u' }));
    expect(carouselFingerprint(base)).not.toBe(
      carouselFingerprint({ ...base, destinationUrl: `${LP}/other` }),
    );
  });
});
