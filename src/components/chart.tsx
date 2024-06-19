
'use client';

import * as React from 'react';
import * as echarts from 'echarts/core';
import { useRef, useEffect  } from 'react';
import { BarChart } from 'echarts/charts';
// Import the title, tooltip, rectangular coordinate system, dataset and transform components
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  DatasetComponent,
  TransformComponent
} from 'echarts/components';

// Register the required components
echarts.use([
  BarChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  DatasetComponent,
  TransformComponent,
  LabelLayout,
  UniversalTransition,
  CanvasRenderer
]);


// Features like Universal Transition and Label Layout
import { LabelLayout, UniversalTransition } from 'echarts/features';

// Import the Canvas renderer
// Note that including the CanvasRenderer or SVGRenderer is a required step
import { CanvasRenderer } from 'echarts/renderers';


interface ChartProps {
    records: any[];
}

const Chart: React.FC<ChartProps> = (props) => {
    const  {records} = props; 
    const expensesRecords = records.filter(record => record.record_type === "expenses");
    const groupByCategory = expensesRecords.reduce((acc, record) => {
        if (!acc[record.record_type]) {
            acc[record.record_type] = 0;
        }
        acc[record.record_type] += record.amount;
        return acc;
    }
    , {});
    const chartRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
    var myChart = echarts.init(chartRef?.current);
    if (!chartRef.current) {
      return ;
    }
      // Draw the chart
      myChart.setOption({
        title: {
          text: 'Expenses by Category'
        },
        tooltip: {},
        xAxis: {
          data:  Object.keys(groupByCategory)
        },
        yAxis: {},
        series: [
          {
            name: 'sales',
            type: 'bar',
            data:  Object.values(groupByCategory)
          }
        ]
      });
    return () => {
        myChart.dispose();
      }
    }, [])

    return (
        <div className="w-full">
            <div ref={chartRef} className="w-full h-64"></div>
        </div>
    );
};

export { Chart };