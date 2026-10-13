import {writeFile} from 'node:fs/promises';
import {scanPublicPage} from './facebook.mjs';

const pages=[
 {name:'Đoàn - Hội Trường CNTT&TT (CICT - CTU)',url:'https://www.facebook.com/CTU.dtn.cntttt'},
 {name:'Khoa Khoa Học Máy Tính - ĐHCT (KHMT)',url:'https://www.facebook.com/khmt.dhct'},
 {name:'Đoàn Trường Đại học Cần Thơ (CTU Youth)',url:'https://www.facebook.com/CTU.Youth'},
 {name:'Đoàn - Hội Trường Kinh Tế - ĐHCT (FutureLab K52)',url:'https://www.facebook.com/CTU.dtn.kt/'},
];
const scans=[];
for(let index=0;index<pages.length;index+=2){
 scans.push(...await Promise.all(pages.slice(index,index+2).map(async target=>({sourceUrl:target.url,...await scanPublicPage(target)}))));
}
const report={protocol:'ctu-public-feed/1',fetchedAt:new Date().toISOString(),scans};
await writeFile('public-feed.json',JSON.stringify(report));
console.log(JSON.stringify({fetchedAt:report.fetchedAt,scans:scans.map(({sourceUrl,state,postCount,error})=>({sourceUrl,state,postCount,error}))}));
if(process.env.SOURCE_FEED_URL && process.env.SOURCE_FEED_KEY){
 const url=new URL(process.env.SOURCE_FEED_URL);
 if(url.protocol!=='https:' || url.pathname!=='/source/public-feed')throw Error('Invalid source feed URL');
 const response=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+process.env.SOURCE_FEED_KEY,'Content-Type':'application/json'},body:JSON.stringify(report),redirect:'error',signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('Source delivery HTTP '+response.status);
 const accepted=await response.json();
 console.log(JSON.stringify({deliveryStatus:accepted.status,healthyPages:accepted.healthyPages}));
}
if(!scans.some(scan=>scan.state==='ok'))process.exitCode=2;
