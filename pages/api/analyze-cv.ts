// app/[sessionToken]/page.tsx
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import JobAdInput from '@/components/JobAdInput';



interface CVData {
  session_token: string;
  cv_file_url: string;
  cv_data: string;
  created_at: string;
}

export default async function SessionPage({
  params: { sessionToken },
}: {
  params: { sessionToken: string };
}) {
  // Create a server-side Supabase client
  const supabase = createServerComponentClient<Database>({
    cookies,
  });

  // Fetch CV data from Supabase
  const { data, error } = await supabase
    .from('cv_data')
    .select('*')
    .eq('session_token', sessionToken)
    .single();

  if (error || !data) {
    notFound();
  }

  const cvData: CVData = data;

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Your CV Analysis</h1>

      <div className="mb-4">
        <h2 className="text-lg font-semibold">Uploaded CV</h2>
        <a
          href={cvData.cv_file_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 underline"
        >
          View Uploaded PDF
        </a>
      </div>

      <div>
        <h2 className="text-lg font-semibold">Parsed CV Data</h2>
        <pre className="p-4 bg-gray-100 rounded whitespace-pre-wrap">
          {cvData.cv_data ? cvData.cv_data : 'No parsed data available.'}
        </pre>
      </div>

      <JobAdInput sessionToken={sessionToken} />
    </main>
  );
}
