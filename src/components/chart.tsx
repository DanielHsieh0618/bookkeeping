
'use client';

import * as React from 'react';
import * as echarts from 'echarts';
import { useRef, useEffect  } from 'react';

interface ChartProps {
    records: any[];
}

const Chart: React.FC<ChartProps> = ({ records }) => {

    const chartRef = useRef<HTMLDivElement | null>(null);
    console.log("chartRef.current", chartRef)

    useEffect(() => {
    // const expensesRecords = records.filter(record => record.record_type === "expenses");
    // const groupByCategory = expensesRecords.reduce((acc, record) => {
    //     if (!acc[record.record_type]) {
    //         acc[record.record_type] = 0;
    //     }
    //     acc[record.record_type] += record.amount;
    //     return acc;
    // }
    // , {});
    console.log("chartRef.current", chartRef?.current)
    return () => {
        // Create the echarts instance

        console.log("chartRef.current", chartRef?.current)
        var myChart = echarts.init(chartRef.current);

        console.log(myChart)
        // Draw the chart
        myChart.setOption({
          title: {
            text: 'Expenses by Category'
          },
          tooltip: {},
          xAxis: {
            data: ["apple", "banana", "egg"]// Object.keys(groupByCategory)
          },
          yAxis: {},
          series: [
            {
              name: 'sales',
              type: 'bar',
              data: [2,3,45] // Object.values(groupByCategory)
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