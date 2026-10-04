"use client";
import { useEffect, useState } from "react";
import { Badge, Confirm, type Mutate, type Run } from "./ui";
import { dateLabel, rangeLabel, type EventDetail, type Shift } from "./types";
export function ResponseBadge({shift}:{shift:Shift}) {
  const status = shift.acknowledgement?.status || "pending";
  return <Badge tone={status === "confirmed" ? "green" : status === "declined" ? "amber" : "quiet"}>{status === "confirmed" ? "Confirmed" : status === "declined" ? "Declined · manager review" : "Awaiting response"}</Badge>;
}
export function ShiftResponse({shift,event,mutate,run,disabled,saved,onDirty}:{shift:Shift;event:EventDetail;mutate:Mutate;run:Run;disabled:boolean;saved:(event:EventDetail)=>void;onDirty:(dirty:boolean)=>void}) {
  const [choice,setChoice]=useState<"confirmed"|"declined"|null>(null), [reason,setReason]=useState(""), [error,setError]=useState("");
  useEffect(()=>{if(choice)onDirty(Boolean(reason));},[choice,reason,onDirty]);
  const status=shift.acknowledgement?.status || "pending";
  async function respond() {
    const value=await mutate<EventDetail>("shift_respond_v1",{eventId:event.id,publicationVersion:event.publicationVersion,shiftId:shift.id,response:choice,reason:choice === "declined" ? reason.trim() : null});
    saved(value); setChoice(null); setReason("");onDirty(false);
  }
  return <><ResponseBadge shift={shift} />
    {status === "pending" && <div className="ss-actions ss-shift-response"><button className="primary" disabled={disabled} onClick={()=>{setError("");setChoice("confirmed");}}>Confirm shift</button><button disabled={disabled} onClick={()=>{setError("");setChoice("declined");}}>Decline</button></div>}
    {status === "declined" && shift.acknowledgement?.reason && <p className="ss-decline-reason">{shift.acknowledgement.reason}</p>}
    {choice && <Confirm title={choice === "confirmed" ? "Confirm this shift?" : "Decline this shift?"} label={choice === "confirmed" ? "Confirm shift" : "Send to manager"} busy={disabled} cancel={()=>{setChoice(null);setReason("");setError("");onDirty(false);}} accept={()=>{if(choice === "declined" && !reason.trim()){setError("Add a reason for your manager.");return;}void run(respond,choice === "confirmed" ? "Shift confirmed." : "Decline recorded. Contact your manager to discuss the shift.");}}>
      <p>{dateLabel(event.days.find(day=>day.id===shift.dayId)!.date)} · {rangeLabel(shift)}</p>{error && <p role="alert" className="ss-notice error">{error}</p>}
      {choice === "declined" ? <><label>Reason<textarea required maxLength={500} value={reason} onChange={e=>setReason(e.target.value)} /></label><p>Your shift remains assigned until your manager changes it.</p></> : <p>I have seen this shift and know when I am rostered to work.</p>}
    </Confirm>}
  </>;
}
