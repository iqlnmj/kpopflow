import type { Prisma } from "@prisma/client";
export type ProjectDetail = Prisma.ProjectGetPayload<{
  include: {
    scripts: true;
    timelines: true;
    revisions: { include: { reports: true } };
    sources: true;
    events: true;
    approvals: true;
    jobs: true;
  };
}>;
export type ProjectCard = Prisma.ProjectGetPayload<{
  include: { _count: { select: { scripts: true; revisions: true } } };
}>;
export type Topic = Prisma.TopicCandidateGetPayload<object>;
export type Scene = {
  start: number;
  end: number;
  voiceover: string;
  visual: string;
  footage: string;
  motion: string;
  overlay: string;
  subtitle: string;
  transition: string;
  sound: string;
  purpose: string;
};
export type Review = {
  score: number;
  strengths: string[];
  findings: {
    start: number;
    end: number;
    category: string;
    severity: string;
    observation: string;
    evidence: string;
    recommendation: string;
    confidence: string;
  }[];
  summary: string;
  ready: boolean;
  limitations: string;
};
