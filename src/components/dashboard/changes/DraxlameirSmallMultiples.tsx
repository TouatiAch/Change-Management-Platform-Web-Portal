// src/components/dashboard/DraxlameirSmallMultiples.tsx
import React from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts/core';

import {
  ToolboxComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  TooltipComponentOption,
  LegendComponentOption,
  GridComponentOption,
  ToolboxComponentOption
} from 'echarts/components';
import { BarChart, BarSeriesOption } from 'echarts/charts';
import { CanvasRenderer } from 'echarts/renderers';
import { AVAILABLE_PROJECTS } from '../../../constants/projects';


echarts.use([
  ToolboxComponent,
  LegendComponent,
  GridComponent,
  TooltipComponent,
  BarChart,
  CanvasRenderer
]);

type EChartsOption = echarts.ComposeOption<
  ToolboxComponentOption |
  TooltipComponentOption  |
  LegendComponentOption  |
  GridComponentOption    |
  BarSeriesOption
>;

export interface ChangeItem {
  SheetName?: string;  // Area
  OEM?: string;        // Project displayName
}

interface Props {
  items: ChangeItem[]; // already date-filtered
}

const DraxlameirSmallMultiples: React.FC<Props> = ({ items }) => {
  if (!items.length) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">
          Draxlameir — Changes by Area &amp; Project
        </h3>
        <div style={{ height: 360 }} />
      </div>
    );
  }

  // 1) Unique Areas & Projects
  const areas    = Array.from(new Set(items.map(i => i.SheetName || 'Unknown')));
  const projects = Array.from(new Set(items.map(i => i.OEM       || 'Unknown')));

  // 2) Palette for series & labels
  const palette = [
    '#5470C6', '#91CC75', '#FAC858',
    '#EE6666', '#73C0DE', '#3BA272',
    '#FC8452', '#9A60B4', '#EA7CCC'
  ];

  // 3) Logo lookup
  const findLogo = (displayName: string) => {
    const p = AVAILABLE_PROJECTS.find(
      x => x.displayName.toLowerCase() === displayName.toLowerCase()
    );
    return p?.logo || AVAILABLE_PROJECTS.find(x => x.id === 'other')!.logo;
  };

  // 4) Build one series per project, no explicit stack
  const series: BarSeriesOption[] = projects.map((proj, idx) => {
    const barColor = palette[idx % palette.length];

    // counts per area
    const data = areas.map(area =>
      items.filter(
        i =>
          (i.SheetName || 'Unknown') === area &&
          (i.OEM       || 'Unknown') === proj
      ).length
    );

    const logoUrl = findLogo(proj);

    // offset for logos & balloons side-by-side
    const spacing = 30;
    const offsetX = (idx - (projects.length - 1) / 2) * spacing;

    // markPoints: logo + balloon
    const markData = data.flatMap((val, i) => {
      if (val <= 0) return [];
      const x = areas[i];
      return [
        // logo
        {
          xAxis: x,
          yAxis: val,
          symbol: `image://${logoUrl}`,
          symbolSize: [24, 24],
          symbolOffset: [offsetX, -12]
        },
        // balloon
        {
          xAxis: x,
          yAxis: val,
          symbol: 'circle',
          symbolSize: 28,
          symbolOffset: [offsetX, -40],
          label: {
            show: true,
            position: 'inside',
            formatter: String(val),
            color: '#fff',
            fontWeight: 'bold'
          },
          itemStyle: { color: barColor }
        }
      ];
    });

    return {
      name: proj,
      type: 'bar',
      data,
      itemStyle: { color: barColor },
      markPoint: {
        symbolKeepAspect: true,
        data: markData
      },
      emphasis: { focus: 'series' }
    } as BarSeriesOption;
  });

  // 5) Compose the ECharts option
const option: EChartsOption = {
  color: palette,
  toolbox: {
    show: true,
    orient: 'vertical',
    right: 10,
    top: 'center',
    feature: {
      dataView:    { show: true, readOnly: false },
      magicType:   { show: true, type: ['stack','bar'] },
      saveAsImage: { show: true }
    }
  },
  tooltip: {
    trigger: 'axis',
    axisPointer: { type: 'shadow' }
  },
  legend: {
    bottom: 10,             // place legend below the bars
    orient: 'horizontal',
    data: projects,         // your project names array
    textStyle: { fontSize: 12 }
  },
  grid: {
    left: '3%',
    right: '4%',
    bottom: '20%',          // leave room for the legend
    containLabel: true
  },
  xAxis: {
    type: 'category',
    data: areas,
    name: 'Area',
    nameLocation: 'middle',
    nameGap: 30,
    nameTextStyle: {
      backgroundColor: '#eef2f6',
      padding: [4, 8],
      borderRadius: 4
    },
    axisLabel: {
      interval: 0,
      rotate: 0,            // keep labels horizontal
      width: 80,            // max pixel width before wrapping
      overflow: 'break',    // break at word boundaries, not mid-word
      lineHeight: 16,
      fontSize: 12,
      color: (_val: unknown, idx?: number) =>
        palette[(idx || 0) % palette.length]
    }
  },
  yAxis: {
    type: 'value',
    name: 'Count',
    nameLocation: 'middle',
    nameGap: 50,
    nameTextStyle: {
      backgroundColor: '#eef2f6',
      padding: [4, 8],
      borderRadius: 4
    },
    axisLabel: {
      formatter: '{value}'
    }
  },
  series
};


  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold mb-4">
        Draxlameir — Changes by Area &amp; Project
      </h3>
      <ReactECharts
        option={option}
        style={{ height: 500, width: '100%' }}
        theme="shine"
        notMerge={true}
        lazyUpdate={false}
      />
    </div>
  );
};

export default DraxlameirSmallMultiples;
