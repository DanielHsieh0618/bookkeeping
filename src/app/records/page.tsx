

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CirclePlus } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
// import { headers } from 'next/headers';

interface Record {
    record_id: string;
    record_date: string;
    record_type: string;
    amount: number;
    description: string;
}

// this line force to execute sql every times
export const fetchCache = 'force-no-store';

export default async function Home() {
    let records: Record[] = [];

    // fetch data from api
    // const headersList = headers();

    // async function fetchRecords() {
    //     const res = await fetch(`https://${headersList.get('host')}/api/records`, { 
    //         headers: {
    //             accept: 'application/json',
    //         }
    //     })
    //     const rows = await res.json()
    //     records = rows
    // }
    
    // await fetchRecords()

    let recordList: JSX.Element[] = [];
    
    // try {
    //     recordList = records.map((record: Record) => (
    //         <li key={record.record_id} className="flex">
    //             <span className="flex-1">{new Date(record.record_date).toLocaleDateString()}</span>
    //             <span className="flex-1">{record.record_type}</span>
    //             <span className="flex-1">{record.amount}</span>
    //             <span className="flex-1">{record.description} </span>
    //         </li>
    //     ));
    // } catch {
    //     console.error('Error in rendering records')
    // }
    

    return (
        <>
            <Card className="flex-auto">
                <CardHeader>
                    <CardTitle>Chart Title</CardTitle>
                    <CardDescription>Chart Description</CardDescription>
                </CardHeader>
                <CardContent>
                    <p>Chart Content</p>
                </CardContent>
                <CardFooter>
                    <p>Chart Footer</p>
                </CardFooter>
            </Card>

        
            <Card className="flex-auto">
                <CardHeader>
                    <Link className="w-full" href="/record">
                        <Button className="w-full">
                            <CirclePlus className="mr-2" />  Add Record
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
                        {recordList}
                    </ul>
                </CardContent>
            </Card>
        </>
    );
}
