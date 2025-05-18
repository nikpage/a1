import { supabase } from './supabaseClient.js';

(async () => {
  const { data, error } = await supabase
    .from('cv_metadata')
    .select('*')
    .limit(1);
  console.log({ data, error });
})();
