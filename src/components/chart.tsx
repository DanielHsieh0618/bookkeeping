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
}

const Chart: React.FC<ChartProps> = (props) => {
  const { option } = props;
  const chartRef = useRef<HTMLDivElement | null>(null);
  const { theme, systemTheme } = useTheme();
  useEffect(() => {
    const plot = echarts.init(
      chartRef?.current,
      theme?.includes("system") ? (systemTheme?.includes("dark") ? "dark" : "light") : theme
    );
    // Draw the chart
    plot.setOption(option);

    const handleResize = () => {
      plot.resize();
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      plot.dispose();
    };
  }, [option, theme, systemTheme]);

  return (
    <div className="w-full">
      <div ref={chartRef} className="w-full h-64"></div>
    </div>
  );
};

export { Chart };
