// src/components/dashboard/followupcost/CombinedTargetChart.tsx

import React, { useState, useEffect } from "react";
import ReactECharts from "echarts-for-react";
import axios from "axios";
import { getAccessToken } from "../../../auth/getToken";
import { msalInstance } from "../../../auth/msalInstance";
import { ProjectCostChart } from "./ProjectCostChart";

interface Props {
  siteId: string;
  followListId: string;
  targetListId: string;
  year: number;
}

export const CombinedTargetChart: React.FC<Props> = ({
  siteId,
  followListId,
  targetListId,
  year,
}) => {
  // just wrap ProjectCostChart with projectId="draxlmaeir"
  return (
    <ProjectCostChart
      siteId={siteId}
      followListId={followListId}
      targetListId={targetListId}
      projectId="draxlmaeir"
      year={year}
    />
  );
};
