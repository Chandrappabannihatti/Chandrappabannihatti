import { useCallback, useEffect, useState } from "react";
import api from "../services/api";

/** Simple GET hook: const { data, loading, error, reload } = useFetch('/admin/dashboard') */
export default function useFetch(url, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get(url);
      setData(data);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load data");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, ...deps]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, reload: load };
}
