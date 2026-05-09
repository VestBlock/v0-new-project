'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import {
  AlertCircle,
  ExternalLink,
  FileText,
  Loader2,
  MessageSquare,
  Sparkles,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { captureClientEvent } from '@/lib/analytics/client';
import { analyticsEvents } from '@/lib/analytics/events';
import { getChatAssistant } from '@/lib/chat/assistants';

type WorkspaceConversation = {
  id: string;
  title: string;
  assistantType: string;
  updatedAt: string;
  preview: string;
  messageCount: number;
};

type WorkspaceDocument = {
  id: string;
  documentName: string;
  documentType?: string | null;
  status: string;
  relatedItemId?: string | null;
  createdAt: string;
  updatedAt: string;
  accessUrl?: string | null;
};

type WorkspaceDeliverable = {
  leadId: string;
  packageTitle: string;
  businessName?: string | null;
  submittedAt?: string | null;
  updatedAt?: string | null;
  leadStatus?: string | null;
  deliverable?: {
    status?: string | null;
    title?: string | null;
    summary?: string | null;
  } | null;
};

function relativeTime(value?: string | null) {
  if (!value) return 'Recently';

  try {
    return formatDistanceToNow(new Date(value), { addSuffix: true });
  } catch {
    return 'Recently';
  }
}

const documentStatusTone: Record<string, string> = {
  uploaded: 'bg-slate-600 text-white',
  pending: 'bg-slate-600 text-white',
  processing: 'bg-cyan-600 text-white',
  generating: 'bg-cyan-600 text-white',
  ready: 'bg-emerald-600 text-white',
  sent_to_client: 'bg-emerald-600 text-white',
  failed: 'bg-red-600 text-white',
};

export function WorkspaceActivityPanel() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [conversations, setConversations] = useState<WorkspaceConversation[]>([]);
  const [documents, setDocuments] = useState<WorkspaceDocument[]>([]);
  const [deliverables, setDeliverables] = useState<WorkspaceDeliverable[]>([]);

  useEffect(() => {
    let isMounted = true;

    async function loadWorkspaceActivity() {
      setIsLoading(true);
      setError('');

      try {
        const [chatResponse, documentResponse, deliverableResponse] = await Promise.all([
          fetch('/api/chat/history', { credentials: 'include' }),
          fetch('/api/documents?limit=6', { credentials: 'include' }),
          fetch('/api/service-deliverables', { credentials: 'include' }),
        ]);

        const [chatData, documentData, deliverableData] = await Promise.all([
          chatResponse.json(),
          documentResponse.json(),
          deliverableResponse.json(),
        ]);

        if (!chatResponse.ok) {
          throw new Error(chatData.error || 'Unable to load recent conversations.');
        }

        if (!documentResponse.ok) {
          throw new Error(documentData.error || 'Unable to load recent documents.');
        }

        if (!deliverableResponse.ok) {
          throw new Error(deliverableData.error || 'Unable to load recent service activity.');
        }

        if (!isMounted) return;

        setConversations(chatData.conversations || []);
        setDocuments(documentData.documents || []);
        setDeliverables(deliverableData.deliverables || []);
        captureClientEvent(analyticsEvents.workspaceActivityLoaded, {
          conversation_count: (chatData.conversations || []).length,
          document_count: (documentData.documents || []).length,
          deliverable_count: (deliverableData.deliverables || []).length,
        });
      } catch (error) {
        if (!isMounted) return;
        setError(
          error instanceof Error
            ? error.message
            : 'Unable to load your recent workspace activity.'
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadWorkspaceActivity();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <Card className="border-cyan-500/20 bg-card/80 backdrop-blur">
      <CardHeader className="gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-cyan-600" />
            Workspace activity
          </CardTitle>
          <CardDescription>
            Review your latest saved AI conversations and uploaded documents in one place.
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="/chat">Open Chat</Link>
          </Button>
          <Button asChild size="sm" className="bg-cyan-600 hover:bg-cyan-700">
            <Link href="/credit-upload">Open Documents</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-3 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-cyan-600" />
            Loading workspace activity...
          </div>
        ) : error ? (
          <div className="flex items-start gap-3 rounded-lg border border-red-500/20 bg-red-500/5 p-4">
            <AlertCircle className="mt-0.5 h-4 w-4 text-red-500" />
            <div>
              <p className="font-medium">Workspace activity is unavailable.</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-3">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-cyan-600" />
                <p className="font-medium">Recent conversations</p>
              </div>
              {conversations.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  No saved conversations yet. Start a VestBot thread and it will appear here.
                </div>
              ) : (
                <div className="space-y-3">
                  {conversations.slice(0, 4).map((conversation) => (
                    <div
                      key={conversation.id}
                      className="rounded-lg border border-border/60 bg-background/70 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{conversation.title}</p>
                          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                            {conversation.preview}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <Badge variant="outline">{conversation.messageCount} messages</Badge>
                          <Badge variant="secondary">
                            {getChatAssistant(conversation.assistantType).label}
                          </Badge>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <p className="text-xs text-muted-foreground">
                          Updated {relativeTime(conversation.updatedAt)}
                        </p>
                        <Button asChild size="sm" variant="ghost">
                          <Link href={`/chat?chat=${conversation.id}`}>Resume</Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-cyan-600" />
                <p className="font-medium">Recent documents</p>
              </div>
              {documents.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  No saved documents yet. Uploaded credit, funding, or letter files will appear here.
                </div>
              ) : (
                <div className="space-y-3">
                  {documents.slice(0, 4).map((document) => (
                    <div
                      key={document.id}
                      className="rounded-lg border border-border/60 bg-background/70 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{document.documentName}</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {document.documentType || 'Document'} updated{' '}
                            {relativeTime(document.updatedAt)}
                          </p>
                        </div>
                        <Badge
                          className={
                            documentStatusTone[document.status] ||
                            'bg-slate-600 text-white'
                          }
                        >
                          {document.status}
                        </Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {document.accessUrl ? (
                          <Button asChild size="sm" variant="outline">
                            <a href={document.accessUrl} target="_blank" rel="noreferrer">
                              Open file
                              <ExternalLink className="ml-2 h-3.5 w-3.5" />
                            </a>
                          </Button>
                        ) : null}
                        {document.relatedItemId ? (
                          <Button asChild size="sm" variant="ghost">
                            <Link href={`/credit-dashboard/${document.relatedItemId}`}>
                              View status
                            </Link>
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-cyan-600" />
                <p className="font-medium">Recent service activity</p>
              </div>
              {deliverables.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  No saved service plans yet. Visibility, AI receptionist, and funding requests will appear here once submitted.
                </div>
              ) : (
                <div className="space-y-3">
                  {deliverables.slice(0, 4).map((deliverable) => (
                    <div
                      key={deliverable.leadId}
                      className="rounded-lg border border-border/60 bg-background/70 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{deliverable.packageTitle}</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {deliverable.businessName || 'VestBlock request'}
                          </p>
                        </div>
                        <Badge variant="outline">
                          {deliverable.deliverable?.status || deliverable.leadStatus || 'requested'}
                        </Badge>
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                        {deliverable.deliverable?.summary || deliverable.deliverable?.title || 'Saved in your service dashboard.'}
                      </p>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <p className="text-xs text-muted-foreground">
                          Updated {relativeTime(deliverable.updatedAt || deliverable.submittedAt)}
                        </p>
                        <Button asChild size="sm" variant="ghost">
                          <Link href="/dashboard/services">Open</Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
