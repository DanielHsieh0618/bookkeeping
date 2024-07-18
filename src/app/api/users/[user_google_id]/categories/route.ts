import {  NextResponse, NextRequest } from "next/server";
import {sql} from "@vercel/postgres";

// To handle a GET request to /api
export async function GET(req: NextRequest, context: { params: { user_google_id: string } }) {
  console.log("context.params.user_google_id", context.params.user_google_id)
  const { rows: users } = await sql`SELECT user_id FROM users WHERE google_id=${context.params.user_google_id.toString()};`;
  console.log("users", users)
  const user_id = users[0].user_id;
  console.log("user_id", user_id)
  const { rows: categories } = await sql`SELECT * FROM categories WHERE user_id=${user_id};`;

  return NextResponse.json(categories, { status: 200 });
}