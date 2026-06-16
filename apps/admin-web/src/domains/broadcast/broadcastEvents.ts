// BroadcastDialog 가 발송을 시작했음을 ProgressDock 에 알리기 위한 단순 이벤트 버스.
// dock 은 평소엔 폴링을 멈춰두다가 이 이벤트가 오면 즉시 폴링을 시작한다.

const EVENT_NAME = "jsure:broadcast-started";

export function notifyBroadcastStarted(): void {
  window.dispatchEvent(new Event(EVENT_NAME));
}

export function subscribeToBroadcastStarted(handler: () => void): () => void {
  window.addEventListener(EVENT_NAME, handler);
  return () => {
    window.removeEventListener(EVENT_NAME, handler);
  };
}
