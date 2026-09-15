import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
import {extractImportText,ImportExtractionError} from "@/lib/import/server-extractor";
import {parseImportSession} from "@/lib/import/text-parser";
import type {Exercise} from "@/lib/setra/types";
import type {ImportModality,ImportSessionPayload,ImportSourceType} from "@/lib/import/types";

export const runtime="nodejs";

export async function POST(request:Request){
  try{
    const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();
    if(!user)return NextResponse.json({error:"Sign in before importing a workout."},{status:401});
    const form=await request.formData();const sourceType=String(form.get("sourceType")||"pasted_text") as ImportSourceType;const sourceApp=String(form.get("sourceApp")||"").trim()||undefined;const hintValue=String(form.get("modality")||"auto");const hint=hintValue==="strength"||hintValue==="endurance"?hintValue as ImportModality:undefined;const file=form.get("file");
    let text=String(form.get("text")||"").trim();let fileMetadata:ImportSessionPayload["file"];
    if(file instanceof File&&file.size){fileMetadata={name:file.name,mimeType:file.type,size:file.size};text=(await extractImportText(file)).trim()}
    if(!text)return NextResponse.json({error:"Add some workout text before analysing."},{status:400});
    if(text.length>30000)return NextResponse.json({error:"The workout text is too long. Keep it under 30,000 characters."},{status:400});
    const {data,error}=await supabase.from("exercises").select("id,name,muscle_group,equipment").order("name");if(error)throw error;
    const catalogue=(data||[]).map(row=>({id:String(row.id),name:String(row.name),group:String(row.muscle_group||"Other"),equipment:String(row.equipment||"Other")} satisfies Exercise));
    const payload:ImportSessionPayload={sourceType,sourceApp,file:fileMetadata,createdAt:new Date().toISOString()};
    return NextResponse.json(parseImportSession(payload,text,catalogue,hint));
  }catch(error){
    if(error instanceof ImportExtractionError)return NextResponse.json({error:error.message,code:error.code},{status:422});
    return NextResponse.json({error:"Setra could not analyse this workout. Please try again."},{status:500});
  }
}

