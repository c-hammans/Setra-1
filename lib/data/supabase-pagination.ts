export type SupabasePage<T>={data:T[]|null;error:unknown};

/** Loads every stable, ordered page instead of trusting the backend row cap. */
export async function loadSupabasePages<T>(fetchPage:(from:number,to:number)=>PromiseLike<SupabasePage<T>>,pageSize=500){
  const rows:T[]=[];let from=0;
  for(;;){const result=await fetchPage(from,from+pageSize-1);if(result.error)throw result.error;const page=result.data||[];rows.push(...page);if(page.length<pageSize)return rows;from+=pageSize}
}
