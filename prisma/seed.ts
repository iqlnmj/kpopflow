import 'dotenv/config';
import { db } from '../src/lib/db';
const samples=[['demo-roots','K-Pop Might Be Returning to Its Roots','K-Pop','Music commentary','Eksplorasi apakah format lagu K-pop berubah. DEMO: verifikasi tren dengan data resmi sebelum dipakai.'],['demo-yujin','IVE Yujin Teleportation Fancam','IVE / Yujin','Visual mystery','DEMO research lead: analisis ilusi pergerakan pada fancam. Sumber dan footage belum disediakan.'],['demo-tarzzan','ALLDAY PROJECT Tarzzan Crowd Surfing','ALLDAY PROJECT / Tarzzan','Unexpected moment','DEMO research lead: tinjau konteks momen crowd surfing. Kejadian belum diverifikasi.']];
async function main(){for(const [id,title,artist,category,topic] of samples)await db.project.upsert({where:{id},update:{},create:{id,title,artist,category,topic,demo:true,events:{create:{action:'seed',detail:'DEMO project; tidak ada video asli atau fakta terverifikasi.'}}}});await db.$disconnect();}
void main();
