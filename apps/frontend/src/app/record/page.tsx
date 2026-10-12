"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter } from "next/navigation";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Icon } from "@/components/ui/icon";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import dynamicIconImports from "lucide-react/dynamicIconImports";
export const fetchCache = "force-no-store";
interface Category {
  category_id: number;
  category_name: string;
  category_icon: keyof typeof dynamicIconImports;
}

const Page = function Record() {
  const [typeInput, setTypeInput] = useState("expenses");
  const [categoryInput, setCategoryInput] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [descriptionInput, setDescriptionInput] = useState("");
  const [amountInput, setAmountInput] = useState(0);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);

  const { data: session } = useSession();
  const userGoogleId = session?.user?.id;

  const router = useRouter();
  useEffect(() => {
    if (!userGoogleId || !session?.apiToken) {
      setCategories([]);
      return;
    }

    async function fetchCategories(googleId: string) {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/${googleId}/categories`, {
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${session?.apiToken}`,
        },
      });
      if (!res.ok) {
        console.error("Failed to fetch categories:", res.status, await res.text());
        return setCategories([]);
      }
      const data = await res.json();
      return setCategories(Array.isArray(data) ? data : []);
    }
    fetchCategories(userGoogleId);
    return () => {
      setCategories([]);
    };
  }, [userGoogleId, session]);

  useEffect(() => {
    if (typeInput !== "expenses") return;
    if (categories.some((category) => category.category_id === categoryInput)) return;
    setCategoryInput(categories[0]?.category_id ?? null);
  }, [categories, typeInput, categoryInput]);

  async function addRecord() {
    setLoading(true);
    setError(null);
    const data = {
      categoryId: categoryInput,
      description: descriptionInput,
      recordType: typeInput,
      amount: amountInput,
      recordDate: new Date().toDateString(),
    };
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/${userGoogleId}/records`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.apiToken}`,
        },
        redirect: "follow",
        referrerPolicy: "no-referrer",
        body: JSON.stringify(data), // body data type must match "Content-Type" header
      });
      if (!res.ok) {
        throw new Error(`Saving the record failed with status ${res.status}`);
      }
      setLoading(false);
      // force refresh
      router.push("/");
      router.refresh();
    } catch (error) {
      console.error("Error:", error);
      setError("Could not save the record. Please try again.");
      setLoading(false);
    }
  }

  function onTypeInputChange(val: string) {
    setTypeInput(val);
    if (val !== "expenses") {
      setCategoryInput(null);
    }
  }

  const categoryListOptions = useMemo(
    () =>
      categories.map((category: Category) => (
        <SelectItem key={category.category_id} value={category.category_id.toString()}>
          <div className="flex items-center">
            <Icon name={category.category_icon} className="mr-2"></Icon>
            <span>{category.category_name}</span>
          </div>
        </SelectItem>
      )),
    [categories]
  );

  return (
    <Card className="flex-auto">
      <CardHeader>
        <CardTitle></CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid w-full max-w-sm items-center gap-1.5 mb-3">
          <Label htmlFor="type">Type</Label>
          <Select value={typeInput} onValueChange={onTypeInputChange}>
            <SelectTrigger id="type">
              <SelectValue placeholder="Select a Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="expenses">Expenses</SelectItem>
              <SelectItem value="income">Income</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {typeInput === "expenses" ? (
          <div className="grid w-full max-w-sm items-center gap-1.5 mb-3">
            <Label htmlFor="category-id">Category</Label>
            <Select
              value={categoryInput === null ? "" : String(categoryInput)}
              onValueChange={(val) => setCategoryInput(Number(val))}
            >
              <SelectTrigger id="category-id">
                <SelectValue placeholder="Select a Category" />
              </SelectTrigger>
              <SelectContent>{categoryListOptions}</SelectContent>
            </Select>
          </div>
        ) : null}
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
        {error ? (
          <p role="alert" className="text-sm text-red-500">
            {error}
          </p>
        ) : null}
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
