'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Navigation } from '@/components/navigation';
import { useAuth } from '@/contexts/auth-context';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Eye, DownloadCloud, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface Report {
  userId: string;
  userEmail: string;
  fileName: string;
  filePath: string;
  uploadedAt: string;
  fileUrl: string | null;
}

export default function AdminPanelPage() {
  const { userProfile, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [reports, setReports] = useState<Report[]>([]);
  console.debug('🚀 ~ AdminPanelPage ~ reports:', reports);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || userProfile?.role !== 'admin') {
      router.push('/login?redirect=/tools/admin-panel');
      return;
    }
    fetch('/api/upload-credit-report')
      .then((res) => res.json())
      .then((data) => setReports(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, [authLoading, isAuthenticated, userProfile, router]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* <Navigation /> */}
        <main className="flex-grow flex items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-cyan-500" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* <Navigation /> */}
      {/* <main className="flex-grow pt-24 px-4 pb-8">
        <div className="container mx-auto max-w-5xl">
          <h1 className="text-3xl font-bold mb-6">
            Admin Panel: Credit Reports
          </h1>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User Email</TableHead>
                <TableHead>Uploaded At</TableHead>
                <TableHead>Filename</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.map((r) => (
                <TableRow key={r.filePath}>
                  <TableCell className="font-medium">{r.userEmail}</TableCell>
                  <TableCell>
                    {format(parseISO(r.uploadedAt), 'PPpp')}
                  </TableCell>
                  <TableCell>{r.fileName}</TableCell>
                  <TableCell className="text-right space-x-2">
                    {r.fileUrl && (
                      <>
                        <Button
                          asChild
                          size="icon"
                          variant="outline"
                          onClick={() => window.open(r.fileUrl!, '_blank')}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button asChild size="icon" variant="outline">
                          <a href={r.fileUrl} target="_blank" rel="noopener">
                            <DownloadCloud className="h-4 w-4" />
                          </a>
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </main> */}
      <main className="flex-grow pt-24 px-4 pb-8">
        <div className="container mx-auto max-w-5xl">
          <Card>
            <CardHeader>
              <CardTitle className="text-3xl font-bold mb-2 gradient-text">
                Admin Panel: Credit Reports
              </CardTitle>
              <CardDescription>
                Here you can review all uploaded credit reports and download
                them.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table className="w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead>No</TableHead>
                    <TableHead>User Email</TableHead>
                    <TableHead>Uploaded At</TableHead>
                    <TableHead className="max-w-xs">Filename</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((r, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium whitespace-nowrap">
                        {idx + 1}
                      </TableCell>
                      <TableCell className="font-medium whitespace-nowrap">
                        {r.userEmail}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {format(parseISO(r.uploadedAt), 'MMM d, yyyy h:mm a')}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {r.fileName}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        {r.fileUrl && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => window.open(r.fileUrl!, '_blank')}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={async () => {
                                const resp = await fetch(r.fileUrl!);
                                const blob = await resp.blob();
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = r.fileName;
                                document.body.appendChild(a);
                                a.click();
                                a.remove();
                                URL.revokeObjectURL(url);
                              }}
                            >
                              <DownloadCloud className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
