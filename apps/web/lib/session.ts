import 'server-only';
import { cookies } from 'next/headers';
import { EncryptJWT, jwtDecrypt } from 'jose';
import * as oidc from 'openid-client';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const envFile=fileURLToPath(new URL('../../../.env',import.meta.url));
if(existsSync(envFile))process.loadEnvFile(envFile);
export function demoEnabled(){return process.env.GFOS_DEMO==='true' && process.env.NODE_ENV!=='production';}
function key(){
  const secret=process.env.SESSION_SECRET;
  if(!secret || secret.length!==64 || !/^[a-f0-9]+$/.test(secret)) throw new Error('A 32-byte SESSION_SECRET is required.');
  return new Uint8Array(Buffer.from(secret,'hex'));
}
export async function seal(payload:Record<string,string>,seconds:number){
  return new EncryptJWT(payload).setProtectedHeader({alg:'dir',enc:'A256GCM'}).setIssuedAt().setExpirationTime(Math.floor(Date.now()/1000)+seconds).encrypt(key());
}
export async function unseal(value:string):Promise<Record<string,unknown>>{
  return (await jwtDecrypt(value,key(),{keyManagementAlgorithms:['dir'],contentEncryptionAlgorithms:['A256GCM']})).payload;
}
export async function accessToken():Promise<string|null>{
  if(demoEnabled())return process.env.DEMO_API_TOKEN ?? null;
  const value=(await cookies()).get('gfos_session')?.value;
  if(!value)return null;
  try {const session=await unseal(value);return typeof session['accessToken']==='string'?session['accessToken']:null;}catch{return null;}
}
export async function oidcConfiguration(){
  const issuer=process.env.OIDC_ISSUER;const clientId=process.env.OIDC_CLIENT_ID;const secret=process.env.OIDC_CLIENT_SECRET;
  if(!issuer || !clientId || !secret)throw new Error('OIDC is not configured.');
  return oidc.discovery(new URL(issuer),clientId,{client_secret:secret},oidc.ClientSecretPost(secret));
}
export function origin(){return process.env.WEB_ORIGIN ?? 'http://localhost:3000';}
export const secureCookie={httpOnly:true,sameSite:'lax' as const,secure:process.env.NODE_ENV==='production',path:'/'};

