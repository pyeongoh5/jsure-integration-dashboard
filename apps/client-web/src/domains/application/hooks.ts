import { useQuery } from "@tanstack/react-query";
import { getApplication, listApplications } from "./api";

export function useApplications() {
  return useQuery({
    queryKey: ["applications"],
    queryFn: listApplications,
  });
}

export function useApplication(id: string) {
  return useQuery({
    queryKey: ["application", id],
    queryFn: () => getApplication(id),
    enabled: !!id,
  });
}
