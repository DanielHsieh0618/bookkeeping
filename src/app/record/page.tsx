"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter } from "next/navigation";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Icon } from "@/components/ui/icon";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { useState, useEffect } from "react";
import dynamicIconImports from "lucide-react/dynamicIconImports";
interface Category {
  category_id: number;
  category_name: string;
  category_icon: keyof typeof dynamicIconImports;
}

const Page = function Record() {
  const [typeInput, setTypeInput] = useState("expenses");
  const [categoryInput, setCategoryInput] = useState(1);
  const [descriptionInput, setDescriptionInput] = useState("");
  const [amountInput, setAmountInput] = useState(0);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);

  const router = useRouter();
  useEffect(() => {
    async function fetchCategories(userId: number = 1) {
      const res = await fetch(`/api/users/${userId}/categories`, {
        headers: {
          accept: "application/json",
        },
      });
      return await res.json().then((categories) => {
        setCategories(categories);
      });
    }
    fetchCategories();
    return () => {
      setCategories([]);
    };
  }, []);

  async function addRecord() {
    setLoading(true);
    const data = {
      userId: 1,
      categoryId: categoryInput,
      description: descriptionInput,
      recordType: typeInput,
      amount: amountInput,
      recordDate: new Date().toDateString(),
    };
    try {
      await fetch("/api/records", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        redirect: "follow",
        referrerPolicy: "no-referrer",
        body: JSON.stringify(data), // body data type must match "Content-Type" header
      });
      setLoading(false);
      // force refresh
      router.push("/");
      router.refresh();
    } catch (error) {
      console.error("Error:", error);
      setLoading(false);
    }
  }

  return (
    <Card className="flex-auto">
      <CardHeader>
        <CardTitle></CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid w-full max-w-sm items-center gap-1.5 mb-3">
          <Label htmlFor="type">Type</Label>
          <Select value={typeInput} onValueChange={setTypeInput}>
            <SelectTrigger id="type">
              <SelectValue placeholder="Select a Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="expenses">Expenses</SelectItem>
              <SelectItem value="income">Income</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid w-full max-w-sm items-center gap-1.5 mb-3">
          <Label htmlFor="category-id">Category</Label>
          <Select value={`${categoryInput}`} onValueChange={(val) => setCategoryInput(Number(val))}>
            <SelectTrigger id="category-id">
              <SelectValue placeholder="Select a Category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category: Category) => (
                <SelectItem key={category.category_id} value={category.category_id.toString()}>
                  <div className="flex items-center">
                    <Icon name={category.category_icon} className="mr-2"></Icon>
                    <span>{category.category_name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid w-full max-w-sm items-center gap-1.5 mb-3">
          <Label htmlFor="amount">Amount</Label>
          <Input
            type="number"
            id="amount"
            placeholder="Amount"
            value={amountInput.toString()}
            onChange={(event) => setAmountInput(parseFloat(event.target.value))}
          />
        </div>
        <div className="grid w-full max-w-sm items-center gap-1.5 mb-3">
          <Label htmlFor="description">Description</Label>
          <Input
            type="text"
            id="description"
            placeholder="Description"
            value={descriptionInput}
            onChange={(event) => setDescriptionInput(event.target.value)}
          />
        </div>
      </CardContent>
      <CardFooter className="flex gap-3 justify-start">
        <Link href="/" className="flex-1">
          <Button className="w-full">Cancel</Button>
        </Link>
        <Button className="flex-1" disabled={loading} onClick={addRecord}>
          Add
        </Button>
      </CardFooter>
    </Card>
  );
};

export default Page;
