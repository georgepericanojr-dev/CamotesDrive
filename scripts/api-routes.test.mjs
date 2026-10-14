import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { after,before,test } from 'node:test';
import { createHandler } from '../supabase/functions/camotes-api/handler.ts';
import { databaseStatus,resolveRoute } from '../supabase/functions/camotes-api/routes.ts';
let server,handler,received=[],failure=null;
before(async()=>{
 server=createServer(async(req,res)=>{
   let raw='';for await(const chunk of req)raw+=chunk;
   res.setHeader('content-type','application/json');
   if(req.url==='/auth/v1/user'){
     res.statusCode=req.headers.authorization==='Bearer valid-user'?200:401;
     res.end(JSON.stringify(res.statusCode===200?{id:'00000000-0000-0000-0000-000000000001',aud:'authenticated',email:'test@example.test'}:{message:'Invalid token'}));return;
   }
   received.push({path:req.url,authorization:req.headers.authorization,body:JSON.parse(raw||'{}')});
   if(failure){res.statusCode=400;res.end(JSON.stringify(failure));return;}
   res.end(JSON.stringify({ok:true}));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 handler=createHandler({url:`http://127.0.0.1:${server.address().port}`,key:'public-test-key',origins:['https://app.example.test']});
});
after(async()=>{await new Promise(resolve=>server.close(resolve));});
const request=(path,method='GET',body,extra={})=>new Request(`https://api.example.test/functions/v1/camotes-api${path}`,{method,headers:{...(body===undefined?{}:{'Content-Type':'application/json'}),...extra},body:body===undefined?undefined:JSON.stringify(body)});
const auth={Authorization:'Bearer valid-user'};
test('public route uses read RPC without requiring user Auth',async()=>{const response=await handler(request('/vehicles?search=Toyota'));assert.equal(response.status,200);assert.equal(received.at(-1).body.resource,'vehicles');assert.equal(received.at(-1).body.params.search,'Toyota');});
test('private route requires bearer token before database access',async()=>{const count=received.length;assert.equal((await handler(request('/me'))).status,401);assert.equal(received.length,count);});
test('expired/invalid bearer token is rejected by Auth',async()=>{const count=received.length;assert.equal((await handler(request('/me','GET',undefined,{Authorization:'Bearer invalid'}))).status,401);assert.equal(received.length,count);});
test('URL identity overrides malicious body identity and caller JWT is preserved',async()=>{const response=await handler(request('/bookings/trusted-id/cancel','POST',{id:'other-id',reason:'Changed plans'},auth));assert.equal(response.status,200);const call=received.at(-1);assert.equal(call.body.action,'booking.cancel');assert.equal(call.body.payload.id,'trusted-id');assert.equal(call.authorization,'Bearer valid-user');});
test('URL section overrides query section for admin reads',async()=>{await handler(request('/admin/users?section=documents','GET',undefined,auth));assert.equal(received.at(-1).body.params.section,'users');});
test('malformed JSON returns 400 and never reaches transaction RPC',async()=>{const count=received.length;const req=new Request('https://api.example.test/functions/v1/camotes-api/bookings',{method:'POST',headers:auth,body:'{broken'});assert.equal((await handler(req)).status,400);assert.equal(received.length,count);});
test('array JSON is rejected',async()=>{assert.equal((await handler(request('/bookings','POST',[],auth))).status,400);});
test('oversized chunked payload is rejected',async()=>{assert.equal((await handler(request('/bookings','POST',{text:'x'.repeat(70000)},auth))).status,413);});
test('unknown routes and unsupported methods are explicit',async()=>{assert.equal((await handler(request('/unknown'))).status,404);assert.equal((await handler(request('/bookings','PUT',{},auth))).status,405);});
test('CORS rejects unapproved browser origins and accepts allowed preflight',async()=>{assert.equal((await handler(request('/settings','GET',undefined,{Origin:'https://other.example.test'}))).status,403);const response=await handler(request('/settings','OPTIONS',undefined,{Origin:'https://app.example.test'}));assert.equal(response.status,204);assert.equal(response.headers.get('Access-Control-Allow-Origin'),'https://app.example.test');});
test('database authorization errors become 403 without leaking detail',async()=>{failure={code:'42501',message:'Admin role and MFA required',details:'private row payload'};try{const response=await handler(request('/admin/users','GET',undefined,auth));assert.equal(response.status,403);assert.ok(!(JSON.stringify(await response.json())).includes('private row payload'));}finally{failure=null;}});
test('missing migration produces actionable 503',async()=>{failure={code:'PGRST202',message:'Missing RPC'};try{const response=await handler(request('/settings'));assert.equal(response.status,503);assert.match((await response.json()).error,/migration/);}finally{failure=null;}});
test('conflicting booking/payment writes become 409',()=>{for(const code of ['23505','23P01','40001','40P01'])assert.equal(databaseStatus(code),409);});
test('every mutation route is authenticated',()=>{for(const path of ['/bookings','/payments','/settlements','/messages','/admin/settings','/me','/documents'])assert.ok(!resolveRoute('POST',path).public);});
