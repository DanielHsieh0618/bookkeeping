

import Link from "next/link";
import { Button } from "@/components/ui/button"
import { CirclePlus } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"


export default function Home() {
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
                    <p>Card Content</p>
                </CardContent>
                <CardFooter>
                    <p>Card Footer</p>
                </CardFooter>
            </Card>
           
        </>
    );
}
