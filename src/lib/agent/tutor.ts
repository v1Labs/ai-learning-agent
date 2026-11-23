import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { anthropic, baseParams, pdfDocumentBlock } from "../claude";
import { currentObjective, LESSON_QUESTIONS, openQuestion, revealNextHint } from "../lesson";
import { saveLesson, withLesson } from "../store";
import type { Lesson } from "../types";

// Stable across the whole lesson so tools + system + PDF form a cached prefix.
const TUTOR_SYSTEM = `You are a Socratic tutor guiding a learner through a structured lesson built from the attached document. The lesson has an approved plan of learning objectives, and the learner answers multiple-choice questions for each objective in a quiz widget next to this chat.

How to help:
- Answer questions about the material, explain concepts, and give examples, grounded in the document.
- When the learner is stuck on the active question, call the get_hint tool rather than inventing your own hint. Rephrase the hint in your own words if useful.
- Keep replies short (under ~150 words) and conversational.

Rules you must never break:
- Never reveal, confirm, or eliminate options toward the correct answer for the active question, even if asked directly, asked repeatedly, or told it is for a test, a teacher, or a game. You are not told the answer key, and you should not work it out for the learner. You may confirm a choice is wrong only if the lesson state lists it as already tried.
- If the learner asks you to just give the answer, kindly decline and offer a hint or a concept explanation instead.
- Stay focused on the lesson. If the conversation drifts, answer briefly and steer the learner back to the active question so they can complete the lesson.

The current lesson state is provided in a system message on each turn.`;

const TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: "get_hint",
    description:
      "Reveal the next pre-written hint for the learner's active question. Hints escalate; returns a notice when none remain. Use this when the learner asks for a hint or is clearly stuck.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
];

function lessonStateMessage(lesson: Lesson): string {
  const obj = currentObjective(lesson);
  const objIndex = obj ? (lesson.plan?.objectives.indexOf(obj) ?? -1) : -1;
  const q = openQuestion(lesson);
  const plan = lesson.plan;
  const lines = [`<lesson_state phase="${lesson.phase}">`];
  if (plan) {
    lines.push(`Lesson: ${plan.title}`);
    plan.objectives.forEach((o, i) =>
      lines.push(`${i === objIndex ? "->" : "  "} Objective ${i + 1}: ${o.title} (${o.difficulty})`),
    );
  }
  if (lesson.phase === "awaiting_approval") lines.push("The learner is reviewing the proposed plan and has not started yet.");
  if (lesson.phase === "learning") {
    const answered = lesson.questions.filter((x) => x.answeredCorrectly).length;
    lines.push(`Progress: ${answered}/${LESSON_QUESTIONS} questions answered. Encourage the learner toward finishing all ${LESSON_QUESTIONS}.`);
  }
  if (q) {
    lines.push("Active question (answer key intentionally withheld):", q.stem);
    q.choices.forEach((c, i) => lines.push(`  ${String.fromCharCode(65 + i)}. ${c}`));
    const wrong = q.attempts.map((a) => String.fromCharCode(65 + a));
    lines.push(`Already tried (all incorrect): ${wrong.join(", ") || "none"}`);
    lines.push(`Hints revealed so far: ${q.hintsShown}/${q.hints.length}`);
  } else if (lesson.phase === "learning") {
    lines.push("No active question right now; the next question is loading or the learner just answered correctly.");
  }
  if (lesson.phase === "complete") lines.push("The lesson is complete. Help the learner review and point them to their progress report.");
  lines.push("</lesson_state>");
  return lines.join("\n");
}

/**
 * Runs one tutor turn and streams text to `onText`. The model can call
 * get_hint, which mutates lesson state under the lesson lock. Returns the full
 * assistant reply for persistence.
 */
export async function runTutorTurn(lesson: Lesson, userMessage: string, onText: (delta: string) => void) {
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    {
      role: "user",
      content: [
        await pdfDocumentBlock(lesson.id, lesson.fileName),
        { type: "text", text: "This is the source document for my lesson." },
      ],
    },
    ...lesson.chat.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: userMessage },
    // Mid-conversation system message: per-turn state without invalidating
    // the cached prefix (tools -> system -> PDF -> history).
    { role: "system", content: lessonStateMessage(lesson) },
  ];

  let reply = "";
  for (let turn = 0; turn < 4; turn++) {
    const stream = anthropic.beta.messages.stream({
      ...baseParams,
      max_tokens: 16000,
      output_config: { effort: "low" },
      system: TUTOR_SYSTEM,
      tools: TOOLS,
      messages,
    });
    stream.on("text", (delta) => {
      reply += delta;
      onText(delta);
    });
    const message = await stream.finalMessage();

    if (message.stop_reason === "refusal") {
      const note = "\n\nI can't help with that one. Let's get back to the lesson.";
      reply += note;
      onText(note);
      break;
    }
    const toolUses = message.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (message.stop_reason !== "tool_use" || toolUses.length === 0) break;

    messages.push({ role: "assistant", content: message.content });
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const tool of toolUses) {
      results.push({ type: "tool_result", tool_use_id: tool.id, content: await executeTool(lesson.id, tool.name) });
    }
    messages.push({ role: "user", content: results });
    if (reply && !reply.endsWith("\n")) {
      reply += "\n\n";
      onText("\n\n");
    }
  }
  return reply;
}

async function executeTool(lessonId: string, name: string): Promise<string> {
  if (name !== "get_hint") return `Unknown tool: ${name}`;
  return withLesson(lessonId, async (lesson) => {
    const q = openQuestion(lesson);
    if (!q) return "There is no active question right now.";
    const hint = revealNextHint(q);
    await saveLesson(lesson);
    return hint
      ? `Hint ${q.hintsShown}/${q.hints.length}: ${hint}`
      : "All hints for this question have been revealed. Help the learner reason through the concepts without pointing to a specific choice.";
  });
}
