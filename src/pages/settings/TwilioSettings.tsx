import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Phone, Pencil, AlertTriangle, ShoppingCart } from "lucide-react";

const phoneNumbers = [
  {
    number: "+37256011298",
    friendlyName: "Mobile EST",
    webhooks: true,
    iei: true,
  },
];

export default function TwilioSettings() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10">
          <Phone className="h-6 w-6 text-destructive" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Phone Numbers</h2>
          <p className="text-muted-foreground">Manage your phone numbers</p>
        </div>
      </div>

      {/* Current Numbers */}
      <Card className="glass-card rounded-xl border-border/50">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
              <Phone className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Phone Numbers</h3>
              <p className="text-sm text-muted-foreground">Configure and manage your Twilio phone numbers</p>
            </div>
          </div>

          <div className="rounded-xl border border-border/50 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50 bg-secondary/30">
                  <TableHead>Phone Number</TableHead>
                  <TableHead>Friendly Name</TableHead>
                  <TableHead>Configuration</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {phoneNumbers.map((phone) => (
                  <TableRow key={phone.number} className="border-border/50">
                    <TableCell className="font-mono font-medium">{phone.number}</TableCell>
                    <TableCell>{phone.friendlyName}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {phone.webhooks && (
                          <Badge className="bg-success/10 text-success border-success/30 hover:bg-success/20">
                            Webhooks
                          </Badge>
                        )}
                        {phone.iei && (
                          <Badge className="bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/20">
                            IEI
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </Card>

      {/* Purchase Numbers */}
      <Card className="glass-card rounded-xl border-border/50">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <ShoppingCart className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Purchase Phone Numbers</h3>
              <p className="text-sm text-muted-foreground">Purchase phone numbers directly from the platform</p>
            </div>
          </div>

          <div className="rounded-xl border border-border/50 bg-secondary/20 p-6">
            <div className="flex items-center gap-3">
              <Phone className="h-5 w-5 text-primary" />
              <div>
                <h4 className="font-semibold text-foreground">Phone Numbers</h4>
                <p className="text-sm text-muted-foreground">Phone number purchasing and management.</p>
              </div>
            </div>

            <div className="mt-4 rounded-lg bg-warning/10 border border-warning/30 p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
              <p className="text-sm text-warning">
                <span className="font-medium">Limit:</span> Each organization can only own one phone number.
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
