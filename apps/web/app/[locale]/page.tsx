import { notFound } from 'next/navigation';
import { Dashboard } from '../../components/dashboard';
export default async function Page({params}:{params:Promise<{locale:string}>}){const {locale}=await params;if(locale!=='en' && locale!=='fa')notFound();return <Dashboard locale={locale}/>;}
