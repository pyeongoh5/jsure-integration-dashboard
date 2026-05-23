import "./ErrorBanner.css";

export function ErrorBanner({ message }: { message: string }) {
  return <div className="err-banner">{message}</div>;
}
