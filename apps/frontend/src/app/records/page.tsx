"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Chart } from "@/components/chart";
import { CirclePlus, ChevronDown, ChevronUp } from "lucide-react";
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
  category_id: number | null;
}

interface Category {
  category_id: number;
  category_name: string;
}

export const fetchCache = "force-no-store";

export default function Home(): JSX.Element {
  const [records, setRecords] = useState<Record[]>([]);
  const [categoryNames, setCategoryNames] = useState<Map<string, string>>(new Map());
  const [isMonthlyCollapsed, setIsMonthlyCollapsed] = useState(false);
  const { data: session } = useSession();
  const userGoogleId = session?.user?.id;

  useEffect(() => {
    if (!userGoogleId || !session?.apiToken) {
      setRecords([]);
      setCategoryNames(new Map());
      return;
    }

    async function fetchCategoryNames() {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/${userGoogleId}/categories`, {
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${session?.apiToken}`,
        },
      });
      if (!res.ok) {
        console.error("Failed to fetch categories:", res.status, await res.text());
        return setCategoryNames(new Map());
      }
      const data = await res.json();
      const categories: Category[] = Array.isArray(data) ? data : [];
      return setCategoryNames(
        new Map(categories.map((category) => [String(category.category_id), category.category_name]))
      );
    }

    async function fetchRecords() {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/${userGoogleId}/records`, {
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${session?.apiToken}`,
        },
      });
      if (!res.ok) {
        console.error("Failed to fetch records:", res.status, await res.text());
        return setRecords([]);
      }
      const data = await res.json();
      return setRecords(Array.isArray(data) ? data : []);
    }

    fetchRecords();
    fetchCategoryNames();
    return () => {
      setRecords([]);
      setCategoryNames(new Map());
    };
  }, [userGoogleId, session]);

  let recordList: JSX.Element[] = [];

  const groupByTypeAndCategory = records.reduce((acc: any, record: Record) => {
    if (!acc[record.record_type]) {
      acc[record.record_type] = {};
    }
    const category =
      record.category_id ?? record.record_type.charAt(0).toUpperCase() + record.record_type.slice(1);
    if (!acc[record.record_type][category]) {
      acc[record.record_type][category] = 0;
    }
    acc[record.record_type][category] += record.amount;
    return acc;
  }, {});

  const chartOptions: EChartsOption[] = Object.keys(groupByTypeAndCategory).map((recordType, idx) => {
    return {
      title: {
        subtext: recordType,
        textAlign: "center",
        top: "85%",
        left: `50%`,
      },
      tooltip: {
        trigger: "item",
      },
      legend: {
        show: false,
      },
      series: [
        {
          name: recordType,
          type: "pie",
          radius: [30, 100],
          // center: [`${idx === 0 ? 25 : 75}%`, "45%"],
          // avoidLabelOverlap: false,
          // padAngle: 5,
          itemStyle: {
            // borderRadius: 6,
            borderColor: "#ffffff22",
            borderWidth: 6,
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
            return {
              value: groupByTypeAndCategory[recordType][category],
              name: categoryNames.get(category) ?? category,
            };
          }),
        },
      ],
      color: recordType === RecordType.Expenses ? ["#f87171", "#fbbf24", "#34d399"] : ["#60a5fa", "#a78bfa", "#f472b6"]
    };
  });

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

  const chartListItems = chartOptions.map((option, idx) => <Chart key={idx} option={option} className=""></Chart>);

  return (
    <>
      <Card className={isMonthlyCollapsed ? "flex-none" : "flex-auto"}>
        <CardHeader className="flex-row items-start justify-between">
          <div>
            <CardTitle>Monthly</CardTitle>
            <CardDescription>Expenses and Income</CardDescription>
          </div>
          <Button
            variant="outline"
            size="icon"
            aria-label={isMonthlyCollapsed ? "Expand" : "Collapse"}
            onClick={() => setIsMonthlyCollapsed(!isMonthlyCollapsed)}
          >
            {isMonthlyCollapsed ? <ChevronDown /> : <ChevronUp />}
          </Button>
        </CardHeader>
        {!isMonthlyCollapsed && (
          <>
            <CardContent className="flex flex-col sm:flex-row">{chartListItems}</CardContent>
            <CardFooter></CardFooter>
          </>
        )}
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
