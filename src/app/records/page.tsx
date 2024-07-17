"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Chart } from "@/components/chart";
import { CirclePlus } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

import * as echarts from "echarts/core";
import { TooltipComponentOption, LegendComponentOption } from "echarts/components";
import { PieSeriesOption } from "echarts/charts";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
type EChartsOption = echarts.ComposeOption<TooltipComponentOption | LegendComponentOption | PieSeriesOption>;

enum RecordType {
  Expenses = "expenses",
  Income = "income",
}

interface Record {
  record_id: string;
  record_date: string;
  record_type: RecordType;
  amount: number;
  description: string;
  category_id: number;
}

export const fetchCache = "force-no-store";

export default function Home(): JSX.Element {
  const [records, setRecords] = useState([]);
  const { data: session } = useSession();
  const userGoogleId = session?.user?.id;

  useEffect(() => {
    async function fetchRecords() {
      const res = await fetch(`/api/users/${userGoogleId}/records`, {
        headers: {
          accept: "application/json",
        },
      });
      return setRecords(await res.json());
    }

    fetchRecords();
    return () => {
      setRecords([]);
    };
  }, [userGoogleId]);

  let recordList: JSX.Element[] = [];

  const groupByTypeAndCategory = records.reduce((acc: any, record: Record) => {
    if (!acc[record.record_type]) {
      acc[record.record_type] = {};
    }
    if (!acc[record.record_type][record.category_id]) {
      acc[record.record_type][record.category_id] = 0;
    }
    acc[record.record_type][record.category_id] += record.amount;
    return acc;
  }, {});

  let option: EChartsOption = {
    title: Object.keys(groupByTypeAndCategory).map((recordType, idx) => ({
      subtext: recordType,
      textAlign: "center",
      top: "85%",
      left: `${idx === 0 ? 25 : 75}%`,
    })),
    tooltip: {
      trigger: "item",
    },
    legend: {
      show: false,
    },
    series: Object.keys(groupByTypeAndCategory).map((recordType, idx) => {
      return {
        name: recordType,
        type: "pie",
        radius: [30, 100],
        center: [`${idx === 0 ? 25 : 75}%`, "45%"],
        avoidLabelOverlap: false,
        padAngle: 5,
        itemStyle: {
          borderRadius: 10,
        },
        label: {
          show: false,
          position: "center",
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 10,
            fontWeight: "bold",
          },
        },
        labelLine: {
          show: false,
        },
        data: Object.keys(groupByTypeAndCategory[recordType]).map((category) => {
          return { value: groupByTypeAndCategory[recordType][category], name: category };
        }),
      };
    }),
  };

  try {
    recordList = records.map((record: Record) => (
      <li key={record.record_id} className="flex">
        <span className="flex-1">{new Date(record.record_date).toLocaleDateString()}</span>
        <span className="flex-1">{record.record_type}</span>
        <span className="flex-1">{record.amount}</span>
        <span className="flex-1">{record.description} </span>
      </li>
    ));
  } catch {
    console.error("Error in rendering records");
  }

  return (
    <>
      <Card className="flex-auto">
        <CardHeader>
          <CardTitle>Monthly</CardTitle>
          <CardDescription>Expenses and Income</CardDescription>
        </CardHeader>
        <CardContent>
          <Chart option={option}></Chart>
        </CardContent>
        <CardFooter></CardFooter>
      </Card>

      <Card className="flex-auto">
        <CardHeader>
          <Link className="w-full" href="/record">
            <Button className="w-full">
              <CirclePlus className="mr-2" /> Add Record
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          <ul>
            <li className="hidden sm:flex">
              <span className="flex-1">Date</span>
              <span className="flex-1">Type</span>
              <span className="flex-1">Amount</span>
              <span className="flex-1">Description</span>
            </li>
            {recordList?.length === 0 ? <li>No records</li> : recordList}
          </ul>
        </CardContent>
      </Card>
    </>
  );
}
