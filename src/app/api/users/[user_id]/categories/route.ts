import {  NextResponse, NextRequest } from "next/server";
import {sql} from "@vercel/postgres";

// To handle a GET request to /api
export async function GET(req: NextRequest, context: { params: { user_id: string } }) {
  const user_id  = context?.params?.user_id

    const { rows: categories } = await sql`SELECT * FROM categories WHERE user_id = ${user_id?.toString()|| `1`};`;

  return NextResponse.json(categories, { status: 200 });
}