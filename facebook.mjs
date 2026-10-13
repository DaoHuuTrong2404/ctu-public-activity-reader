/** Public page embed reader. No account cookies, storage state, browser or Node dependencies. */
// Facebook rejected its public renderer when a browser User-Agent was spoofed; ordinary fetch works.
// Identify this HTTP service explicitly; the platform default is served an unsupported-browser page.
const REQUEST_HEADERS = { 'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8', 'User-Agent':'CTU-Form-Sniper/5.0 (public page monitor)' };
const VOID_TAGS = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
const SPACE_TAGS = new Set(['br','div','p','li','section','article','h1','h2','h3','h4','h5','h6','tr']);
const ENTITIES = { amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' ',hellip:'…',ndash:'–',mdash:'—',bull:'•',copy:'©' };

export function decodeEntities(value) {
  return String(value || '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (original, entity) => {
    if (entity[0] !== '#') return ENTITIES[entity.toLowerCase()] ?? original;
    const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2),16) : Number(entity.slice(1));
    return Number.isInteger(code) && code>0 && code<=0x10ffff && !(code>=0xd800 && code<=0xdfff) ? String.fromCodePoint(code) : original;
  });
}
function cleanText(value) { return String(value || '').replace(/[\t\r ]+/g,' ').replace(/\s*\n\s*/g,'\n').trim(); }
function shapeKeys(value) { return value && typeof value==='object' && !Array.isArray(value) ? Object.keys(value).filter(key=>/^[A-Za-z_][A-Za-z0-9_]{0,40}$/.test(key)).slice(0,16) : []; }
function publicModules(value){return [...new Set((Array.isArray(value?.jsmods?.require)?value.jsmods.require:[]).map(row=>Array.isArray(row)?row[0]:null).filter(name=>typeof name==='string' && /^[A-Za-z_][A-Za-z0-9_]{0,80}$/.test(name)))].slice(0,16);}
function rendererRedirect(value,base){
  for(const row of Array.isArray(value?.jsmods?.require)?value.jsmods.require:[]){
    if(!Array.isArray(row) || row[0]!=='ServerRedirect' || row[2]!=='redirectPageTo' || typeof row[3]?.[0]!=='string')continue;
    try{const next=new URL(row[3][0],base);if(isFacebookUrl(next.href) && next.pathname==='/platform/plugin/tab/renderer/')return next.href;}catch{}
  }
  return null;
}
function redirectSummary(value,base){
  return (Array.isArray(value?.jsmods?.require)?value.jsmods.require:[]).filter(row=>Array.isArray(row) && row[0]==='ServerRedirect').slice(0,3).map(row=>({method:typeof row[2]==='string' && /^[A-Za-z0-9_]{1,60}$/.test(row[2])?row[2]:null,argumentTypes:Array.isArray(row[3])?row[3].slice(0,3).map(arg=>typeof arg):[],destinations:(Array.isArray(row[3])?row[3]:[]).filter(arg=>typeof arg==='string' && /^(?:https?:|\/)/.test(arg)).slice(0,3).map(arg=>{try{const url=new URL(arg,base);return {hostname:url.hostname,pathname:url.pathname.slice(0,160)};}catch{return {invalid:true};}})}));
}
function isFacebookUrl(value) {
  try { const u=new URL(value); return u.protocol==='https:' && !u.username && !u.password && !u.port && (u.hostname==='facebook.com' || u.hostname.endsWith('.facebook.com')); } catch { return false; }
}
function jsonObjectAt(source,start) {
  while (/\s/.test(source[start] || '') && start<source.length) start++;
  if (source[start]!=='{') return null;
  let depth=0,quoted=false,escaped=false;
  for (let i=start;i<source.length;i++) {
    const char=source[i];
    if (quoted) { if(escaped)escaped=false; else if(char==='\\')escaped=true; else if(char==='"')quoted=false; continue; }
    if(char==='"')quoted=true;
    else if(char==='{')depth++;
    else if(char==='}' && --depth===0) { try{return JSON.parse(source.slice(start,i+1));}catch{return null;} }
  }
  return null;
}
export function parsePublicEmbedConfig(html,targetUrl) {
  if (!isFacebookUrl(targetUrl)) throw new Error('invalid-facebook-target');
  const target=new URL(targetUrl);
  const marker=/"configData"\s*:/g;
  for (const match of String(html).matchAll(marker)) {
    const config=jsonObjectAt(html,match.index+match[0].length);
    if (!config || !isFacebookUrl(config.href)) continue;
    const href=new URL(config.href);
    if (href.pathname.replace(/\/$/,'')!==target.pathname.replace(/\/$/,'')) continue;
    if (!String(config.tabs || '').split(',').includes('timeline')) continue;
    if (!/^\d+$/.test(String(config.app_id || ''))) continue;
    // Only public widget configuration is passed back to Facebook; never a logged-in session.
    return {...config,can_personalize:false};
  }
  return null;
}
function publicSiteData(html) {
  const marker=/\["SiteData",\[\],/;
  const match=marker.exec(html);
  return match?jsonObjectAt(html,match.index+match[0].length):null;
}
function attributes(tag) {
  const result={};
  const content=tag.replace(/^<\/?[\w:-]+/,'').replace(/\/?\s*>$/,'');
  const attr=/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  for (const match of content.matchAll(attr)) result[match[1].toLowerCase()]=decodeEntities(match[2]??match[3]??match[4]??'');
  return result;
}
function absoluteLink(href,base) { try {const u=new URL(href,base);return ['https:','http:'].includes(u.protocol)?u.href:null;}catch{return null;} }
function exactTimestamp(attrs) {
  if (/^\d{9,11}$/.test(attrs['data-utime'] || '')) {
    const date=new Date(Number(attrs['data-utime'])*1000);
    if(Number.isFinite(date.getTime()))return date.toISOString();
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(attrs.datetime || '')) {
    const date=new Date(attrs.datetime);
    if(Number.isFinite(date.getTime()))return date.toISOString();
  }
  return null;
}
export function parseTimelinePosts(html,baseUrl='https://www.facebook.com') {
  const posts=[],stack=[];
  let active=null,skipTag=null;
  function append(text) {
    if(!active || skipTag)return;
    active.parts.push(text); active.length+=text.length;
    for(const anchor of active.openAnchors)anchor.parts.push(text);
  }
  function closeNode(node) {
    if(node.anchor && active) {
      node.anchor.end=active.length;
      active.openAnchors=active.openAnchors.filter(a=>a!==node.anchor);
    }
    if(node.root && active) {
      const fullText=active.parts.join('');
      const links=active.anchors.map(a=>a.href);
      const postLinkContexts=active.anchors.map(a=>{
        const lineStart=fullText.lastIndexOf('\n',Math.max(0,a.start-1))+1;
        const after=fullText.indexOf('\n',a.end??a.start);
        const lineEnd=after<0?fullText.length:after;
        const otherLinkInLine=active.anchors.some(other=>other!==a && other.start>=lineStart && other.start<lineEnd);
        return {href:a.href,text:cleanText(a.parts.join('')),nearbyText:otherLinkInLine?'':cleanText(fullText.slice(Math.max(lineStart,a.start-250),Math.min(lineEnd,(a.end??a.start)+150)))};
      });
      const postText=cleanText(fullText);
      if(postText)posts.push({postText,postLinks:[...new Set(links)],postPermalink:links.find(url=>/\/posts\/|permalink\.php|story\.php|\/photos\/|photo\.php|\/videos\//.test(url))||null,postedAt:active.postedAt,postLinkContexts});
      active=null;
    }
  }
  // Facebook's renderer delivers ordinary escaped HTML. Parsing only text/attributes never evaluates its scripts.
  const tokens=String(html || '').match(/<!--[\s\S]*?-->|<![^>]*>|<\/?[A-Za-z][^>]*>|[^<]+|</g)||[];
  for(const token of tokens) {
    if(token.startsWith('<!--') || token.startsWith('<!'))continue;
    if(token[0]!=='<' || token==='<') {append(decodeEntities(token));continue;}
    const closing=/^<\//.test(token);
    const name=token.match(/^<\/?([\w:-]+)/)?.[1].toLowerCase();
    if(!name)continue;
    if(skipTag) {if(closing&&name===skipTag)skipTag=null;continue;}
    if(name==='script'||name==='style') {if(!closing)skipTag=name;continue;}
    if(closing) {
      let index=stack.length-1;
      while(index>=0&&stack[index].name!==name)index--;
      if(index<0)continue;
      for(let i=stack.length-1;i>=index;i--)closeNode(stack[i]);
      stack.length=index;
      if(SPACE_TAGS.has(name))append('\n');
      continue;
    }
    const attrs=attributes(token),classes=new Set((attrs.class||'').split(/\s+/));
    const root=!active&&(classes.has('_5jmm')||(classes.has('_4-u2')&&classes.has('_5pat')));
    if(root)active={parts:[],length:0,anchors:[],openAnchors:[],postedAt:null};
    if(SPACE_TAGS.has(name))append('\n');
    const node={name,root};
    if(active) {
      if(!active.postedAt && (name==='abbr'||name==='time'))active.postedAt=exactTimestamp(attrs);
      if(name==='a') {
        const href=absoluteLink(attrs.href,baseUrl);
        if(href) {node.anchor={href,parts:[],start:active.length};active.anchors.push(node.anchor);active.openAnchors.push(node.anchor);}
      }
    }
    if(!VOID_TAGS.has(name)&&!(/\/\s*>$/.test(token)))stack.push(node); else closeNode(node);
  }
  // A truncated response must not turn an unfinished article into a candidate.
  return posts.filter((post,index,all)=>all.findIndex(other=>other.postText===post.postText)===index);
}
async function fetchPublic(url,fetchImpl,headers={}) {
  for(let count=0;count<5;count++) {
    if(!isFacebookUrl(url))throw new Error('unexpected-facebook-redirect');
    const response=await fetchImpl(url,{method:'GET',headers:{...REQUEST_HEADERS,...headers},credentials:'omit',redirect:'manual',signal:AbortSignal.timeout(25000)});
    if(response.status>=300&&response.status<400) {const location=response.headers.get('location');if(!location)throw new Error('missing-redirect-location');url=new URL(location,url).href;continue;}
    if(response.status!==200)throw new Error('facebook-http-'+response.status);
    const declared=Number(response.headers.get('content-length')||0);
    if(declared>2_000_000)throw new Error('facebook-response-too-large');
    const text=await response.text();
    if(text.length>2_000_000)throw new Error('facebook-response-too-large');
    const age=Number(response.headers.get('age'));
    return {text,url,cacheStatus:response.headers.get('cf-cache-status')?.slice(0,24) || null,age:response.headers.has('age') && Number.isSafeInteger(age) && age>=0?age:null};
  }
  throw new Error('facebook-too-many-redirects');
}
export async function scanPublicPage(target,options={}) {
  const pageUrl=typeof target==='string'?target:target?.url;
  if(!isFacebookUrl(pageUrl))throw new Error('invalid-facebook-target');
  const fetchImpl=options.fetchImpl||fetch;
  const embed=new URL(options.embedHost==='web'?'https://web.facebook.com/plugins/page.php':'https://www.facebook.com/plugins/page.php');
  embed.search=new URLSearchParams({href:pageUrl,tabs:'timeline',width:'500',height:'800',hide_cover:'true',show_facepile:'false'}).toString();
  try {
    const initial=await fetchPublic(embed.href,fetchImpl);
    const config=parsePublicEmbedConfig(initial.text,pageUrl);
    if(!config)return {state:'no-timeline',postCount:0,posts:[],error:'public-embed-has-no-timeline-config'};
    const renderer=new URL('/platform/plugin/tab/renderer/',initial.url);
    const site=publicSiteData(initial.text);
    const params={key:'timeline',config_json:JSON.stringify(config),fb_dtsg_ag:'',__user:'0',__a:'1',__req:'1'};
    if(site?.client_revision)params.__rev=String(site.client_revision);
    if(site?.haste_session)params.__hs=String(site.haste_session);
    if(site?.hsi)params.__hsi=String(site.hsi);
    renderer.search=new URLSearchParams(params).toString();
    let loaded,json,rendererUrl=renderer.href;
    const visited=new Set();
    for(let redirects=0;redirects<3;redirects++){
      if(visited.has(rendererUrl))break;
      visited.add(rendererUrl);
      loaded=await fetchPublic(rendererUrl,fetchImpl,{'Accept':'application/json','X-Requested-With':'XMLHttpRequest','Referer':initial.url});
      try{json=JSON.parse(loaded.text.replace(/^\s*for\s*\(\s*;;\s*\)\s*;\s*/,''));}catch{return {state:'no-timeline',postCount:0,posts:[],error:'invalid-public-renderer-response',diagnostics:{chars:loaded.text.length,title:decodeEntities(loaded.text.match(/<title[^>]*>(.*?)<\/title>/s)?.[1] || 'none'),hostname:new URL(loaded.url).hostname,pathname:new URL(loaded.url).pathname}};}
      if(typeof json?.payload?.content?.markup?.__html==='string')break;
      const next=rendererRedirect(json,loaded.url);
      if(!next)break;
      rendererUrl=next;
    }
    const html=json?.payload?.content?.markup?.__html;
    const loginRedirect=redirectSummary(json,loaded.url).some(row=>row.destinations.some(destination=>/\/login(?:\/|\.php|$)|\/checkpoint(?:\/|$)/.test(destination.pathname || '')));
    if(typeof html!=='string' && loginRedirect)return {state:'login-required',postCount:0,posts:[],error:'facebook-public-widget-requires-login',diagnostics:{readerRevision:3,initialHostname:new URL(initial.url).hostname,rendererHostname:new URL(loaded.url).hostname,publicModuleNames:publicModules(json),redirects:redirectSummary(json,loaded.url)}};
    if(typeof html!=='string')return {state:'no-timeline',postCount:0,posts:[],error:'public-renderer-has-no-post-markup',diagnostics:{readerRevision:2,rendererChars:loaded.text.length,providerCode:Number.isSafeInteger(json?.error)?json.error:null,errorSummary:typeof json?.errorSummary==='string'?cleanText(decodeEntities(json.errorSummary)).replace(/<[^>]*>|https?:\/\/\S+/g,'').slice(0,160):null,payloadType:typeof json?.payload,contentType:typeof json?.payload?.content,hasContent:!!json?.payload?.content,hasMarkup:!!json?.payload?.content?.markup,topKeys:shapeKeys(json),payloadKeys:shapeKeys(json?.payload),initialHostname:new URL(initial.url).hostname,rendererHostname:new URL(loaded.url).hostname,initialCacheStatus:initial.cacheStatus,initialAge:initial.age,rendererCacheStatus:loaded.cacheStatus,rendererAge:loaded.age,publicModuleNames:publicModules(json),redirects:redirectSummary(json,loaded.url)}};
    const posts=parseTimelinePosts(html,config.href);
    return {state:posts.length?'ok':'no-timeline',postCount:posts.length,posts,initialChars:initial.text.length,rendererChars:loaded.text.length,configFields:Object.keys(config).sort(),...(posts.length?{}:{error:'public-timeline-has-no-posts'})};
  } catch(error) {return {state:'blocked',postCount:0,posts:[],error:String(error?.message||'public-fetch-failed').replace(/https?:\/\/\S+/g,'[url]')};}
}
