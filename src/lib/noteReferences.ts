/** References stay linked to stable player IDs in storage, but IDs never enter the editor. */
type Segment = {text:string; raw:string; start:number; end:number; reference:boolean};

function segments(raw:string):Segment[] {
  const result:Segment[]=[];
  let rawStart=0,visibleStart=0;
  const append=(text:string,stored=text,reference=false)=>{
    if(!text)return;
    result.push({text,raw:stored,start:visibleStart,end:visibleStart+text.length,reference});
    visibleStart+=text.length;
  };
  for(const match of raw.matchAll(/@\[([^\]]+)\]\(([^)]+)\)/g)) {
    append(raw.slice(rawStart,match.index));
    append(match[1],match[0],true);
    rawStart=match.index!+match[0].length;
  }
  append(raw.slice(rawStart));
  return result;
}

export function referenceText(raw:string):string {
  return segments(raw).map(segment=>segment.text).join('');
}

function slice(parts:Segment[],start:number,end:number,unsafe?:{start:number;end:number}):string {
  return parts.map(part=>{
    const left=Math.max(start,part.start),right=Math.min(end,part.end);
    if(left>=right)return '';
    const touched=unsafe&&part.start<unsafe.end&&part.end>unsafe.start;
    return part.reference&&left===part.start&&right===part.end&&!touched
      ?part.raw:part.text.slice(left-part.start,right-part.start);
  }).join('');
}

/** A modified reference becomes ordinary text; untouched references keep their stored ID. */
export function editReferenceText(raw:string,newVisible:string):string {
  const parts=segments(raw),oldVisible=parts.map(part=>part.text).join('');
  if(oldVisible===newVisible)return raw;
  let prefix=0,suffix=0;
  const limit=Math.min(oldVisible.length,newVisible.length);
  while(prefix<limit&&oldVisible[prefix]===newVisible[prefix])prefix++;
  while(suffix<limit&&oldVisible[oldVisible.length-1-suffix]===newVisible[newVisible.length-1-suffix])suffix++;
  const retained=Math.min(limit,prefix+suffix);
  const earliestStart=Math.max(0,retained-suffix);
  const latestStart=Math.min(prefix,retained);
  const safeSuffix=retained-latestStart;
  const oldEnd=oldVisible.length-safeSuffix,newEnd=newVisible.length-safeSuffix;
  // Repeated identical labels can make a text-only edit ambiguous. Drop their links
  // rather than silently assigning the remaining label to the wrong player.
  const unsafe={start:earliestStart,end:oldEnd};
  return slice(parts,0,latestStart,unsafe)+newVisible.slice(latestStart,newEnd)+slice(parts,oldEnd,oldVisible.length,unsafe);
}

/** start/end are the textarea's UTF-16 selection offsets, in visible text. */
export function insertSeatReference(raw:string,startVisible:number,endVisible:number,label:string,playerId:string):string {
  const parts=segments(raw),length=parts.at(-1)?.end??0;
  const start=Math.max(0,Math.min(length,startVisible));
  const end=Math.max(start,Math.min(length,endVisible));
  // Slicing through a reference makes its remaining characters plain text.
  return slice(parts,0,start)+`@[${label}](${playerId})`+slice(parts,end,length);
}
