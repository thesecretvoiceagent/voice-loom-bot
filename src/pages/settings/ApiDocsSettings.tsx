import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Code, Phone, Calendar, Webhook, AlertCircle, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

const CodeBlock = ({ code, language = "json" }: { code: string; language?: string }) => {
  const copyCode = () => {
    navigator.clipboard.writeText(code);
    toast.success("Code copied to clipboard");
  };

  return (
    <div className="relative rounded-lg bg-secondary/50 border border-border/50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/50">
        <span className="text-xs text-muted-foreground font-mono">{language}</span>
        <Button variant="ghost" size="sm" onClick={copyCode} className="h-6 gap-1 text-xs">
          <Copy className="h-3 w-3" />
          Copy
        </Button>
      </div>
      <pre className="p-4 text-sm font-mono text-foreground overflow-x-auto">
        <code>{code}</code>
      </pre>
    </div>
  );
};

const StatusBadge = ({ code, text }: { code: string; text: string }) => {
  const colors: Record<string, string> = {
    "200": "bg-success/10 text-success border-success/30",
    "201": "bg-success/10 text-success border-success/30",
    "400": "bg-warning/10 text-warning border-warning/30",
    "401": "bg-destructive/10 text-destructive border-destructive/30",
    "402": "bg-warning/10 text-warning border-warning/30",
    "403": "bg-destructive/10 text-destructive border-destructive/30",
    "404": "bg-muted text-muted-foreground border-border",
    "500": "bg-destructive/10 text-destructive border-destructive/30",
  };

  return (
    <Badge className={`${colors[code] || "bg-muted"} font-mono`}>
      {code}
    </Badge>
  );
};

export default function ApiDocsSettings() {
  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
          <Code className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold text-foreground">API Documentation</h2>
          <p className="text-muted-foreground">Complete API documentation for platform integration</p>
        </div>
      </div>

      {/* Authentication */}
      <Card className="glass-card rounded-xl border-border/50">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Code className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Authentication</h3>
              <p className="text-sm text-muted-foreground">
                All API endpoints require authentication via API key
              </p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground mb-4">Include your API key in request headers:</p>

          <CodeBlock code="X-API-Key: your_api_key_here" language="header" />

          <p className="text-sm text-muted-foreground my-4">Or as Authorization header:</p>

          <CodeBlock code="Authorization: Bearer your_api_key_here" language="header" />

          <div className="mt-4 rounded-lg bg-warning/10 border border-warning/30 p-4">
            <p className="text-sm text-warning">
              <span className="font-medium">Need an API key?</span> Configure your API keys in the{" "}
              <Link to="/settings/api-keys" className="underline hover:no-underline">
                API Keys settings
              </Link>{" "}
              page to start using the platform API.
            </p>
          </div>
        </div>
      </Card>

      {/* Start Campaign Calls */}
      <Card className="glass-card rounded-xl border-border/50">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
              <Phone className="h-5 w-5 text-success" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Start Campaign Calls</h3>
              <p className="text-sm text-muted-foreground">
                Initiate calls to multiple contacts in a campaign
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-foreground mb-2">Endpoint</h4>
              <CodeBlock 
                code="POST https://api.beyondcode.ee/start_calls_campaign_api" 
                language="endpoint" 
              />
            </div>

            <div>
              <h4 className="text-sm font-medium text-foreground mb-2">Request Body</h4>
              <CodeBlock 
                code={`{
  "campaign_id": "uuid-string",
  "clients": [
    {
      "id": "client_id_1",
      "phone_number": "+1234567890",
      "first_name": "John",
      "last_name": "Doe",
      "custom_data": {
        "company": "Acme Corp",
        "email": "john.doe@example.com",
        "appointment_date": "2024-01-15"
      }
    }
  ]
}`}
              />
            </div>

            <div>
              <h4 className="text-sm font-medium text-foreground mb-2">Request Parameters</h4>
              <div className="rounded-lg border border-border/50 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/30 border-border/50">
                      <TableHead>Parameter</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Required</TableHead>
                      <TableHead>Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow className="border-border/50">
                      <TableCell className="font-mono text-sm">campaign_id</TableCell>
                      <TableCell>string</TableCell>
                      <TableCell><Badge variant="default">Yes</Badge></TableCell>
                      <TableCell className="text-muted-foreground">Campaign UUID to process calls for</TableCell>
                    </TableRow>
                    <TableRow className="border-border/50">
                      <TableCell className="font-mono text-sm">clients</TableCell>
                      <TableCell>array</TableCell>
                      <TableCell><Badge variant="default">Yes</Badge></TableCell>
                      <TableCell className="text-muted-foreground">Array of client objects to call</TableCell>
                    </TableRow>
                    <TableRow className="border-border/50">
                      <TableCell className="font-mono text-sm">clients[].phone_number</TableCell>
                      <TableCell>string</TableCell>
                      <TableCell><Badge variant="default">Yes</Badge></TableCell>
                      <TableCell className="text-muted-foreground">Phone number in E.164 format</TableCell>
                    </TableRow>
                    <TableRow className="border-border/50">
                      <TableCell className="font-mono text-sm">clients[].id</TableCell>
                      <TableCell>string</TableCell>
                      <TableCell><Badge variant="outline">Optional</Badge></TableCell>
                      <TableCell className="text-muted-foreground">Client identifier for tracking</TableCell>
                    </TableRow>
                    <TableRow className="border-border/50">
                      <TableCell className="font-mono text-sm">clients[].first_name</TableCell>
                      <TableCell>string</TableCell>
                      <TableCell><Badge variant="outline">Optional</Badge></TableCell>
                      <TableCell className="text-muted-foreground">Client first name</TableCell>
                    </TableRow>
                    <TableRow className="border-border/50">
                      <TableCell className="font-mono text-sm">clients[].custom_data</TableCell>
                      <TableCell>object</TableCell>
                      <TableCell><Badge variant="outline">Optional</Badge></TableCell>
                      <TableCell className="text-muted-foreground">Additional data for personalization</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-foreground mb-2">Response</h4>
              <CodeBlock 
                code={`{
  "status": "success",
  "message": "All 2 calls successfully processed",
  "campaign_id": "123e4567-e89b-12d3-a456-426614174000",
  "processed_calls_count_this_request": 2,
  "failed_calls_count": 0,
  "current_total_queue_size_for_campaign": 5,
  "details": [
    {
      "client_id": "client_id_1",
      "supabase_call_id": "call_uuid_1",
      "phone_number": "+1234567890",
      "initial_status": "queued",
      "scheduled_time": "2024-01-15T10:30:00.000Z"
    }
  ],
  "subscription_usage": {
    "remaining_minutes": 996,
    "total_minutes": 1000,
    "minutes_used": 4,
    "organization": "Your Company Ltd"
  }
}`}
              />
            </div>

            <div className="rounded-lg bg-primary/5 border border-primary/20 p-4">
              <p className="text-sm text-primary font-medium mb-2">✨ New: Subscription Usage Info</p>
              <p className="text-sm text-muted-foreground">
                Successful responses now include a subscription_usage object showing:
              </p>
              <ul className="text-sm text-muted-foreground mt-2 space-y-1 ml-4">
                <li>• remaining_minutes: Minutes remaining in current billing period</li>
                <li>• total_minutes: Total minutes in subscription plan</li>
                <li>• minutes_used: Minutes already used this month</li>
                <li>• organization: Organization name for context</li>
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-medium text-foreground mb-2">cURL Example</h4>
              <CodeBlock 
                code={`curl -X POST https://api.beyondcode.ee/start_calls_campaign_api \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: your_api_key_here" \\
  -d '{
    "campaign_id": "4a544b81-5548-4506-98e2-780986f5fcbe",
    "clients": [
      {
        "phone_number": "+37256011298",
        "first_name": "John",
        "last_name": "Doe",
        "custom_data": {
          "email": "john.doe@example.com",
          "company": "Example Company Ltd"
        }
      }
    ]
  }'`}
                language="bash"
              />
            </div>

            <div>
              <h4 className="text-sm font-medium text-foreground mb-2">Status Codes</h4>
              <div className="flex flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <StatusBadge code="200" text="" />
                  <span className="text-sm text-muted-foreground">Success - All calls processed</span>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge code="400" text="" />
                  <span className="text-sm text-muted-foreground">Bad Request - Check parameters</span>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge code="401" text="" />
                  <span className="text-sm text-muted-foreground">Unauthorized - Check API key</span>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge code="402" text="" />
                  <span className="text-sm text-muted-foreground">Insufficient subscription minutes</span>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge code="404" text="" />
                  <span className="text-sm text-muted-foreground">Campaign not found</span>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge code="500" text="" />
                  <span className="text-sm text-muted-foreground">Server error</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Schedule Single Call */}
      <Card className="glass-card rounded-xl border-border/50">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
              <Calendar className="h-5 w-5 text-warning" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Schedule Single Outbound Call</h3>
              <p className="text-sm text-muted-foreground">
                Schedule a specific call from a campaign at an exact date and time
              </p>
            </div>
          </div>

          <div className="rounded-lg bg-warning/10 border border-warning/30 p-4 mb-4">
            <p className="text-sm text-warning">
              <span className="font-medium">Note:</span> scheduled_time must be in the future and conform to the campaign's schedule settings. The campaign's configured timezone is used for time interpretation.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-foreground mb-2">Endpoint</h4>
              <CodeBlock 
                code="POST https://api.beyondcode.ee/api/campaigns/schedule_call" 
                language="endpoint" 
              />
            </div>

            <div>
              <h4 className="text-sm font-medium text-foreground mb-2">Request Body</h4>
              <CodeBlock 
                code={`{
  "campaign_id": "4a544b81-5548-4506-98e2-780986f5fcbe",
  "scheduled_time": "2025-10-02T14:40:00+03:00",
  "clients": {
    "phone_number": "+37256011298",
    "first_name": "John",
    "last_name": "Doe",
    "custom_data": {
      "company": "Example Company Ltd",
      "priority": "high"
    }
  }
}`}
              />
            </div>

            <div>
              <h4 className="text-sm font-medium text-foreground mb-2">Response</h4>
              <CodeBlock 
                code={`{
  "status": "success",
  "campaign_id": "4a544b81-5548-4506-98e2-780986f5fcbe",
  "call_id": "be580886-2637-4895-9f9f-3936f958dd15",
  "scheduled_at": "2025-10-02T11:40:00.000Z",
  "scheduled_local": "2025-10-02T14:40:00.000+03:00",
  "initial_status": "scheduled",
  "organization_id": "e1c84eff-861b-4173-bbd1-472398863d57",
  "organization": "Company Name Ltd",
  "subscription_usage": {
    "remaining_minutes": 75,
    "total_minutes": 136,
    "minutes_used": 61,
    "organization": "Company Name Ltd"
  }
}`}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Webhooks */}
      <Card className="glass-card rounded-xl border-border/50">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
              <Webhook className="h-5 w-5 text-accent" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Webhooks</h3>
              <p className="text-sm text-muted-foreground">
                Receive real-time notifications for call events
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-foreground mb-2">Webhook Events</h4>
              <p className="text-sm text-muted-foreground mb-2">
                The Node-based calling service sends a POST request to your webhook URL after a call ends and transcription is complete. The webhook includes the full call transcript and AI-generated summary.
              </p>
              
              <div className="rounded-lg border border-border/50 bg-secondary/20 p-4">
                <code className="text-sm font-mono text-primary">call.completed</code>
                <p className="text-sm text-muted-foreground mt-1">
                  Sent when a call has ended, recording is ready, transcription is done, and AI summary is generated. Includes all call data with transcript and summary.
                </p>
              </div>

              <p className="text-xs text-muted-foreground mt-2">
                Note: Webhooks are only sent for successfully completed calls after transcription is ready. No webhooks are sent for failed or in-progress calls.
              </p>
            </div>

            <div>
              <h4 className="text-sm font-medium text-foreground mb-2">Request Headers</h4>
              <p className="text-sm text-muted-foreground mb-2">Each webhook includes the following headers:</p>
              <CodeBlock 
                code={`Content-Type: application/json
X-Signature: <HMAC-SHA256 signature>
X-Timestamp: 2025-10-02T11:44:06.397Z`}
                language="headers"
              />
              <p className="text-xs text-muted-foreground mt-2">
                X-Signature is computed using HMAC-SHA256 with your secret key and raw payload. X-Timestamp helps protect against replay attacks.
              </p>
            </div>

            <div>
              <h4 className="text-sm font-medium text-foreground mb-2">Webhook Payload</h4>
              <CodeBlock 
                code={`{
  "event": "call.completed",
  "timestamp": "2025-10-30T12:15:30.000Z",
  "call_id": "ad486b14-dd9c-4294-9a02-54eead857c0c",
  "campaign_id": "4a544b81-5548-4506-98e2-780986f5fcbe",
  "campaign_name": "Summer Sales Campaign 2025",
  "client_id": "CLIENT_12345",
  "phone_number": "+3725063419",
  "first_name": "John",
  "last_name": "Doe",
  "status": "completed",
  "direction": "outbound",
  "duration_seconds": 145,
  "started_at": "2025-10-30T12:13:05.000Z",
  "ended_at": "2025-10-30T12:15:30.000Z",
  "recording_url": "https://api.twilio.com/2010-04-01/Accounts/ACxxx/Recordings/RExxx",
  "transcript": "Agent: Hello, may I speak with John Doe?\\nClient: Yes, speaking.\\nAgent: Great! I'm calling regarding our summer offer...",
  "summary": "The call introduced the client (John Doe) to the summer offer. Client showed interest and requested more information. A follow-up call was scheduled for next week at 2:00 PM.",
  "custom_data": {
    "company": "Example Company Ltd",
    "email": "john.doe@example.com",
    "priority": "high"
  }
}`}
              />
            </div>

            <div className="rounded-lg bg-primary/5 border border-primary/20 p-4">
              <p className="text-sm text-primary font-medium mb-2">🎙️ Transcript and AI Summary</p>
              <p className="text-sm text-muted-foreground">
                Webhooks automatically include:
              </p>
              <ul className="text-sm text-muted-foreground mt-2 space-y-1 ml-4">
                <li>• transcript: Full call transcript with diarization (Agent/Client)</li>
                <li>• summary: AI-generated call summary (text or JSON format, depending on campaign settings)</li>
                <li>• recording_url: Link to Twilio recording</li>
                <li>• campaign_name: Campaign name for reference</li>
                <li>• custom_data: All custom data associated with the contact</li>
              </ul>
            </div>

            <p className="text-sm text-muted-foreground">
              To configure your webhook URL and generate an HMAC key, go to the{" "}
              <Link to="/settings/tools" className="text-primary hover:underline">
                Tools settings
              </Link>{" "}
              page.
            </p>

            <div className="rounded-lg bg-secondary/30 border border-border/50 p-4">
              <p className="text-sm text-foreground font-medium mb-2">🔒 Security</p>
              <p className="text-sm text-muted-foreground">
                Always validate X-Signature and X-Timestamp. Compute HMAC SHA256 (payload + timestamp) on your server and compare with the sent signature. Reject messages with expired timestamps (e.g., older than 5 minutes) or mismatched signatures.
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Error Handling */}
      <Card className="glass-card rounded-xl border-border/50">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
              <AlertCircle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Error Handling</h3>
              <p className="text-sm text-muted-foreground">
                API error formats and recommendations
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              The backend returns JSON objects with status, error message, and additional fields when needed. Below are examples from the backend:
            </p>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h4 className="text-sm font-medium text-foreground mb-2">400 – Missing required field</h4>
                <CodeBlock 
                  code={`{
  "status": "error",
  "message": "Missing required field: campaign_id"
}`}
                />
              </div>

              <div>
                <h4 className="text-sm font-medium text-foreground mb-2">402 – Insufficient minutes</h4>
                <CodeBlock 
                  code={`{
  "status": "error",
  "message": "Subscription minutes exhausted...",
  "remaining_minutes": 0,
  "minutes_used": 61,
  "minutes_total": 136,
  "error_type": "insufficient_subscription_minutes"
}`}
                />
              </div>

              <div>
                <h4 className="text-sm font-medium text-foreground mb-2">403 – Wrong organization</h4>
                <CodeBlock 
                  code={`{
  "status": "error",
  "message": "Access denied: Campaign does not belong to your organization"
}`}
                />
              </div>

              <div>
                <h4 className="text-sm font-medium text-foreground mb-2">404 – Campaign not found</h4>
                <CodeBlock 
                  code={`{
  "status": "error",
  "message": "Campaign 4a544b81... not found"
}`}
                />
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-foreground mb-2">Troubleshooting Steps</h4>
              <ul className="text-sm text-muted-foreground space-y-2 ml-4">
                <li>• Ensure JSON contains all required fields and phone numbers are in E.164 format.</li>
                <li>• For 402 errors, check the billing page and purchase additional minutes.</li>
                <li>• For 500 errors, check server logs, Supabase status, and Twilio configuration.</li>
              </ul>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
