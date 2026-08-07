import { Upload, MessageSquare, FileQuestionMark, ChartColumn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Accordion } from "@/components/ui/accordion";
import { Reveal } from "@/components/reveal";
import { HeroPreview } from "@/components/hero-preview";

const FEATURES = [
  {
    icon: Upload,
    title: "Upload any PDF",
    description: "Drag and drop lecture notes, textbooks, or slides. Text is extracted instantly.",
  },
  {
    icon: MessageSquare,
    title: "Chat with your document",
    description: "Ask follow-up questions and get answers grounded only in what you uploaded.",
  },
  {
    icon: FileQuestionMark,
    title: "Generate practice quizzes",
    description: "MCQ and short-answer questions from the full document, a summary, or your own question paper.",
  },
  {
    icon: ChartColumn,
    title: "Track your progress",
    description: "See your study streak, weekly activity, and where to focus next.",
  },
];

const STEPS = [
  {
    title: "Upload",
    description: "Drop in a PDF and it's processed in seconds.",
  },
  {
    title: "Ask or summarize",
    description: "Chat about the content or generate a custom-length summary.",
  },
  {
    title: "Quiz yourself",
    description: "Turn what you just read into a practice quiz with instant feedback.",
  },
];

const TESTIMONIALS = [
  {
    quote: "I stopped rereading slides the night before exams — I just quiz myself instead.",
    name: "Maya R.",
    role: "Biology major",
  },
  {
    quote: "Uploading a dense paper and asking it questions is so much faster than skimming.",
    name: "Daniel K.",
    role: "Grad student",
  },
  {
    quote: "The quiz generator caught gaps in my notes I didn't know I had.",
    name: "Priya S.",
    role: "Med student",
  },
];

const FAQS = [
  {
    question: "What file types are supported?",
    answer: "PDF uploads are supported today. DOCX, TXT, and scanned/OCR support are on the roadmap.",
  },
  {
    question: "Does the AI make things up?",
    answer:
      "Chat and summaries are grounded in your uploaded document's text — if something isn't in the document, the assistant is instructed to say so instead of guessing.",
  },
  {
    question: "Can I generate a quiz from my own question paper?",
    answer:
      "Yes — paste an existing set of questions and Nous will match answers and explanations using your document as reference.",
  },
  {
    question: "Is my data private?",
    answer:
      "Documents and chats are tied to your account only; other users can't see your uploads or conversations.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      {/* Hero */}
      <section className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-6 py-20 lg:grid-cols-2 lg:py-28">
        <Reveal>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Study smarter with an AI that has actually read your PDFs.
          </h1>
          <p className="mt-5 max-w-xl text-lg opacity-70">
            Upload a PDF, get instant summaries, ask unlimited questions, and generate practice
            quizzes — all grounded in your own documents.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" href="/signup">
              Get started free
            </Button>
            <Button size="lg" variant="outline" href="/login">
              Log in
            </Button>
          </div>
        </Reveal>
        <Reveal delay={150}>
          <HeroPreview />
        </Reveal>
      </section>

      {/* Feature cards */}
      <section className="mx-auto w-full max-w-6xl px-6 py-16">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 80}>
              <Card hover className="h-full p-5">
                <f.icon size={22} className="text-accent" />
                <h3 className="mt-3 font-medium">{f.title}</h3>
                <p className="mt-1.5 text-sm opacity-60">{f.description}</p>
              </Card>
            </Reveal>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto w-full max-w-6xl px-6 py-16">
        <Reveal>
          <h2 className="text-center text-2xl font-semibold tracking-tight">How it works</h2>
        </Reveal>
        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <Reveal key={step.title} delay={i * 100}>
              <div className="text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                  {i + 1}
                </div>
                <h3 className="mt-4 font-medium">{step.title}</h3>
                <p className="mt-1.5 text-sm opacity-60">{step.description}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="mx-auto w-full max-w-6xl px-6 py-16">
        <Reveal>
          <h2 className="text-center text-2xl font-semibold tracking-tight">
            What students are saying
          </h2>
        </Reveal>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {TESTIMONIALS.map((t, i) => (
            <Reveal key={t.name} delay={i * 100}>
              <Card className="h-full p-5">
                <p className="text-sm opacity-80">&ldquo;{t.quote}&rdquo;</p>
                <p className="mt-4 text-sm font-medium">{t.name}</p>
                <p className="text-xs opacity-50">{t.role}</p>
              </Card>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="mx-auto w-full max-w-6xl px-6 py-16">
        <Reveal>
          <h2 className="text-center text-2xl font-semibold tracking-tight">Pricing</h2>
        </Reveal>
        <Reveal delay={100}>
          <Card className="mx-auto mt-10 max-w-sm p-8 text-center">
            <p className="text-sm font-medium uppercase tracking-wide text-accent">
              Free while in preview
            </p>
            <p className="mt-3 text-4xl font-semibold">$0</p>
            <ul className="mt-6 flex flex-col gap-2 text-sm opacity-70">
              <li>Unlimited PDF uploads</li>
              <li>Unlimited AI chat &amp; summaries</li>
              <li>Unlimited quiz generation</li>
            </ul>
            <Button size="lg" href="/signup" className="mt-6 w-full">
              Get started free
            </Button>
          </Card>
        </Reveal>
      </section>

      {/* FAQ */}
      <section className="mx-auto w-full max-w-3xl px-6 py-16">
        <Reveal>
          <h2 className="text-center text-2xl font-semibold tracking-tight">
            Frequently asked questions
          </h2>
        </Reveal>
        <Reveal delay={100} className="mt-10">
          <Accordion items={FAQS} />
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="glass mt-8 px-6 py-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 text-sm opacity-60 sm:flex-row">
          <p>© {new Date().getFullYear()} Nous</p>
          <div className="flex gap-6">
            <a
              href="https://github.com/ritvikpradeep-dot/Study-ai"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:opacity-100"
            >
              GitHub
            </a>
            <span className="cursor-default">Privacy</span>
            <span className="cursor-default">Terms</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
