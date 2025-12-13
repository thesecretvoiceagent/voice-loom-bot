import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Phone, 
  Shield, 
  Globe2, 
  Zap, 
  BarChart3, 
  Clock, 
  Users, 
  Database,
  CheckCircle2,
  TrendingUp,
  Headphones,
  Lock,
  ArrowRight
} from "lucide-react";

const features = [
  {
    icon: Clock,
    title: "24/7 Availability",
    description: "Always-on operation that captures after-hours demand with zero queue loss.",
  },
  {
    icon: Globe2,
    title: "50+ Languages",
    description: "Multilingual support at the same quality without specialist hiring.",
  },
  {
    icon: Shield,
    title: "Full Ownership",
    description: "You own the stack, data, source codes, and keys. Vendor-switch ready.",
  },
  {
    icon: Zap,
    title: "Instant Scaling",
    description: "Handle peaks in parallel without overtime or temporary workers.",
  },
  {
    icon: BarChart3,
    title: "Structured Data",
    description: "Every call becomes searchable, auditable data you can use to improve.",
  },
  {
    icon: Lock,
    title: "GDPR Compliant",
    description: "On-premise or EU cloud deployment with configurable retention policies.",
  },
];

const deliverables = [
  "Production-ready voice agent stack you fully own",
  "Configured inbound/outbound call flows",
  "Multi-language and voice configuration",
  "Recording and transcription setup",
  "CRM/ERP/Helpdesk integrations via webhooks/APIs",
  "Built-in analytics dashboard",
  "GDPR-aligned operations runbook",
  "Team training and handover documentation",
];

const timeline = [
  {
    week: "Week 1",
    title: "Onboarding & Access",
    description: "Confirm objectives, collect scripts, map systems, set up secure connections, and provision phone numbers.",
  },
  {
    week: "Week 2",
    title: "Initial Build & Testing",
    description: "Configure flows, languages, voices, routing, and integrations. Run internal test rounds with recordings.",
  },
  {
    week: "Week 3",
    title: "Finalized Testing & Go-Live",
    description: "Iterate on scripts and prompts, tighten integrations, deploy to production with close monitoring.",
  },
  {
    week: "Week 4",
    title: "Analysis & Optimization",
    description: "Analyze transcripts and KPIs, document wins and friction, ship final iteration to stabilize.",
  },
];

export default function About() {
  return (
    <div className="space-y-12 animate-fade-in max-w-5xl">
      {/* Hero Section */}
      <div className="text-center space-y-4">
        <Badge className="bg-primary/10 text-primary border-primary/30 mb-4">
          BeyondCode Voice Agent Infrastructure
        </Badge>
        <h1 className="text-4xl font-bold text-foreground">
          Transform Your Phone Lines Into a<br />
          <span className="gradient-text">Controlled, Measurable Operation</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
          A fully integrated AI voice system that follows your procedures, speaks your language, 
          connects to your tools, and scales without additional hiring. Deployed on your infrastructure 
          or secure EU cloud—you retain full control.
        </p>
      </div>

      {/* Philosophy */}
      <Card className="glass-card rounded-xl border-border/50 p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 flex-shrink-0">
            <Zap className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-foreground mb-3">The Philosophy</h2>
            <p className="text-muted-foreground leading-relaxed">
              AI is a force multiplier. Its value equals the cost of the work it replaces—including idle time, 
              rework, training, churn, overtime, and missed calls. A well-designed AI Voice Agent absorbs a 
              large share of routine workload—faster, cheaper, consistent—while your people move up the value 
              chain: complex cases, relationships, and revenue.
            </p>
          </div>
        </div>
      </Card>

      {/* Key Features */}
      <div>
        <h2 className="text-2xl font-semibold text-foreground mb-6">Platform Capabilities</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <Card key={feature.title} className="glass-card rounded-xl border-border/50 p-6 hover:border-primary/30 transition-colors">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 mb-4">
                <feature.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.description}</p>
            </Card>
          ))}
        </div>
      </div>

      {/* What You Get */}
      <Card className="glass-card rounded-xl border-border/50 p-8">
        <div className="flex items-start gap-4 mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/10 flex-shrink-0">
            <CheckCircle2 className="h-6 w-6 text-success" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-foreground">What You Receive</h2>
            <p className="text-muted-foreground">Complete ownership of a production-ready AI voice infrastructure</p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {deliverables.map((item, index) => (
            <div key={index} className="flex items-center gap-3 rounded-lg bg-secondary/30 p-3">
              <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
              <span className="text-sm text-foreground">{item}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Expected Outcomes */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="glass-card rounded-xl border-border/50 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground">Immediate Impact</h3>
          </div>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <ArrowRight className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
              <span>Tangible additional free time, releasing human bandwidth</span>
            </li>
            <li className="flex items-start gap-2">
              <ArrowRight className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
              <span>Material increase in productive hours without headcount</span>
            </li>
            <li className="flex items-start gap-2">
              <ArrowRight className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
              <span>Consistent quality across all interactions</span>
            </li>
          </ul>
        </Card>

        <Card className="glass-card rounded-xl border-border/50 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
              <BarChart3 className="h-5 w-5 text-success" />
            </div>
            <h3 className="font-semibold text-foreground">Long-Term Value</h3>
          </div>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <ArrowRight className="h-4 w-4 text-success flex-shrink-0 mt-0.5" />
              <span>25–40% drop in cost per resolved call over 6–12 months</span>
            </li>
            <li className="flex items-start gap-2">
              <ArrowRight className="h-4 w-4 text-success flex-shrink-0 mt-0.5" />
              <span>Higher first-contact resolution rates</span>
            </li>
            <li className="flex items-start gap-2">
              <ArrowRight className="h-4 w-4 text-success flex-shrink-0 mt-0.5" />
              <span>Incremental revenue from proactive outreach</span>
            </li>
          </ul>
        </Card>
      </div>

      {/* Delivery Timeline */}
      <div>
        <h2 className="text-2xl font-semibold text-foreground mb-6">Delivery Timeline</h2>
        <p className="text-muted-foreground mb-6">
          30 business days from prerequisites to go-live, followed by optimization.
        </p>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {timeline.map((phase, index) => (
            <Card key={phase.week} className="glass-card rounded-xl border-border/50 p-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-accent" 
                   style={{ opacity: 0.3 + (index * 0.2) }} />
              <Badge variant="outline" className="mb-3 text-primary border-primary/30">
                {phase.week}
              </Badge>
              <h3 className="font-semibold text-foreground mb-2">{phase.title}</h3>
              <p className="text-sm text-muted-foreground">{phase.description}</p>
            </Card>
          ))}
        </div>
      </div>

      {/* Pricing */}
      <Card className="glass-card rounded-xl border-border/50 overflow-hidden">
        <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-8">
          <div className="flex items-start gap-4 mb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/20 flex-shrink-0">
              <Database className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-foreground">Simple, Transparent Pricing</h2>
              <p className="text-muted-foreground">No boilerplate bundles or hidden add-ons</p>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-border/50 bg-card/50 p-6">
              <h3 className="text-lg font-semibold text-foreground mb-2">Setup</h3>
              <div className="flex items-baseline gap-1 mb-3">
                <span className="text-3xl font-bold text-foreground">€20,000</span>
                <span className="text-muted-foreground">+ VAT (starting)</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Fixed price covering source code, design, integrations, compliance language, 
                test cycles, go-live, and handover.
              </p>
            </div>

            <div className="rounded-xl border border-border/50 bg-card/50 p-6">
              <h3 className="text-lg font-semibold text-foreground mb-2">Usage</h3>
              <div className="flex items-baseline gap-1 mb-3">
                <span className="text-3xl font-bold text-foreground">€0.20</span>
                <span className="text-muted-foreground">/ talk-minute</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Only while the agent is actively speaking. Same rate at 2 a.m. as at 2 p.m. 
                No idle time, breaks, or overtime charges.
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Success Criteria */}
      <Card className="glass-card rounded-xl border-border/50 p-8">
        <div className="flex items-start gap-4 mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 flex-shrink-0">
            <Headphones className="h-6 w-6 text-accent" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-foreground">How We Measure Success</h2>
            <p className="text-muted-foreground">Four dimensions that prove value</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {[
            {
              title: "Service Quality",
              items: ["Faster, consistent answers", "Higher first-contact resolution", "Reliable disclosure delivery"],
            },
            {
              title: "Operations",
              items: ["Reduced manual call load", "Peaks handled without overtime", "Self-sufficient team operation"],
            },
            {
              title: "Financial Outcomes",
              items: ["Lower cost per resolved call", "Captured after-hours demand", "Revenue from proactive outreach"],
            },
            {
              title: "Control & Compliance",
              items: ["Full stack ownership", "Configurable retention", "Complete audit trails"],
            },
          ].map((section) => (
            <div key={section.title} className="rounded-lg border border-border/50 bg-secondary/20 p-4">
              <h4 className="font-medium text-foreground mb-3">{section.title}</h4>
              <ul className="space-y-2">
                {section.items.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>

      {/* Footer Note */}
      <div className="text-center text-sm text-muted-foreground pb-8">
        <p>
          BeyondCode Voice Agent Infrastructure Platform — Converting chaos into a controlled, 
          measurable, always-on operation that you own.
        </p>
      </div>
    </div>
  );
}
