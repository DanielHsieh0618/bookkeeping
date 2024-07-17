
import {NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/configs/auth";

// To handle a POST request to /api
export async function GET(req: NextRequest, res: NextResponse) {
  const session =  await getServerSession(authOptions)
  return NextResponse.json(session, { status: 200 });

}