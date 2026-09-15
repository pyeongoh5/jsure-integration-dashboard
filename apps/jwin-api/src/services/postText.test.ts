import { describe, expect, it } from 'vitest';
import { carouselFingerprint } from '../lib/ads-api';
import {
  buildCardPostText,
  buildCarouselSlides,
  buildPostText,
  shouldUseCarousel,
} from './scheduler';

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
  it('LP·규칙 링크를 자동으로 붙이지 않는다 — 카드 슬라이드가 목적지를 갖는다', () => {
    expect(buildCardPostText({ bodyText: '応募受付中！', lpUrl: LP })).toBe('応募受付中！');
  });

  it('{{LP_URL}} 을 명시한 소재는 그 자리를 치환한다', () => {
    expect(buildCardPostText({ bodyText: `応募は ${'{{LP_URL}}'} から`, lpUrl: LP })).toBe(
      `応募は ${LP} から`,
    );
  });
});

describe('buildCarouselSlides', () => {
  it('마지막 슬라이드는 규칙 페이지, 나머지는 LP 로 보낸다', () => {
    const slides = buildCarouselSlides({
      mediaUrls: ['img1', 'img2', 'img3'],
      cardTitle: '☝️抽選はこちらをタップ',
      lpUrl: LP,
      rulesUrl: RULES,
    });
    expect(slides).toEqual([
      { mediaUrl: 'img1', title: '☝️抽選はこちらをタップ', destinationUrl: LP },
      { mediaUrl: 'img2', title: '☝️抽選はこちらをタップ', destinationUrl: LP },
      { mediaUrl: 'img3', title: '☝️応募規約はこちら', destinationUrl: RULES },
    ]);
  });

  it('2장이면 첫 장 = 응모, 둘째 장 = 규칙', () => {
    const slides = buildCarouselSlides({
      mediaUrls: ['a', 'b'],
      cardTitle: 't',
      lpUrl: LP,
      rulesUrl: RULES,
    });
    expect(slides.map((slide) => slide.destinationUrl)).toEqual([LP, RULES]);
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
    const slide = (mediaUrl: string) => ({ mediaUrl, title: 't', destinationUrl: LP });
    const base = [slide('a'), slide('b')];
    expect(carouselFingerprint(base)).toBe(carouselFingerprint([slide('a'), slide('b')]));
    expect(carouselFingerprint(base)).not.toBe(carouselFingerprint([slide('b'), slide('a')]));
    expect(carouselFingerprint(base)).not.toBe(
      carouselFingerprint([slide('a'), { ...slide('b'), title: 'u' }]),
    );
    expect(carouselFingerprint(base)).not.toBe(
      carouselFingerprint([slide('a'), { ...slide('b'), destinationUrl: `${LP}/other` }]),
    );
  });
});
