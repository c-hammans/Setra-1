export type ExportSectionCheck={section:string;count:number|null;error?:string};

export function summarizeExportPreflight(sections:ExportSectionCheck[]){
  const errors=sections.filter(item=>item.error).map(item=>({section:item.section,message:item.error!}));
  return {complete:errors.length===0,sections,errors,scope:"Cloud-synced Setra data only."};
}
