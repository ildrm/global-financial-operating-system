import type { NextConfig } from 'next';
const config:NextConfig={
  transpilePackages:['@gfos/contracts','@gfos/localization','@gfos/financial-math'],
  poweredByHeader:false,
  devIndicators:false,
  distDir:process.env.NODE_ENV==='production'?'.next-production':'.next',
  async headers(){return [{source:'/(.*)',headers:[
    {key:'X-Content-Type-Options',value:'nosniff'},
    {key:'Referrer-Policy',value:'same-origin'},
    {key:'X-Frame-Options',value:'DENY'},
    {key:'Cache-Control',value:'no-store'},
    {key:'Content-Security-Policy',value:"default-src 'self'; script-src 'self' 'unsafe-inline'"+(process.env.NODE_ENV==='development'?" 'unsafe-eval'":"")+"; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"},
  ]}];}
};export default config;
