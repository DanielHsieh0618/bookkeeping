import type { NextApiRequest } from 'next'
import { NextResponse } from "next/server";
import {sql} from "@vercel/postgres";

// To handle a GET request to /api
export async function GET(req: NextApiRequest, context: { params: { user_id: string } }) {
  console.log("req", req);
  const user_id  = context?.params?.user_id

    const { rows: categories } = await sql`SELECT * FROM categories WHERE user_id = ${user_id?.toString()|| `1`};`;

  return NextResponse.json(categories, { status: 200 });
}