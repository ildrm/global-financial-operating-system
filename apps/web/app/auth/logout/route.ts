import { NextRequest,NextResponse } from 'next/server';
import { origin } from '../../../lib/session';
export async function POST(request:NextRequest){
  if(request.headers.get('origin')!==origin())return NextResponse.json({code:'ORIGIN_DENIED'},{status:403});
  const response=NextResponse.redirect(new URL('/en',origin()),303);response.cookies.delete('gfos_session');
  response.headers.set('Clear-Site-Data','"cache", "storage"');return response;
}
