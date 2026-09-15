export class ImportExtractionError extends Error{
  constructor(public code:"unsupported_file"|"extraction_unavailable"|"file_too_large",message:string){super(message)}
}

const textTypes=new Set(["text/plain","text/markdown","text/csv","application/json"]);

export async function extractImportText(file:File){
  if(file.size>10*1024*1024)throw new ImportExtractionError("file_too_large","Choose a file smaller than 10 MB.");
  const extension=file.name.split(".").pop()?.toLowerCase();
  if(textTypes.has(file.type)||["txt","md","csv","json"].includes(extension||""))return (await file.text()).slice(0,30000);
  if(file.type.startsWith("image/")||["png","jpg","jpeg","heic","webp"].includes(extension||""))throw new ImportExtractionError("extraction_unavailable","Image recognition is not connected yet. Your image was not stored. Paste the workout text for now.");
  if(file.type==="application/pdf"||extension==="pdf")throw new ImportExtractionError("extraction_unavailable","PDF recognition is not connected yet. Your file was not stored. Paste the workout text for now.");
  throw new ImportExtractionError("unsupported_file","Use pasted text, a text file, an image or a PDF.");
}

