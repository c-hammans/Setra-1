export type ExportRow={id:string|number;[key:string]:unknown};

export async function* paginateExportRows(
  fetchPage:(afterId:string|number|undefined,limit:number)=>Promise<ExportRow[]>,
  pageSize=500,
){
  let afterId:string|number|undefined;
  for(;;){
    const rows=await fetchPage(afterId,pageSize);
    for(const row of rows)yield row;
    if(rows.length<pageSize)return;
    const next=rows.at(-1)?.id;
    if(typeof next!=="string"&&typeof next!=="number")throw new Error("A stable export cursor was unavailable.");
    if(next===afterId)throw new Error("The export cursor did not advance.");
    afterId=next;
  }
}
