// types.ts
export interface CarImage {
  id?: number;
  name: string;
  data: string;
  carline?: string;
  projectId: string;
  createdAt: string;
}
export interface AreaImage {
  id?: number;
  projectId: string;
  area: string;
  imageData: string;
  createdAt: string;
  name?: string; // <-- add this line
}

export interface ChangeItem {
  ID?: string;
  Status?: string;
  OEM?: string;
  Carline?: string;
  Constructedspace?: string;
  Handdrivers?: string;
  Projectphase?: string;
  DeadlineTBT?: string;
  Modelyear?: string;
  Realizationplanned?: string;
  Approxrealizationdate?: string;
  StartdateProcessinfo?: string;
  EnddateProcessinfo?: string;
  Processnumber?: string;
  OEMOfferChangenumber?: string;
  OEMChangenumber?: string;
  Reasonforchanges?: string;
  StartdatePhase4?: string;
  EnddatePhase4?: string;
  StartdatePAVPhase4?: string;
  EnddatePAVPhase4?: string;
  EstimatedcostsPAVPhase4?: number;
  ToolsutilitiesavailablePAVPhase4?: string;
  ProcessFMEAPAVPhase4?: string;
  PLPRelevantPAVPhase4?: boolean;
  RisklevelactualPAVPhase4?: string;
  StartdatePhase8?: string;
  EnddatePhase8?: string;
  Changepackages?: string;
  ProductSafetyRelevant?: boolean;
  EndDateLogisticPhase4?: string;
  EndDateQSPhase4?: string;
  EndDatePSCRPhase4?: string;
  Parameters?: string;

  // time-bucket fields
  processyear?: string;
  processmonth?: string;
  processday?: string;
  processid?: string;

  // scrap/cost/downtime
  Estimatedscrap?: number;
  Estimatedcost?: number;
  Estimateddowntime?: number;
  Estimatedchangedate?: string;
  Actualscrap?: number;
  Scrap?: string;
  Actualcost?: number;
  Actualdowntime?: number;
  Changedate?: string;

  // working days
  WorkingDaysProcess?: number;
  WorkingDaysPhase4?: number;
  WorkingDaysPAVPhase4?: number;
  WorkingDaysPAVPhase8?: number;

  // grouping
  SheetName?: string;
}

// also export any other shared types:
export interface MonthlyKPIItem { /* … */ }
export interface FollowCostItem { /* … */ }
export interface IProject { /* … */ }
export interface AreaImage { projectId: string; image: string; }