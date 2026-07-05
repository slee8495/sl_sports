import { convertToModelMessages, streamText, stepCountIs, UIMessage } from "ai";
import { CHAT_MODEL } from "@/lib/ai/model";
import { listTeams, getTeamDetails } from "@/lib/ai/chatTools";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: CHAT_MODEL,
    system:
      "You are the assistant inside 'My Sports', a personal app that tracks the user's favorite teams (auto-updated news, highlights, podcasts, and schedules). " +
      "Answer questions about their teams using the listTeams and getTeamDetails tools — always call getTeamDetails before answering anything specific about a team, don't rely on general knowledge, since the app's stored data is what's current. " +
      "Keep answers short and conversational.",
    messages: await convertToModelMessages(messages),
    tools: { listTeams, getTeamDetails },
    stopWhen: stepCountIs(6),
  });

  return result.toUIMessageStreamResponse();
}
