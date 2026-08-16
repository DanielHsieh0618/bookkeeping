"use client";

import * as React from "react";
import * as echarts from "echarts/core";
import { useRef, useEffect } from "react";
import { PieChart, PieSeriesOption } from "echarts/charts";
import { useTheme } from "next-themes";
import {
  LegendComponent,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  DatasetComponent,
  TransformComponent,
  LegendComponentOption,
  TitleComponentOption,
  TooltipComponentOption,
  GridComponentOption,
  DatasetComponentOption,
} from "echarts/components";

// Register the required components
echarts.use([
  PieChart,

  TitleComponent,
  LegendComponent,
  TooltipComponent,
  GridComponent,
  DatasetComponent,
  TransformComponent,
  LabelLayout,
  UniversalTransition,
  CanvasRenderer,
]);

// Features like Universal Transition and Label Layout
import { LabelLayout, UniversalTransition } from "echarts/features";

// Import the Canvas renderer
// Note that including the CanvasRenderer or SVGRenderer is a required step
import { CanvasRenderer } from "echarts/renderers";

export type Option = echarts.ComposeOption<
  | TitleComponentOption
  | TooltipComponentOption
  | GridComponentOption
  | DatasetComponentOption
  | LegendComponentOption
  | PieSeriesOption
>;

interface ChartProps {
  option: Option;
  className: string;
}

const Chart: React.FC<ChartProps> = (props) => {
  const { option } = props;
  const chartRef = useRef<HTMLDivElement | null>(null);
  const { theme, systemTheme } = useTheme();
  let chartInstance = useRef<echarts.ECharts | null>(null);
  useEffect(() => {
    if (chartRef && chartRef.current && theme) {
      chartInstance.current = echarts.init(
        chartRef.current,
        theme.includes("system") ? (systemTheme?.includes("dark") ? "dark" : "light") : theme
      );
      // Draw the chart
      chartInstance.current.setOption(option);
      // handle resize
      new ResizeObserver(() => chartInstance.current?.resize()).observe(chartRef.current);
    }

    return () => {
      // window.removeEventListener("resize", handleResize);
      chartInstance.current?.dispose();
    };
  }, [option, theme, systemTheme]);

  return (
    <div className={`w-full sm:flex-1 sm:min-w-0 ${props.className}`}>
      <div ref={chartRef} className="w-full h-64"></div>
    </div>
  );
};

export { Chart };
