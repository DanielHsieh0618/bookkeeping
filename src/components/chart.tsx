
'use client';

import * as React from 'react';
import * as echarts from 'echarts';
import { useRef, useEffect  } from 'react';

interface ChartProps {
    records: any[];
}

const Chart: React.FC<ChartProps> = ({ records }) => {

    const chartRef = useRef<HTMLDivElement | null>(null);


    useEffect(() => {
    const expensesRecords = records.filter(record => record.record_type === "expenses");
    const groupByCategory = expensesRecords.reduce((acc, record) => {
        if (!acc[record.record_type]) {
            acc[record.record_type] = 0;
        }
        acc[record.record_type] += record.amount;
        return acc;
    }
    , {});
    
    return () => {
        // Create the echarts instance
        var myChart = echarts.init(chartRef.current);
        // Draw the chart
        myChart.setOption({
          title: {
            text: 'Expenses by Category'
          },
          tooltip: {},
          xAxis: {
            data: Object.keys(groupByCategory)
          },
          yAxis: {},
          series: [
            {
              name: 'sales',
              type: 'bar',
              data: Object.values(groupByCategory)
            }
          ]
        });
    }
    }, [])

    return (
        <div className="w-full">
            <div ref={chartRef} className="min-w-[860px] w-full h-64"></div>
        </div>
    );
};

export { Chart };