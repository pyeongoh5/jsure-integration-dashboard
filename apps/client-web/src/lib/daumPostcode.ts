/**
 * 다음(카카오) 우편번호 서비스.
 * 키가 필요 없고 스크립트를 불러와 검색 레이어를 띄우는 방식이다.
 *
 * LINE 인앱 브라우저가 팝업(window.open)을 막는 경우가 있어 **레이어(embed) 방식**으로만 쓴다.
 * 스크립트 로드가 실패하면 주소를 아예 입력할 수 없게 되므로, 호출부는 실패를
 * 감지해 수동 입력 폼으로 되돌려야 한다.
 */

import { toKrAddress, type DaumPostcodeData, type KrAddressResult } from "@jsure/shared";

export type { KrAddressResult };

const SCRIPT_SRC =
  "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";

interface DaumPostcodeConstructorOptions {
  oncomplete: (data: DaumPostcodeData) => void;
  onclose?: () => void;
  width?: string;
  height?: string;
}

interface DaumPostcodeInstance {
  embed: (element: HTMLElement) => void;
}

declare global {
  interface Window {
    daum?: {
      Postcode: new (
        options: DaumPostcodeConstructorOptions,
      ) => DaumPostcodeInstance;
    };
  }
}

let loadPromise: Promise<void> | null = null;

/**
 * 스크립트를 1회만 불러온다. 실패하면 다음 시도에서 다시 받도록 캐시를 비운다
 * (일시적 네트워크 오류 뒤 재시도가 가능해야 한다).
 */
export function loadDaumPostcode(): Promise<void> {
  if (window.daum?.Postcode) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("daum postcode script load failed"));
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    loadPromise = null;
    throw error;
  });

  return loadPromise;
}

/**
 * 검색 레이어를 element 안에 붙인다.
 * 주소를 고르면 onSelect, 사용자가 닫으면 onClose 가 불린다.
 * 스크립트가 아직 로드되지 않았으면 아무것도 하지 않고 false 를 돌려준다.
 */
export function embedPostcodeSearch(
  element: HTMLElement,
  handlers: {
    onSelect: (result: KrAddressResult) => void;
    onClose: () => void;
  },
): boolean {
  const Postcode = window.daum?.Postcode;
  if (!Postcode) return false;

  // 백분율 높이를 넘기면 컨테이너가 플렉스 아이템일 때 확정되지 않아 iframe 이
  // 엉뚱한 높이로 잡히고, 내부 좌표와 실제 터치 지점이 어긋난다. 측정한 px 로 넘긴다.
  const { width, height } = element.getBoundingClientRect();

  new Postcode({
    oncomplete: (data) => handlers.onSelect(toKrAddress(data)),
    onclose: handlers.onClose,
    width: `${Math.round(width)}px`,
    height: `${Math.round(height)}px`,
  }).embed(element);
  return true;
}

/**
 * 화면 회전·키보드 노출로 컨테이너 크기가 바뀌면 iframe 도 따라가야 한다.
 * 다시 embed 하면 입력 중이던 내용이 날아가므로 크기만 갱신한다.
 */
export function resizePostcodeSearch(element: HTMLElement): void {
  const iframe = element.querySelector("iframe");
  if (!iframe) return;
  const { width, height } = element.getBoundingClientRect();
  iframe.style.width = `${Math.round(width)}px`;
  iframe.style.height = `${Math.round(height)}px`;
}
