import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreditCard, Zap, TrendingUp, Settings2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export default function PlansSettings() {
  const usedMinutes = 61;
  const totalMinutes = 136;
  const usagePercent = (usedMinutes / totalMinutes) * 100;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
          <CreditCard className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Plans & Subscriptions</h2>
          <p className="text-muted-foreground">
            Manage your subscription and billing in BEYONDCODE AI VOICE PLATFORM
          </p>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="w-full justify-start bg-secondary/30 p-1 rounded-xl">
          <TabsTrigger 
            value="overview" 
            className="flex-1 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <Clock className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger 
            value="plans" 
            className="flex-1 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <TrendingUp className="h-4 w-4 mr-2" />
            Plans
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          {/* Current Plan Card */}
          <Card className="overflow-hidden rounded-xl border-0 bg-gradient-to-br from-primary via-primary/90 to-accent">
            <div className="p-6 text-primary-foreground">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-foreground/20">
                    <Zap className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Current Plan</h3>
                    <p className="text-sm opacity-80">Your active subscription details</p>
                  </div>
                </div>
                <Badge className="bg-primary-foreground/20 text-primary-foreground border-primary-foreground/30 hover:bg-primary-foreground/30">
                  Active
                </Badge>
              </div>

              <div className="flex items-baseline justify-between mb-6">
                <div>
                  <h4 className="text-2xl font-bold">Starter Plan</h4>
                  <p className="text-sm opacity-80">Ideal for small businesses starting with AI calls</p>
                </div>
                <div className="text-right">
                  <span className="text-3xl font-bold">€49</span>
                  <span className="text-sm opacity-80"> / month</span>
                </div>
              </div>

              <p className="text-sm opacity-80 mb-4">
                10. September 2025 — 10. October 2025
              </p>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Call Usage</span>
                  <span className="font-medium">{usedMinutes} / {totalMinutes} minutes</span>
                </div>
                <Progress 
                  value={usagePercent} 
                  className="h-2 bg-primary-foreground/20"
                />
                <p className="text-xs opacity-70">{usagePercent.toFixed(0)}% used</p>
              </div>
            </div>
          </Card>

          {/* Subscription Management */}
          <Card className="glass-card rounded-xl border-border/50 mt-6">
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                    <Settings2 className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Subscription Management</h3>
                    <p className="text-sm text-muted-foreground">Update your subscription settings</p>
                  </div>
                </div>
                <Button variant="outline">
                  Manage Subscription
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mt-4">
                Open Stripe customer portal to update payment method, download invoices, and cancel subscription.
              </p>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="plans" className="mt-6">
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                name: "Starter",
                price: "€49",
                description: "For small businesses",
                minutes: 136,
                features: ["136 call minutes", "1 phone number", "Basic analytics", "Email support"],
                current: true,
              },
              {
                name: "Professional",
                price: "€149",
                description: "For growing teams",
                minutes: 500,
                features: ["500 call minutes", "3 phone numbers", "Advanced analytics", "Priority support", "API access"],
                popular: true,
              },
              {
                name: "Enterprise",
                price: "Custom",
                description: "For large organizations",
                minutes: "Unlimited",
                features: ["Unlimited minutes", "Unlimited numbers", "Custom integrations", "Dedicated support", "SLA guarantee"],
              },
            ].map((plan) => (
              <Card 
                key={plan.name}
                className={`glass-card rounded-xl border-border/50 relative ${plan.popular ? "border-primary/50 ring-1 ring-primary/30" : ""}`}
              >
                {plan.popular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">
                    Most Popular
                  </Badge>
                )}
                <div className="p-6">
                  <h3 className="text-xl font-semibold text-foreground">{plan.name}</h3>
                  <p className="text-sm text-muted-foreground">{plan.description}</p>
                  <div className="mt-4 mb-6">
                    <span className="text-3xl font-bold text-foreground">{plan.price}</span>
                    {plan.price !== "Custom" && <span className="text-muted-foreground"> / month</span>}
                  </div>
                  <ul className="space-y-2 mb-6">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button 
                    className="w-full" 
                    variant={plan.current ? "secondary" : plan.popular ? "default" : "outline"}
                    disabled={plan.current}
                  >
                    {plan.current ? "Current Plan" : plan.price === "Custom" ? "Contact Sales" : "Upgrade"}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Clock(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
