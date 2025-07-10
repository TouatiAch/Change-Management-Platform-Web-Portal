// src/hooks/useQuestions.ts
import { useState, useEffect } from "react";
import { QuestionState } from "../pages/types";
import { graphService } from "../services/EmailgraphService";

export function useQuestions(
  projectKey: string,
  itemId: string
): {
  questions: QuestionState[];
  loading:   boolean;
  error:     string | null;
} {
  const [questions, setQuestions] = useState<QuestionState[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string|null>(null);

  useEffect(() => {
    if (!projectKey || !itemId) return;

    setLoading(true);
    graphService
      .listQuestions(projectKey, itemId)
      .then(setQuestions)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [projectKey, itemId]);

  return { questions, loading, error };
}
