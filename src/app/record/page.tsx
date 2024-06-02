

import Link from "next/link";
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const Page = function Records() {
    return (
        <Card className="flex-auto">
            <CardHeader>
                <CardTitle>Record</CardTitle>
            </CardHeader>
            <CardContent>
                <p>使用者 / UserId</p>
                <p>類別 / CategoryId </p>
                <p>描述 / Description</p>
                <p>收支 / Type</p>
                <p>金額 / amount</p>
            </CardContent>
            <CardFooter className="flex gap-3 justify-start">
                <Link href="/" className="flex-auto">
                    <Button className="w-full">
                        Cancel
                    </Button>
                </Link>
                <Link href="/" className="flex-auto">
                    <Button className="w-full">
                        Add
                    </Button>
                </Link>
            </CardFooter>
        </Card>
    );
};

export default Page
