// pages/u/[userId]/index.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../../lib/supabase';
import FileUpload from '../../../components/FileUpload';
import CVList from '../../../components/CVList';

export default function Dashboard() {
  const router = useRouter();
  const { userId } = router.query;
  const [cvs, setCvs] = useState([]);

  useEffect(() => {
    if (userId) fetchCvs();
  }, [userId]);

  async function fetchCvs() {
    const { data, error } = await supabase
      .from('cv_metadata')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });
    if (error) console.error('Error fetching CVs:', error);
    else setCvs(data);
  }

  return (
    <div className="p-4 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Your Dashboard</h1>
      <FileUpload userId={userId} onUpload={fetchCvs} />
      <CVList cvs={cvs} />
    </div>
  );
}
