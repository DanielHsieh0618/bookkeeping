
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
    // const expensesRecords = records.filter(record => record.record_type === "expenses");
    const groupByTypeAndCategory = records.reduce((acc, record) => {
      if (!acc[record.record_type]) {
          acc[record.record_type] = {};
      }
        if (!acc[record.record_type][record.category_id]) {
            acc[record.record_type][record.category_id] = 0;
        }
        acc[record.record_type][record.category_id] += record.amount;
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
          text: 'Monthly'
        },
        tooltip: {},
        xAxis: {
          data:  Object.keys(groupByTypeAndCategory[Object.keys(groupByTypeAndCategory)[0]])
        },
        yAxis: {},
        series: Object.keys(groupByTypeAndCategory).map((type) => {
          return {
            name: type,
            type: 'bar',
            data: Object.keys(groupByTypeAndCategory[type]).map((category) => {
              return groupByTypeAndCategory[type][category];
            })
          }
        })
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