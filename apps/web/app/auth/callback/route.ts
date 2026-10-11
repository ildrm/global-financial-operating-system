import { cookies } from 'next/headers';
import { NextRequest,NextResponse } from 'next/server';
import * as oidc from 'openid-client';
import { oidcConfiguration, origin, unseal, seal, secureCookie } from '../../../lib/session';
export async function GET(request:NextRequest){
  try {
    const value=(await cookies()).get('gfos_login')?.value;if(!value)throw new Error('Login expired.');
    const pending=await unseal(value);
    const verifier=pending['verifier'],state=pending['state'],nonce=pending['nonce'];
    if(typeof verifier!=='string'||typeof state!=='string'||typeof nonce!=='string')throw new Error('Invalid login.');
    const config=await oidcConfiguration();
    const current=new URL('/auth/callback'+request.nextUrl.search,origin());
    const tokens=await oidc.authorizationCodeGrant(config,current,{pkceCodeVerifier:verifier,expectedState:state,expectedNonce:nonce,idTokenExpected:true});
    const response=NextResponse.redirect(new URL('/en',origin()));
    response.cookies.delete('gfos_login');
    response.cookies.set('gfos_session',await seal({accessToken:tokens.access_token},Math.min(tokens.expires_in ?? 300,3600)),{...secureCookie,maxAge:Math.min(tokens.expires_in ?? 300,3600)});
    return response;
  }catch{return NextResponse.json({code:'LOGIN_FAILED',detail:'Sign-in failed or expired. Start sign-in again.'},{status:401});}
}
