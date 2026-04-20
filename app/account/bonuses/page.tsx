import { redirect } from "next/navigation"

// Bonuses feature hidden from UI — logic still exists in DB/actions for future use.
// Keep a redirect in case someone has a bookmark or came from an old email link.
export default function BonusesPage() {
  redirect("/account")
}
