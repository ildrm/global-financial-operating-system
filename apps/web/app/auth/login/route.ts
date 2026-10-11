import { NextResponse } from 'next/server';
import * as oidc from 'openid-client';
import { oidcConfiguration, origin, seal, secureCookie } from '../../../lib/session';
export async function GET(){
  try {
    const config=await oidcConfiguration();const verifier=oidc.randomPKCECodeVerifier();
    const state=oidc.randomState();const nonce=oidc.randomNonce();
    const url=oidc.buildAuthorizationUrl(config,{redirect_uri:origin()+'/auth/callback',scope:'openid profile',state,nonce,code_challenge:await oidc.calculatePKCECodeChallenge(verifier),code_challenge_method:'S256'});
    const response=NextResponse.redirect(url);response.cookies.set('gfos_login',await seal({verifier,state,nonce},600),{...secureCookie,maxAge:600});
    return response;
  }catch{return NextResponse.json({code:'AUTH_NOT_CONFIGURED',detail:'The identity provider must be configured before sign-in.'},{status:503});}
}
