"use client";
import { useEffect, useState } from "react";
import { accountClient } from "../account/client";
import { type Mutate, type Request, type Run } from "./ui";
export async function deliverNotifications(eventId:string){try{await accountClient().functions.invoke("send-notifications",{body:{eventId},headers:{"x-region":"ap-southeast-2"}});}catch{/* Outbox and visible delivery status retain failed work for retry. */}}
export function NotificationStatus({eventId,revision,request,mutate,run,disabled}:{eventId:string;revision:number;request:Request;mutate:Mutate;run:Run;disabled:boolean}){
 const [status,setStatus]=useState<{pending:number;sent:number;failed:number}|null>(null),[failed,setFailed]=useState(false),[sendError,setSendError]=useState("");
 useEffect(()=>{let alive=true;void request<{pending:number;sent:number;failed:number}>("notifications_status_v1",{eventId}).then(value=>{if(alive){setStatus(value);setFailed(false);}}).catch(()=>{if(alive)setFailed(true);});return()=>{alive=false;};},[eventId,revision,request]);
 async function retry(){setStatus(await mutate("notifications_retry_v1",{eventId}));await send();}
 async function send(){const {error}=await accountClient().functions.invoke("send-notifications",{body:{eventId},headers:{"x-region":"ap-southeast-2"}});if(error){try{setStatus(await request("notifications_status_v1",{eventId}));setFailed(false);}catch{setFailed(true);}let code="";try{code=(await error.context?.json())?.code || "";}catch{}setSendError(["SMTP_NOT_CONFIGURED","SMTP_AUTH_FAILED"].includes(code) || error.context?.status === 404 ? "Email sender needs attention. Unsent notifications are retained." : "Email delivery failed. Notifications remain queued for retry.");throw error;}setStatus(await request("notifications_status_v1",{eventId}));setFailed(false);setSendError("");}
 return <details className="ss-options"><summary>Email notifications</summary>{failed ? <p role="status">Delivery status unavailable. Messages are not confirmed sent.</p> : status ? <p>{status.pending} queued · {status.sent} accepted by mail server · {status.failed} failed</p> : <p>Checking delivery status…</p>}
 {sendError && <p role="alert" className="ss-notice error">{sendError}</p>}
 {(failed || Boolean(status?.pending)) && <button disabled={disabled} onClick={()=>{void run(send,"Notification delivery checked.");}}>Send queued notifications</button>}
 {Boolean(status?.failed) && <button disabled={disabled} onClick={()=>{void run(retry,"Notification delivery checked.");}}>Retry failed notifications</button>}
 <p className="ss-help">Queued messages need a configured email sender. Provider acceptance does not confirm inbox delivery.</p></details>;
}
