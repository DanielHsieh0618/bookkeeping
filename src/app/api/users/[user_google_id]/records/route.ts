import { NextResponse } from "next/server";
import {sql} from "@vercel/postgres";

// To handle a POST request to /api
export async function POST(req: Request, context: { params: { user_google_id: string } }) {
  
  const { rows:users } = await sql`SELECT user_id FROM users WHERE google_id=${context.params.user_google_id}`;
  const user_id = users[0]?.user_id;
  const body = await req.json(); 
  const {recordDate, recordType, amount, categoryId,  description } = body
    await sql`
            INSERT INTO records (record_date, record_type, amount, category_id, user_id, description)
            VALUES (${new Date(recordDate).toDateString()}, ${recordType}, ${amount}, ${categoryId}, ${user_id}, ${description});
        `;
  return NextResponse.json({ message: "Success" }, { status: 200 });
}

// To handle a POST request to /api
export async function GET(req: Request, context: { params: { user_google_id: string } }) {
  const { rows:users } = await sql`SELECT user_id FROM users WHERE google_id=${context.params.user_google_id}`;
  const user_id = users[0]?.user_id;
  const { rows: records } = await sql`SELECT * FROM records WHERE user_id=${user_id};`;
  return NextResponse.json(records, { status: 200 });
}