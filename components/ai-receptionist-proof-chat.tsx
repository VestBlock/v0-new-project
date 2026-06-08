"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Bot, CalendarClock, CheckCircle2, MessageSquareText, Phone, Send, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type DemoMessage = {
  role: "assistant" | "visitor";
  text: string;
};

type ReceptionistLead = {
  service: string;
  timing: string;
  contact: string;
};

const quickReplies = [
  "I need pricing for an AI receptionist",
  "Can this book appointments?",
  "What happens after hours?",
  "Can you qualify leads first?",
];

function buildAssistantReply(input: string, lead: ReceptionistLead) {
  const normalized = input.toLowerCase();

  if (/price|pricing|cost|package/.test(normalized)) {
    return "VestBlock usually starts by matching the setup to the business: simple receptionist, booking flow, or website upgrade sprint. I can collect your use case, lead volume, and current booking process so Rob can quote the right package instead of guessing.";
  }

  if (/book|appointment|calendar|schedule/.test(normalized)) {
    return "Yes. The receptionist can ask qualifying questions first, then route qualified visitors to a booking link, callback request, or intake form. The important part is not just chat. It is a clean handoff.";
  }

  if (/after|hours|missed|call|phone/.test(normalized)) {
    return "After hours, the assistant can answer common questions, capture the service needed, collect callback details, and flag urgent leads. It helps prevent good prospects from disappearing before your team is back online.";
  }

  if (/qualif|lead|intake/.test(normalized)) {
    return "That is the main job. The assistant can ask what service they need, when they need help, location, budget range if appropriate, and best contact method before sending the lead to your team.";
  }

  if (lead.contact) {
    return `Got it. I would summarize this for your team as: ${lead.service || "service needed"}; timing: ${lead.timing || "not specified"}; best contact: ${lead.contact}. A real install would send this to your lead inbox or booking process.`;
  }

  return "I can help with that. What service do you need, how soon do you need help, and what is the best phone or email for follow-up?";
}

function parseLead(messages: DemoMessage[]) {
  const visitorText = messages
    .filter((message) => message.role === "visitor")
    .map((message) => message.text)
    .join(" ")
    .toLowerCase();

  return {
    service: /book|appointment|calendar/.test(visitorText)
      ? "Booking / appointment flow"
      : /after|missed|call|phone/.test(visitorText)
        ? "Missed-call capture"
        : /price|pricing|cost|package/.test(visitorText)
          ? "AI receptionist pricing"
          : /qualif|lead|intake/.test(visitorText)
            ? "Lead qualification"
            : "",
    timing: /today|now|urgent|asap/.test(visitorText)
      ? "Urgent"
      : /week|soon/.test(visitorText)
        ? "This week"
        : "",
    contact: visitorText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "",
  };
}

export function AiReceptionistProofChat() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<DemoMessage[]>([
    {
      role: "assistant",
      text: "Hi, I’m the VestBlock AI receptionist demo. I can answer basic questions, qualify the visitor, and prepare a clean handoff for the business. What do you need help with?",
    },
  ]);

  const lead = useMemo(() => parseLead(messages), [messages]);
  const leadScore = [lead.service, lead.timing, lead.contact].filter(Boolean).length;

  const sendMessage = (messageText = input) => {
    const trimmed = messageText.trim();
    if (!trimmed) return;

    const nextMessages: DemoMessage[] = [...messages, { role: "visitor", text: trimmed }];
    const nextLead = parseLead(nextMessages);
    setMessages([
      ...nextMessages,
      {
        role: "assistant",
        text: buildAssistantReply(trimmed, nextLead),
      },
    ]);
    setInput("");
  };

  return (
    <Card className="premium-card overflow-hidden border-cyan-500/30 bg-slate-950 text-white shadow-2xl shadow-cyan-950/30">
      <CardHeader className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.2),transparent_36%),linear-gradient(135deg,rgba(15,23,42,0.98),rgba(8,13,24,0.98))]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Badge className="mb-3 bg-cyan-400 text-slate-950">Proof demo</Badge>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Bot className="h-5 w-5 text-cyan-300" />
              Try the AI Receptionist
            </CardTitle>
            <CardDescription className="mt-2 text-slate-300">
              A public demo of the intake, qualification, and handoff flow VestBlock can install for service businesses.
            </CardDescription>
          </div>
          <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-sm">
            <p className="font-semibold text-cyan-100">Lead readiness</p>
            <p className="text-cyan-200">{leadScore}/3 captured</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="grid gap-0 p-0 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4 p-5">
          <div className="h-[360px] overflow-y-auto rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="space-y-4">
              {messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}-${message.text.slice(0, 12)}`}
                  className={`flex ${message.role === "visitor" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[84%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      message.role === "visitor"
                        ? "bg-cyan-400 text-slate-950"
                        : "border border-white/10 bg-slate-900 text-slate-100"
                    }`}
                  >
                    {message.text}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {quickReplies.map((reply) => (
              <button
                key={reply}
                type="button"
                onClick={() => sendMessage(reply)}
                className="rounded-xl border border-cyan-300/20 bg-cyan-300/5 px-3 py-2 text-left text-xs text-cyan-100 transition hover:border-cyan-300/50 hover:bg-cyan-300/10"
              >
                {reply}
              </button>
            ))}
          </div>

          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              sendMessage();
            }}
          >
            <Input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about booking, missed calls, pricing, or lead qualification..."
              className="border-white/10 bg-white text-slate-950"
            />
            <Button type="submit" className="bg-cyan-400 text-slate-950 hover:bg-cyan-300">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>

        <aside className="space-y-4 border-t border-white/10 bg-white/[0.04] p-5 lg:border-l lg:border-t-0">
          <div>
            <p className="text-sm font-semibold text-cyan-100">Generated handoff</p>
            <p className="mt-1 text-sm text-slate-300">
              This is what the business receives after the chat qualifies the visitor.
            </p>
          </div>

          <div className="space-y-3">
            <div className="rounded-xl border border-white/10 bg-slate-900 p-3">
              <p className="flex items-center gap-2 text-sm font-medium">
                <MessageSquareText className="h-4 w-4 text-cyan-300" />
                Service needed
              </p>
              <p className="mt-1 text-sm text-slate-300">{lead.service || "Waiting for visitor intent"}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-900 p-3">
              <p className="flex items-center gap-2 text-sm font-medium">
                <CalendarClock className="h-4 w-4 text-cyan-300" />
                Timing
              </p>
              <p className="mt-1 text-sm text-slate-300">{lead.timing || "Ask follow-up question"}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-900 p-3">
              <p className="flex items-center gap-2 text-sm font-medium">
                <Phone className="h-4 w-4 text-cyan-300" />
                Contact
              </p>
              <p className="mt-1 text-sm text-slate-300">{lead.contact || "Not captured yet"}</p>
            </div>
          </div>

          <div className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-cyan-100">
              <Sparkles className="h-4 w-4" />
              Proof value
            </p>
            <ul className="mt-3 space-y-2 text-sm text-cyan-50">
              {["Shows the live intake flow", "Creates a screenshot-ready proof example", "Demonstrates lead handoff, not just chat"].map((item) => (
                <li key={item} className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <Button asChild className="w-full bg-white text-slate-950 hover:bg-cyan-50">
            <a href="#request-setup">
              Install this for my business
              <ArrowRight className="ml-2 h-4 w-4" />
            </a>
          </Button>
        </aside>
      </CardContent>
    </Card>
  );
}
