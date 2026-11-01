const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");

const PORT = Number(process.env.PORT || 3000);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "CHANGE_THIS_PASSWORD";
const OWNER_PHONE = (process.env.OWNER_PHONE || "8371908909").replace(/\D/g, "");
const SMS_PROVIDER = process.env.SMS_PROVIDER || "none";
const MSG91_AUTHKEY = process.env.MSG91_AUTHKEY || "";
const MSG91_TEMPLATE_ID = process.env.MSG91_TEMPLATE_ID || "";
const MSG91_SENDER_ID = process.env.MSG91_SENDER_ID || "";
const DB_FILE = path.join(__dirname, "bookings.json");
let bookings = [];
try { bookings = JSON.parse(fs.readFileSync(DB_FILE, "utf8")); } catch (_) {}
const tokens = new Set();

function save() { fs.writeFileSync(DB_FILE, JSON.stringify(bookings, null, 2)); }
function send(res, code, data) { res.writeHead(code, {"Content-Type":"application/json; charset=utf-8","Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type, Authorization","Access-Control-Allow-Methods":"GET,POST,OPTIONS"}); res.end(JSON.stringify(data)); }
function body(req) { return new Promise((resolve,reject)=>{let raw="";req.on("data",c=>{raw+=c;if(raw.length>20000)req.destroy()});req.on("end",()=>{try{resolve(raw?JSON.parse(raw):{})}catch(e){reject(e)}});req.on("error",reject)}); }
function owner(req) { const h=req.headers.authorization||"";return tokens.has(h.replace(/^Bearer /,"")); }
function clean(s,n=160){return String(s||"").trim().slice(0,n)}
async function notifyOwner(b) {
  if (SMS_PROVIDER !== "msg91" || !MSG91_AUTHKEY || !MSG91_TEMPLATE_ID || !MSG91_SENDER_ID) {
    console.log("SMS not sent: configure MSG91 credentials and DLT template. Booking:", b.id);
    return;
  }
  const payload = { template_id: MSG91_TEMPLATE_ID, sender: MSG91_SENDER_ID, short_url: "0", mobiles: "91" + OWNER_PHONE, VAR1: b.name, VAR2: b.pickup, VAR3: b.destination, VAR4: b.phone, VAR5: b.id };
  try {
    const r = await fetch("https://control.msg91.com/api/v5/flow/", {method:"POST",headers:{"Content-Type":"application/json","authkey":MSG91_AUTHKEY},body:JSON.stringify(payload)});
    const t = await r.text(); console.log("MSG91 response:", r.status, t);
  } catch (e) { console.error("SMS provider error:", e.message); }
}
function staticFile(res, name) {
  const file = path.join(__dirname, name);
  fs.readFile(file,(err,data)=>{if(err){res.writeHead(404);res.end("Not found");return}
    const ext=path.extname(file);res.writeHead(200,{"Content-Type":ext===".html"?"text/html; charset=utf-8":"text/plain"});res.end(data);});
}
const server=http.createServer(async(req,res)=>{
  if(req.method==="OPTIONS"){send(res,204,{});return}
  const u=new URL(req.url,"http://localhost");
  if(req.method==="GET" && u.pathname==="/"){staticFile(res,"customer.html");return}
  if(req.method==="GET" && u.pathname==="/owner"){staticFile(res,"owner.html");return}
  try {
    if(req.method==="POST" && u.pathname==="/api/owner/login"){
      const b=await body(req);if(!crypto.timingSafeEqual(Buffer.from(String(b.password||"").padEnd(128).slice(0,128)),Buffer.from(String(ADMIN_PASSWORD).padEnd(128).slice(0,128)))){send(res,401,{error:"Wrong password"});return}
      const token=crypto.randomBytes(32).toString("hex");tokens.add(token);send(res,200,{token});return;
    }
    if(req.method==="POST" && u.pathname==="/api/bookings"){
      const b=await body(req);
      if(!clean(b.name,70)||!clean(b.phone,20)||!clean(b.pickup)||!clean(b.destination)||!["Cash","Online"].includes(b.payment)){send(res,400,{error:"সব প্রয়োজনীয় তথ্য সঠিকভাবে দিন"});return}
      const item={id:crypto.randomUUID(),name:clean(b.name,70),phone:clean(b.phone,20),pickup:clean(b.pickup),destination:clean(b.destination),payment:b.payment,notes:clean(b.notes,400),fare:null,cashStatus:"Pending",status:"New booking",createdAt:new Date().toISOString()};
      bookings.unshift(item);save();await notifyOwner(item);send(res,201,{id:item.id,status:"Booking received"});return;
    }
    if(req.method==="GET" && u.pathname.startsWith("/api/bookings/")){
      const id=u.pathname.split("/").pop();const b=bookings.find(x=>x.id===id);if(!b){send(res,404,{error:"Booking not found"});return}
      send(res,200,{id:b.id,fare:b.fare,payment:b.payment,cashStatus:b.cashStatus,status:b.status});return;
    }
    if(u.pathname==="/api/owner/bookings" && req.method==="GET"){
      if(!owner(req)){send(res,401,{error:"Please login"});return}send(res,200,bookings);return;
    }
    const fareMatch=u.pathname.match(/^\/api\/owner\/bookings\/([^/]+)\/fare$/);
    if(fareMatch && req.method==="POST"){
      if(!owner(req)){send(res,401,{error:"Please login"});return}const b=bookings.find(x=>x.id===fareMatch[1]);if(!b){send(res,404,{error:"Booking not found"});return}
      const data=await body(req);const fare=Number(data.fare);if(!Number.isFinite(fare)||fare<1||fare>100000){send(res,400,{error:"Invalid fare"});return}
      b.fare=Math.round(fare*100)/100;b.status="Fare set";save();send(res,200,{ok:true});return;
    }
    const cashMatch=u.pathname.match(/^\/api\/owner\/bookings\/([^/]+)\/cash$/);
    if(cashMatch && req.method==="POST"){
      if(!owner(req)){send(res,401,{error:"Please login"});return}const b=bookings.find(x=>x.id===cashMatch[1]);if(!b){send(res,404,{error:"Booking not found"});return}
      const data=await body(req);b.cashStatus=data.received?"YES — received":"NO — not received";b.status="Cash payment updated";save();send(res,200,{ok:true});return;
    }
    send(res,404,{error:"Not found"});
  } catch(e){console.error(e);send(res,500,{error:"Server error"});}
});
server.listen(PORT,()=>console.log(`Toto Ride running: http://localhost:${PORT} (customer), http://localhost:${PORT}/owner (owner)`));
