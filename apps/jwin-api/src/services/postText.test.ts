import { describe, expect, it } from 'vitest';
import { buildPostText } from './scheduler';

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
