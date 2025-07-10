// src/hooks/useGraphAuth.ts
import { msalInstance } from "../auth/msalInstance";
import { getAccessToken } from "../auth/getToken";
import { graphTokenRequest } from "../authConfig";

export async function getGraphToken(): Promise<string | null> {
  return getAccessToken(msalInstance, graphTokenRequest.scopes);
}
