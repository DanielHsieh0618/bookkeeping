import { NextResponse } from "next/server";
import {sql} from "@vercel/postgres";

// To handle a POST request to /api
export async function POST(req: Request, res: Response) {
  const body = await req.json(); // The body of the request
  const {recordDate, recordType, amount, categoryId, userId, description } = body // The body of the request
    await sql`
            INSERT INTO records (record_date, record_type, amount, category_id, user_id, description)
            VALUES (${new Date(recordDate).toDateString()}, ${recordType}, ${amount}, ${categoryId}, ${userId}, ${description});
        `;
  return NextResponse.json({ message: "Success" }, { status: 200 });
}