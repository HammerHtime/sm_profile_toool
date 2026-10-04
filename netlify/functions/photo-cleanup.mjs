import { store } from './photo-session-lib.mjs';
export async function handler(){
  const s=store();let cursor;let deleted=0;
  do{
    const page=await s.list({prefix:'sessions/',cursor});
    for(const blob of page.blobs||[]){
      try{const record=await s.get(blob.key,{type:'json',consistency:'strong'});if(!record?.expiresAt||Date.parse(record.expiresAt)<=Date.now()){await s.delete(blob.key);deleted++;}}catch{}
    }
    cursor=page.hasMore?page.cursor:undefined;
  }while(cursor);
  return {statusCode:200,body:JSON.stringify({deleted})};
}
export const config={schedule:'@hourly'};
