// src/components/dashboard/downtime/types.ts
export interface DowntimeRecord {
  year: string;
  Monthid: string;       // numeric month
  downtime?: number;
  rateofdowntime?: number;
  Targetdowntime?: number;
  seuildinterventiondowntime?: number;
  Project?: string;
}
