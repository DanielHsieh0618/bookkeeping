
'use client';

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useRouter } from 'next/navigation'

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
 
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { useState } from "react";

const Page = function Records() {

    const [typeInput, setTypeInput] = useState("expenses");
    const [descriptionInput, setDescriptionInput] = useState("");
    const [amountInput, setAmountInput] = useState(0);
    const [loading, setLoading] = useState(false)

    const router = useRouter()

    async function addRecord() {
        setLoading(true)
        const data = {
            userId: 1,
            categoryId: 1,
            description: descriptionInput,
            recordType: typeInput,
            amount: amountInput,
            recordDate: new Date().toDateString(),
        }
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
            setLoading(false)
            // force refresh
            router.push("/")
            router.refresh()
        } catch (error) {
            console.error("Error:", error)
            setLoading(false)
        } 
    }


    return (
        <Card className="flex-auto">
            <CardHeader>
                <CardTitle>Record</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid w-full max-w-sm items-center gap-1.5 mb-3">
                    <Label htmlFor="type">Type</Label>
                    <Select value={typeInput} onValueChange={setTypeInput}>
                        <SelectTrigger id="type" >
                            <SelectValue placeholder="Select a Type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="expenses">Expenses</SelectItem>
                            <SelectItem value="income">Income</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="grid w-full max-w-sm items-center gap-1.5 mb-3">
                    <Label htmlFor="amount">Amount</Label>
                    <Input type="number" id="amount" placeholder="Amount" value={amountInput} onChange={(event)=>setAmountInput(parseFloat(event.target.value))} />
                </div>
                <div className="grid w-full max-w-sm items-center gap-1.5 mb-3">
                    <Label htmlFor="description">Description</Label>
                    <Input type="text" id="description" placeholder="Description" value={descriptionInput} onChange={(event)=>setDescriptionInput(event.target.value)} />
                </div>
            </CardContent>
            <CardFooter className="flex gap-3 justify-start">
                <Link href="/" className="flex-1">
                    <Button className="w-full">
                        Cancel
                    </Button>
                </Link>
                <Button className="flex-1" disabled={loading} onClick={addRecord} >
                    Add
                </Button>
            </CardFooter>
        </Card>
    );
};

export default Page
