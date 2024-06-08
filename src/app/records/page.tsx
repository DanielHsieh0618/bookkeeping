

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
// import { Key, ReactElement, JSXElementConstructor, ReactNode, ReactPortal, AwaitedReactNode } from "react";

// this line force to execute sql every times
export const fetchCache = 'force-no-store';

export default async function Home() {

    // fetch data from api
    // const headersList = headers();
    // const res = await fetch(`https://${headersList.get('host')}/api/records`)
    // const rows = await res.json()
    // const record = rows.map((record: { record_id: Key | null | undefined; record_date: string | number | Date; record_type: string | number | bigint | boolean | ReactElement<any, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | Promise<AwaitedReactNode> | null | undefined; amount: string | number | bigint | boolean | ReactElement<any, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | Promise<AwaitedReactNode> | null | undefined; description: string | number | bigint | boolean | ReactElement<any, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | Promise<AwaitedReactNode> | null | undefined; }) => (
    //     <li key={record.record_id} className="flex">
    //         <span className="flex-1">{new Date(record.record_date).toLocaleDateString()}</span>
    //         <span className="flex-1">{record.record_type}</span>
    //         <span className="flex-1">{record.amount}</span>
    //         <span className="flex-1">{record.description} </span>
    //     </li>
    // ));

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
                        {/* {record} */}
                    </ul>
                </CardContent>
            </Card>
        </>
    );
}
