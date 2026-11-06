import { createClient } from '@supabase/supabase-js';
import { acquireSafety } from './_safety';
const url=process.env.SUPABASE_URL, key=process.env.SUPABASE_PUBLISHABLE_KEY, service=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key||!service)throw new Error('Missing test configuration');
const admin=createClient(url,service,{auth:{persistSession:false}}), pub=createClient(url,key,{auth:{persistSession:false}});
const safety=await acquireSafety('public-worker-achievements');
const users:string[]=[],workers:string[]=[],achievementRows:string[]=[];
let pass=0,fail=0;const T=Date.now(),city=`Accessdemo${T}`;
const ok=(label:string,result:unknown)=>{console.log(result?'PASS':'FAIL',label);result?pass++:fail++;};
async function account(tag:string){const email=`access-${tag}-${T}@example.com`,password=crypto.randomUUID()+'Aa1!';const r=await admin.auth.admin.createUser({email,password,email_confirm:true});if(r.error||!r.data.user)throw new Error('Temporary signup failed');users.push(r.data.user.id);const c=createClient(url,key,{auth:{persistSession:false}});const login=await c.auth.signInWithPassword({email,password});if(login.error)throw login.error;return{id:r.data.user.id,c};}
try{
 const owner=await account('owner'),stranger=await account('stranger'),staff=await account('staff'),cross=await account('cross');
 const role=await admin.from('user_roles').insert([{user_id:staff.id,role:'admin',city},{user_id:cross.id,role:'admin',city:`Other${T}`}]);if(role.error)throw role.error;
 const catalog=await pub.from('achievements').select('id,title');if(catalog.error||!catalog.data?.length)throw new Error('Achievement catalog unavailable');
 ok('Public achievement catalog preserved',catalog.data.length>0);
 const a=await admin.from('user_achievements').insert({user_id:owner.id,achievement_id:catalog.data[0].id}).select('id').single();if(a.error||!a.data)throw new Error('Temporary achievement failed');achievementRows.push(a.data.id);
 const anonymous=await pub.from('user_achievements').select('id,user_id,achievement_id,unlocked_at');ok('Anonymous achievement account enumeration denied',!!anonymous.error);
 const mine=await owner.c.from('user_achievements').select('*').eq('user_id',owner.id);ok('Owner sees genuine achievement history',!mine.error&&mine.data?.some(x=>x.id===a.data.id));
 const hidden=await stranger.c.from('user_achievements').select('*').eq('user_id',owner.id);ok('Other account cannot read owner achievements',!hidden.error&&hidden.data?.length===0);
 const forge=await owner.c.from('user_achievements').insert({user_id:owner.id,achievement_id:catalog.data[0].id});ok('Client cannot forge earned achievements',!!forge.error);
 for(const active of [true,false]){const w=await admin.from('workers').insert({name:`DEMO access ${active}`,city,user_id:owner.id,is_active:active}).select('id').single();if(w.error||!w.data)throw new Error('Temporary worker failed');workers.push(w.data.id);}
 const list=await pub.from('workers').select('id,name,department_id,is_active,created_at').in('id',workers);ok('Public active worker fields preserved',!list.error&&list.data?.length===1&&list.data[0].id===workers[0]);
 ok('Inactive worker absent from anonymous list',!list.error&&!list.data?.some(x=>x.id===workers[1]));
 for(const col of ['phone','user_id','city']){const r=await pub.from('workers').select(col);ok(`Anonymous worker ${col} denied`,!!r.error);}
 const ownWorkers=await owner.c.from('workers').select('id,user_id,city').in('id',workers);ok('Linked worker reads own active and inactive records',!ownWorkers.error&&ownWorkers.data?.length===2);
 const foreign=await stranger.c.from('workers').select('id,user_id,city').in('id',workers);ok('Unrelated citizen cannot enumerate worker account IDs',!foreign.error&&foreign.data?.length===0);
 const managed=await staff.c.from('workers').select('id,user_id,city').in('id',workers);ok('Same-city Admin reads managed workers',!managed.error&&managed.data?.length===2);
 const otherCity=await cross.c.from('workers').select('id,user_id,city').in('id',workers);ok('Cross-city Admin cannot read worker internals',!otherCity.error&&otherCity.data?.length===0);
 const lb=await pub.rpc('public_leaderboard');ok('Public leaderboard badge projection preserved',!lb.error&&lb.data?.some(x=>x.id)&&lb.data.every(x=>!('user_id'in x)));
 const alerts=await pub.from('notifications').select('id,type,complaint_id');ok('Public announcements remain complaint-free',!alerts.error&&alerts.data?.every(x=>x.complaint_id===null));
}finally{
 if(achievementRows.length)await admin.from('user_achievements').delete().in('id',achievementRows);
 if(workers.length)await admin.from('workers').delete().in('id',workers);
 if(users.length)await admin.from('user_roles').delete().in('user_id',users);
 for(const id of users){const d=await admin.auth.admin.deleteUser(id);if(d.error)throw d.error;}
 await safety.release();console.log(`${pass} passed, ${fail} failed, 0 skipped`);
}
if(fail)process.exitCode=1;