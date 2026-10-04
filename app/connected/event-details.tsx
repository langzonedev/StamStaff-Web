"use client";
import { useEffect, useState } from "react";
import { accountClient } from "../account/client";
import { Confirm, type Mutate, type Run } from "./ui";
import { deliverNotifications } from "./notification-status";
import { bannerFormat } from "./event-banner";
import { emptyEventInfo, type EventInfo, type EventDetail, type EventSummary } from "./types";
export function EventBanner({event}:{event:EventSummary}) {
  const [image,setImage]=useState<{path:string;url:string}|null>(null);
  const path=event.details?.bannerPath;
  useEffect(()=>{let alive=true;
    if(path) void accountClient().storage.from("event-banners").createSignedUrl(path,3600).then(({data})=>{if(alive && data?.signedUrl)setImage({path,url:data.signedUrl});});
    return ()=>{alive=false;};
  },[path]);
  // Private signed image URLs are transient and never stored in event metadata.
  // eslint-disable-next-line @next/next/no-img-element -- Private expiring URLs use the browser directly; static export has no image proxy.
  return image && image.path === path ? <div className="ss-event-banner"><img src={image.url} alt="" /></div> : null;
}
const fields: {key:Exclude<keyof EventInfo,"bannerPath">;label:string;max:number}[]=[
  {key:"location",label:"Location / venue",max:120},{key:"address",label:"Address",max:300},
  {key:"parking",label:"Parking",max:500},{key:"tickets",label:"Tickets / entry",max:500},{key:"notes",label:"Other event details",max:2000}];
export function EventInformation({event,manager,mutate,run,disabled,blocked=false,saved,onDirty}:{event:EventDetail;manager:boolean;mutate:Mutate;run:Run;disabled:boolean;blocked?:boolean;saved:(event:EventDetail)=>void;onDirty:(dirty:boolean)=>void}) {
  const [editing,setEditing]=useState(false),[details,setDetails]=useState<EventInfo>({...emptyEventInfo,...event.details}),[file,setFile]=useState<File|null>(null),[error,setError]=useState("");
  const dirty=editing && (Boolean(file) || JSON.stringify(details)!==JSON.stringify({...emptyEventInfo,...event.details}));
  useEffect(()=>{if(editing)onDirty(dirty);},[dirty,editing,onDirty]);
  async function save(){
    let next={...details,location:details.location.trim(),address:details.address.trim(),parking:details.parking.trim(),tickets:details.tickets.trim(),notes:details.notes.trim()};
    if(file){
      let extension:"png"|"jpg"|"webp";
      try{extension=await bannerFormat(file);}catch(error){setError(error instanceof Error ? error.message : "Choose a valid image.");throw error;}
      const path=`${event.id}/${crypto.randomUUID()}.${extension}`;
      const {error:uploadError}=await accountClient().storage.from("event-banners").upload(path,file,{upsert:false,contentType:file.type});
      if(uploadError){setError("The banner could not be uploaded. Your details are kept; try again.");throw uploadError;}
      next={...next,bannerPath:path};setDetails(next);setFile(null);
    }
    const value=await mutate<EventDetail>("event_command_v1",{action:"update_details",eventId:event.id,revision:event.revision,details:next});
    saved(value);if(event.status === "published")void deliverNotifications(event.id);setEditing(false);onDirty(false);setError("");
  }
  const present=fields.some(f=>event.details?.[f.key]) || event.details?.bannerPath;
  return <>
    {present && <details className="ss-event-information ss-options"><summary>Event information{event.details?.location ? ` · ${event.details.location}` : ""}</summary><EventBanner event={event} /><dl>{fields.filter(f=>event.details?.[f.key]).map(f=><div key={f.key}><dt>{f.label}</dt><dd>{event.details?.[f.key]}</dd></div>)}</dl></details>}
    {manager && event.status!=="archived" && <div className="ss-event-info-action"><button disabled={disabled || blocked} onClick={()=>{setDetails({...emptyEventInfo,...event.details});setError("");setEditing(true);}}>Edit event information</button></div>}
    {editing && <Confirm title="Event information" label="Save information" busy={disabled} cancel={()=>{setEditing(false);onDirty(false);setFile(null);setError("");}} accept={()=>{void run(save,event.status === "published" ? "Event information updated. Notifications queued." : "Event information saved.");}}>
      <div className="ss-event-details-form">{fields.map(f=><label key={f.key}>{f.label}<textarea rows={f.key === "notes" ? 3 : 2} maxLength={f.max} value={details[f.key]} onChange={e=>setDetails({...details,[f.key]:e.target.value})}/></label>)}
      <label>Event banner (optional)<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{setFile(e.target.files?.[0] || null);setError("");}} /></label>
      {details.bannerPath && <button type="button" onClick={()=>{setDetails({...details,bannerPath:null});setFile(null);}}>Remove banner</button>}
      {error && <p role="alert" className="ss-notice error">{error}</p>}</div>
    </Confirm>}
  </>;
}

