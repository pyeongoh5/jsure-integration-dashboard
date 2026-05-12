import { useQuery } from "@tanstack/react-query";
import { HealthResponseSchema } from "@jsure/shared";
import { api } from "@/lib/api";

export function Home() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["health"],
    queryFn: async () => {
      const res = await api.get("/health");
      return HealthResponseSchema.parse(res.data);
    },
  });

  if (isLoading) return <p>Loading…</p>;
  if (error) return <p>API에 연결할 수 없습니다.</p>;

  return (
    <section>
      <p>Status: {data?.status}</p>
    </section>
  );
}
