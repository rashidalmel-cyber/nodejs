import { useEffect, useState } from "react";

export function useLoad(loader, dependencies = []) {
  const [state, setState] = useState({ data: null, loading: true, error: "" });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState({ data: null, loading: true, error: "" });
    Promise.resolve()
      .then(() => loader(controller.signal))
      .then(
        (data) => {
          if (!controller.signal.aborted)
            setState({ data, loading: false, error: "" });
        },
        (error) => {
          if (!controller.signal.aborted)
            setState({ data: null, loading: false, error: error.message });
        },
      );
    return () => controller.abort();
  }, [...dependencies, revision]);
  return { ...state, reload: () => setRevision((value) => value + 1) };
}

export function useDebounce(value, delay = 300) {
  const [result, setResult] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setResult(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return result;
}
