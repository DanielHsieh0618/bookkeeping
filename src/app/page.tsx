import { redirect } from "next/navigation";
import { sql } from "@vercel/postgres";
/**
 * This page component acts as a root-level page for locale redirection.
 * If the locale cookie isn't set, it redirects the user to the default one.
 * For the actual content, please visit the "app/[locale]/page.tsx" page component.
 */
export default async function RootPage({
  params
} : {
  params: { user: string }
}) : Promise<JSX.Element>{
//   const res = await sql`CREATE TABLE records (
// 	record_id INT PRIMARY KEY,
//   record_datetime datetime NOT NULL,
//   record_type VARCHAR(100) NOT NULL,
//   category_id INT FOREIGN KEY NOT NULL,
//   user_id INT FOREIGN KEY NOT NULL,
//   description VARCHAR(255),
//   amount INT NOT NULL,
//     existed BOOLEAN DEFAULT TRUE;
// );`;
// console.log(res);
  // if(rows.length === 0){
  //   return redirect("/records");
  // }
  redirect("/records");
}