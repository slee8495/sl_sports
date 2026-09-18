import { convertToModelMessages, streamText, stepCountIs, UIMessage } from "ai";
import { CHAT_MODEL } from "@/lib/ai/model";
import { listTeams, getTeamDetails, getFullSchedule } from "@/lib/ai/chatTools";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: CHAT_MODEL,
    system: [
      "You are the assistant inside SL Sports, a personal app for one fan who follows seven Southern California teams.",
      "Always call a tool before answering anything specific — the tools read live data from ESPN and the school's own calendar, and your own memory of rosters and schedules is out of date.",
      "All times come back as UTC ISO strings. Always speak in Pacific time, the way the app shows it (e.g. 'Saturday 1:05 PM').",
      "If a tool says a source didn't answer, say exactly that. Never fill the gap with a guess.",
      "Keep answers short and plain, like a friend who checked the app for them.",
    ].join(" "),
    messages: await convertToModelMessages(messages),
    tools: { listTeams, getTeamDetails, getFullSchedule },
    stopWhen: stepCountIs(6),
  });

  return result.toUIMessageStreamResponse();
}
