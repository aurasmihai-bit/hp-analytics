'use client'
import { useState } from 'react'
import { C, sum, avg, dlt, fmt, fmtN, Delta, KPI, Signal, Action, Sec, Grid, Card, LineChart, BarChart, PageLink } from './components'
import { CONV_DEFINITIONS, CATEGORIES, CERERE_PAGES } from './conversions_config'

/* ─── RECOMANDARI ──────────────────────────────────────────────────── */
function TabRecomandari({ data }) {
  const curr=data.traffic.current, pages=data.pages.current
  const totalSess=sum(curr,'sessions'), totalConv=sum(curr,'conversions')
  const social=curr.find(r=>r.session_default_channel_group==='Organic Social')
  const organic=curr.find(r=>r.session_default_channel_group==='Organic Search')
  const direct=curr.find(r=>r.session_default_channel_group==='Direct')
  const socialConvR=social&&social.sessions>0?social.conversions/social.sessions*100:0
  const organicConvR=organic&&organic.sessions>0?organic.conversions/organic.sessions*100:0
  const directConvR=direct&&direct.sessions>0?direct.conversions/direct.sessions*100:0
  const h3=pages.find(p=>p.page_path==='/home3')
  const hp=pages.find(p=>p.page_path==='/')
  const simp=pages.find(p=>p.page_path==='/simplu')
  const cereri=pages.find(p=>p.page_path==='/cereri')
  const ceNou=pages.find(p=>p.page_path==='/cerere-noua')
  const vreau=pages.find(p=>p.page_path==='/vreau')
  const proprietati=pages.find(p=>p.page_path==='/proprietati')
  const scorCump=pages.find(p=>p.page_path==='/scor-cumparator')
  const cereriNou=pages.find(p=>p.page_path==='/cereri/nou')
  const h3r=h3&&h3.screen_page_views>0?h3.conversions/h3.screen_page_views*100:0
  const hpr=hp&&hp.screen_page_views>0?hp.conversions/hp.screen_page_views*100:0
  const simpr=simp&&simp.screen_page_views>0?simp.conversions/simp.screen_page_views*100:0
  const vreauR=vreau&&vreau.screen_page_views>0?vreau.conversions/vreau.screen_page_views*100:0
  const cereriViews=cereri?.screen_page_views||0
  const ceNouViews=ceNou?.screen_page_views||0
  const vreauViews=vreau?.screen_page_views||0
  const cereriNouViews=cereriNou?.screen_page_views||0
  const totalFormViews=ceNouViews+vreauViews+cereriNouViews
  const funnelRate=cereriViews>0?totalFormViews/cereriViews*100:0
  const gscClicks=sum(data.gsc.current,'organic_google_search_clicks')
  const gscImpr=sum(data.gsc.current,'organic_google_search_impressions')
  const gscCtr=gscImpr>0?gscClicks/gscImpr*100:0
  const queries=data.gsc.queries||[]
  const nearTop=queries.filter(q=>(q.organic_google_search_average_position||0)>=4&&(q.organic_google_search_average_position||0)<=10)
  // Conversii custom
  const tracking=data.cerereTracking||[]
  const totalCereriNoi=tracking.reduce((s,d)=>s+(d.conversions_bravo_cerere_noua||0),0)
  const totalCump=tracking.reduce((s,d)=>s+(d.conversions_bun_venit_cumparator||0),0)
  const totalProp=tracking.reduce((s,d)=>s+(d.conversions_bun_venit_proprietar||0),0)
  const cereriConvRate=totalCump>0?(totalCereriNoi/totalCump*100).toFixed(0):null
  // Gap homepage vs home3 — s-a micsorat
  const homepageGap=h3r-hpr
  const homepageGapReduced=homepageGap < 1.5

  return (
    <div>
      {/* Header */}
      <div style={{background:'linear-gradient(135deg,#1A2B4A 0%,#2d4a7a 100%)',borderRadius:12,padding:'20px 24px',marginBottom:24,color:'#fff'}}>
        <p style={{fontSize:11,textTransform:'uppercase',letterSpacing:'.08em',color:'rgba(255,255,255,.6)',margin:'0 0 4px'}}>Actualizat saptamanal — date reale GA4</p>
        <h2 style={{fontSize:18,fontWeight:500,margin:'0 0 6px'}}>Recomandari si prioritati</h2>
        <p style={{fontSize:13,color:'rgba(255,255,255,.7)',margin:0}}>
          {fmtN(totalSess)} sesiuni · Conv rate: {totalSess>0?(totalConv/totalSess*100).toFixed(1):'0'}% · {totalCereriNoi} cereri noi adaugate (tracking activ)
        </p>
      </div>

      {/* UPDATE: /vreau este acum cel mai bun formular */}
      <Sec title="Ce s-a schimbat fata de saptamana trecuta">
        {vreauR > 3 && (
          <Signal type="positive"
            title={`/vreau — ${vreauR.toFixed(1)}% conv rate — cel mai eficient formular de cerere`}
            body={`/vreau: ${vreauR.toFixed(1)}% vs /cerere-noua: ${(ceNou&&ceNou.screen_page_views>0?ceNou.conversions/ceNou.screen_page_views*100:0).toFixed(1)}%. Redirecteaza traficul spre /vreau sau copiaza structura sa pe /cerere-noua.`}
            tag="NOU"
          />
        )}
        {homepageGapReduced ? (
          <Signal type="positive"
            title={`Homepage / si /home3 au conv rate aproape identic (${hpr.toFixed(1)}% vs ${h3r.toFixed(1)}%)`}
            body={`Gap-ul s-a redus semnificativ. Homepage / are acum ${hpr.toFixed(1)}% conv rate — aproape de /home3 (${h3r.toFixed(1)}%). Probabil s-au aplicat imbunatatiri pe /. Monitorizare in continuare recomandata dar nu mai e urgenta schimbarea.`}
          />
        ) : (
          <Signal type="neutral"
            title={`/home3 (${h3r.toFixed(1)}%) inca mai bun decat homepage (${hpr.toFixed(1)}%)`}
            body="Gap s-a micsorat dar exista inca potential. Continua optimizarea homepage-ului."
          />
        )}
        {cereriNou && (cereriNou.conversions||0) === 0 && (cereriNou.screen_page_views||0) > 20 && (
          <Signal type="negative"
            title={`/cereri/nou: ${fmtN(cereriNouViews)} views, ${Math.round(cereriNou.average_session_duration||0)}s, 0 conversii — tracking inca broken`}
            body="Problema persista din saptamana trecuta. Key Event nesetat sau redirect fara event. Prioritate maxima — pierdere de date."
          />
        )}
        {totalProp > 40 && (
          <Signal type="neutral"
            title={`Segment proprietari activ — ${totalProp} inregistrari luna aceasta`}
            body="Spike de 42 pe 28 apr posibil import de date sau test. Verifica daca e organic sau artificial. Daca e real, segmentul proprietari creste — merita o pagina de onboarding dedicata."
          />
        )}
      </Sec>

      {/* Canale */}
      <Sec title="Canale — oportunitate imediata">
        <Signal type="info" tag="PRIORITATE"
          title={`Organic Social: ${socialConvR.toFixed(1)}% conv rate — cel mai eficient canal per sesiune`}
          body={`Social: ${socialConvR.toFixed(1)}% vs Direct: ${directConvR.toFixed(1)}% vs Search: ${organicConvR.toFixed(1)}%. Cu ${fmtN(social?.sessions||0)} sesiuni si ${socialConvR.toFixed(1)}% conv rate, Social e canalul tau cu cel mai mare ROI. Fiecare sesiune din social valoreaza de ${(socialConvR/directConvR).toFixed(1)}x mai mult decat Direct.`}
        />
        <Signal type="info" tag="SEO"
          title={`Organic Search: ${organicConvR.toFixed(1)}% conv rate dar pozitie medie 83 — potential enorm neexploatat`}
          body={`Searchul organic converteste cel mai bine dar genereaza doar ${Math.round((organic?.sessions||0)/totalSess*100)}% din trafic. Pozitia medie 83 inseamna ca HomePitch inca nu e indexat pe queries relevante. Contentul targetat poate schimba asta in 3-6 luni.`}
        />
      </Sec>

      {/* Funnel cerere */}
      <Sec title="Funnel cerere noua — status actual">
        <div style={{background:'#F0FDF4',border:'0.5px solid #86EFAC',borderRadius:12,padding:'16px 20px',marginBottom:12}}>
          <div style={{display:'flex',gap:16,marginBottom:12,flexWrap:'wrap'}}>
            {[
              {label:'/cereri vizitat',val:fmtN(cereriViews),sub:'useri pe lista'},
              {label:'→ formulare',val:fmtN(totalFormViews),sub:`${funnelRate.toFixed(0)}% progresie`},
              {label:'Cereri noi trackate',val:totalCereriNoi,sub:'din 28 apr',bold:true},
              {label:'/vreau conv rate',val:`${vreauR.toFixed(1)}%`,sub:'cel mai bun',green:true},
            ].map(i=>(
              <div key={i.label} style={{flex:1,minWidth:90}}>
                <p style={{fontSize:22,fontWeight:500,color:i.green?C.green:C.text,margin:'0 0 2px'}}>{i.val}</p>
                <p style={{fontSize:11,color:C.hint,margin:'0 0 1px'}}>{i.label}</p>
                <p style={{fontSize:11,color:C.muted,margin:0}}>{i.sub}</p>
              </div>
            ))}
          </div>
          {cereriConvRate && <p style={{fontSize:13,color:C.green,margin:0,fontWeight:500}}>
            {cereriConvRate}% din cumparatorii inregistrati adauga o cerere. Target: 80%+.
          </p>}
        </div>
        <Signal type="negative"
          title="/cereri/nou: 0 conversii trackate — Key Event inca nesetat"
          body={`${fmtN(cereriNouViews)} views, ${Math.round(cereriNou?.average_session_duration||0)}s pe formular si zero conversii GA4. Aceasta e o gaura neagra in date — nu stii cate cereri vin pe aceasta ruta. Fix in 5 minute.`}
        />
        <Signal type="positive"
          title="/vreau functioneaza — cel mai bun formular de cerere"
          body={`${vreauR.toFixed(1)}% conv rate cu ${fmtN(vreauViews)} views. Structura sa (simplu, rapid) este modelul pe care trebuie sa-l replicati pe /cerere-noua si /cereri/nou.`}
        />
      </Sec>

      {/* Oportunitate noua: /proprietati */}
      <Sec title="Oportunitate noua identificata — /proprietati">
        <Signal type="negative"
          title={`/proprietati: ${fmtN(proprietati?.screen_page_views||0)} views, 0 conversii, ${Math.round((proprietati?.bounce_rate||0)*100)}% bounce`}
          body={`A doua pagina ca trafic dupa /cereri dar cu 0 conversii si cel mai mare bounce rate din top 10 pagini (${Math.round((proprietati?.bounce_rate||0)*100)}%). Userii ajung pe pagina dar nu stiu ce sa faca. Lipseste un CTA clar — fie sa publice o proprietate (agent/proprietar), fie sa vada cereri (cumparator).`}
        />
        {scorCump && (
          <Signal type="info"
            title={`/scor-cumparator: ${Math.round(scorCump?.average_session_duration||0)}s pe pagina — potential upsell VIP`}
            body={`Userii care isi verifica scorul sunt cei mai angajati din platforma. ${Math.round(scorCump?.average_session_duration||0)}s medie si ${(scorCump.conversions/Math.max(scorCump.screen_page_views,1)*100).toFixed(1)}% conv rate. Momentul ideal pentru a prezenta beneficiile planului VIP.`}
          />
        )}
      </Sec>

      {/* Actiuni cu estimare impact */}
      <Sec title="Actiuni concrete recomandate">
        <Action urgency="urgent" impact="5 min" title="Fix Key Event pe /cereri/nou"
          body={`${fmtN(cereriNouViews)} views si ${Math.round(cereriNou?.average_session_duration||0)}s pe formular dar 0 conversii GA4. Persista din saptamana trecuta.`}
          fix="Adauga gtag('event', 'conversions_bravo_cerere_noua') la submit reusit pe /cereri/nou. Verifica in GA4 DebugView ca se triggereaza."/>
        <Action urgency="urgent" impact="Impact: mare" title="Adauga CTA inline pe /cereri dupa randul 2"
          body={`${fmtN(cereriViews)} views pe /cereri dar doar ${funnelRate.toFixed(0)}% ajung la formulare. Un card CTA dupa al 4-lea rezultat (pozitia 5 in grid) e cel mai rapid fix — nu modifica layout-ul existent.`}
          fix="Insereaza un card dark (aceeasi dimensiune cu cardurile de cereri) dupa pozitia 4 din grid cu textul: 'Nu gasesti ce cauti? Descrie ce vrei — agentii activi iti trimit oferte in 24h'. Ascunde pentru agentii logati."/>
        <Action urgency="urgent" impact="Impact: mare" title="Adauga CTA pe /proprietati — 729 views, 0 conversii"
          body={`/proprietati e a doua pagina ca trafic cu ${fmtN(proprietati?.screen_page_views||0)} views si ${Math.round((proprietati?.bounce_rate||0)*100)}% bounce dar zero conversii. Pagina nu are niciun CTA activ.`}
          fix="Adauga doua CTA-uri conditionate pe tip user: Agent/Proprietar -> 'Publica o proprietate' -> /proprietati/nou. Cumparator -> 'Adauga o cerere si primesti oferte' -> /vreau. Estimare: +50-100 conversii/luna."/>
        <Action urgency="important" impact="Impact: mediu" title="Redirecteaza traficul spre /vreau in loc de /cerere-noua"
          body={`/vreau are ${vreauR.toFixed(1)}% conv rate vs ${(ceNou&&ceNou.screen_page_views>0?ceNou.conversions/ceNou.screen_page_views*100:0).toFixed(1)}% pe /cerere-noua. Acelasi obiectiv, de 5x mai eficient.`}
          fix="Testeaza redirect soft: pe butonul '+ Cerere noua' din /cereri, linkuieste spre /vreau in loc de /cerere-noua. Masoara conv rate timp de 14 zile."/>
        <Action urgency="important" impact="Impact: mediu" title="Dubleaza frecventa postari Social Media"
          body={`Social: ${socialConvR.toFixed(1)}% conv rate cu ${fmtN(social?.sessions||0)} sesiuni. Cel mai bun ROI pe conversii. Fiecare sesiune din social valoreaza de ${(socialConvR/Math.max(directConvR,1)).toFixed(1)}x mai mult decat Direct.`}
          fix="1 post/zi pe canalul principal. Adauga UTM parameters: ?utm_source=instagram&utm_medium=social&utm_campaign=cereri pentru tracking precis. Verifica in GA4 ce tipuri de continut aduc trafic care converteste."/>
        <Action urgency="seo" impact="Impact: termen lung" title="Creeaza continut SEO pentru queries cu volum mare"
          body="Pozitia medie 83 inseamna ca HomePitch nu apare pe queries relevante. Nu exista continut optimizat pentru cum cauta oamenii proprietati sau agenti imobiliari in Romania."
          fix="Prioritate 1: pagini de tip 'apartamente de vanzare [oras]' si 'agenti imobiliari [oras]'. Prioritate 2: ghiduri pentru cumparatori ('cum sa gasesti un apartament in Bucuresti'). Fiecare pagina de continut bine optimizata aduce trafic pasiv pe termen lung."/>
      </Sec>

      {/* Impact estimat */}
      <Sec title="Estimare impact — luna urmatoare">
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:10}}>
          {[
            {label:'Fix /cereri/nou tracking',est:'date complete in 7 zile',col:C.red},
            {label:'CTA pe /cereri',est:`+${Math.round(cereriViews*0.08)} cereri/luna`,col:C.amber},
            {label:'CTA pe /proprietati',est:'+50-100 conv/luna',col:C.blue},
            {label:'Social x2',est:`+${fmtN(Math.round(social?.sessions||0*0.8))} sesiuni/luna`,col:C.green},
            {label:'Redirect spre /vreau',est:`+${Math.round(ceNouViews*(vreauR/100-0.008))} cereri/luna`,col:C.purple},
          ].map(i=>(
            <div key={i.label} style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:10,padding:'12px 14px'}}>
              <p style={{fontSize:11,color:C.hint,margin:'0 0 4px'}}>{i.label}</p>
              <p style={{fontSize:13,fontWeight:500,color:i.col,margin:0}}>{i.est}</p>
            </div>
          ))}
        </div>
      </Sec>
    </div>
  )
}

/* ─── CERERE NOUA — COMPARATIE ─────────────────────────────────────── */
function TabCerereNoua({ data }) {
  const pages = data.pages.current
  const cp = data.cererePages || {}
  const daily = cp.daily || {}
  const byCh  = cp.byChannel || {}

  // Aggregate totals for each path
  const paths = CERERE_PAGES.map(p => {
    const pg = pages.find(x => x.page_path === p.path)
    const d  = {
      cerereNoua: daily.cerereNoua || [],
      cereriNou:  daily.cereriNou  || [],
      vreau:      daily.vreau      || [],
    }[p.path === '/cerere-noua' ? 'cerereNoua' : p.path === '/cereri/nou' ? 'cereriNou' : 'vreau']
    const ch = {
      cerereNoua: byCh.cerereNoua || [],
      cereriNou:  byCh.cereriNou  || [],
      vreau:      byCh.vreau      || [],
    }[p.path === '/cerere-noua' ? 'cerereNoua' : p.path === '/cereri/nou' ? 'cereriNou' : 'vreau']
    const views = pg?.screen_page_views || sum(d,'screen_page_views')
    const conv  = pg?.conversions       || sum(d,'conversions')
    const eng   = pg?.engagement_rate   || 0
    const dur   = pg?.average_session_duration || 0
    const users = pg?.active_users || 0
    const convRate = views > 0 ? conv/views*100 : 0
    return { ...p, views, conv, eng, dur, users, convRate, daily: d, byChannel: ch }
  })

  const maxViews = Math.max(...paths.map(p=>p.views), 1)
  const totalViews = paths.reduce((s,p)=>s+p.views, 0)
  const totalConv  = paths.reduce((s,p)=>s+p.conv, 0)

  // Build unified daily chart — align dates
  const allDates = [...new Set([
    ...paths[0].daily.map(d=>d.date),
    ...paths[1].daily.map(d=>d.date),
    ...paths[2].daily.map(d=>d.date),
  ])].sort()

  const chartData = allDates.map(date => {
    const row = { date }
    paths.forEach((p,i) => {
      const key = ['cerereNoua','cereriNou','vreau'][i]
      const found = p.daily.find(d=>d.date===date)
      row[`views_${i}`]  = found?.screen_page_views || 0
      row[`conv_${i}`]   = found?.conversions       || 0
    })
    return row
  })

  const [chartMode, setChartMode] = useState('views')

  return (
    <div>
      {/* Intro */}
      <div style={{background:'linear-gradient(135deg,#1A2B4A,#2d4a7a)',borderRadius:12,padding:'16px 20px',marginBottom:20,color:'#fff'}}>
        <p style={{fontSize:11,textTransform:'uppercase',letterSpacing:'.08em',color:'rgba(255,255,255,.5)',margin:'0 0 4px'}}>Analiza comparativa</p>
        <h2 style={{fontSize:16,fontWeight:500,margin:'0 0 4px'}}>Analiza LP cereri — 3 rute pentru cerere noua</h2>
        <p style={{fontSize:13,color:'rgba(255,255,255,.65)',margin:0}}>
          {fmtN(totalViews)} vizite totale · {fmtN(totalConv)} conversii GA4 · conv rate combinat {totalViews>0?(totalConv/totalViews*100).toFixed(1):0}%
        </p>
      </div>

      {/* KPI cards per path */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:20}}>
        {paths.map((p,i) => (
          <div key={p.path} style={{
            background:C.card,border:`2px solid ${p.color}22`,borderRadius:12,
            padding:'14px 16px',position:'relative',overflow:'hidden'
          }}>
            <div style={{position:'absolute',top:0,left:0,right:0,height:3,background:p.color,borderRadius:'12px 12px 0 0'}}/>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
              <PageLink path={p.path} style={{fontFamily:'monospace',fontSize:13,fontWeight:600,color:p.color}}>
                /{p.label}
              </PageLink>
              {p.convRate === Math.max(...paths.map(x=>x.convRate)) && p.convRate > 0 && (
                <span style={{fontSize:10,fontWeight:500,padding:'1px 6px',borderRadius:99,background:'#F0FDF4',color:C.green}}>best</span>
              )}
            </div>
            <p style={{fontSize:11,color:C.hint,margin:'0 0 10px',lineHeight:1.4}}>{p.description}</p>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
              {[
                {l:'Views',v:fmtN(p.views)},
                {l:'Useri unici',v:fmtN(p.users)},
                {l:'Conversii GA4',v:fmtN(p.conv),bold:true,col:p.conv>0?C.green:C.hint},
                {l:'Conv rate',v:p.convRate.toFixed(2)+'%',bold:true,col:p.convRate>2?C.green:p.convRate>0?C.amber:C.red},
                {l:'Engagement',v:Math.round(p.eng*100)+'%',col:p.eng>0.9?C.green:p.eng>0.7?C.amber:C.red},
                {l:'Durata medie',v:Math.round(p.dur)+'s'},
              ].map(m=>(
                <div key={m.l}>
                  <p style={{fontSize:10,color:C.hint,margin:'0 0 1px',textTransform:'uppercase',letterSpacing:'.04em'}}>{m.l}</p>
                  <p style={{fontSize:14,fontWeight:m.bold?600:400,color:m.col||C.text,margin:0}}>{m.v}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Visual comparison bar */}
      <Sec title="Comparatie vizuala — volum si eficienta">
        <Card style={{padding:'16px 20px'}}>
          {paths.map((p,i) => {
            const pct = p.views/maxViews*100
            const share = totalViews > 0 ? p.views/totalViews*100 : 0
            return (
              <div key={p.path} style={{marginBottom:16}}>
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:5}}>
                  <div style={{width:10,height:10,borderRadius:'50%',background:p.color,flexShrink:0}}/>
                  <PageLink path={p.path} style={{fontSize:12,fontFamily:'monospace',fontWeight:500,color:p.color}}>/{p.label}</PageLink>
                  <span style={{fontSize:11,color:C.hint}}>{share.toFixed(0)}% din trafic</span>
                  <div style={{flex:1}}/>
                  <span style={{fontSize:12,fontWeight:500,color:p.convRate>2?C.green:p.convRate>0?C.amber:C.red}}>
                    {p.convRate.toFixed(2)}% conv rate
                  </span>
                </div>
                {/* Views bar */}
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                  <span style={{fontSize:10,color:C.hint,width:56,flexShrink:0}}>Views</span>
                  <div style={{flex:1,background:'#ebebE4',borderRadius:99,height:8,overflow:'hidden'}}>
                    <div style={{width:`${pct}%`,height:8,background:p.color,borderRadius:99,opacity:.7}}/>
                  </div>
                  <span style={{fontSize:11,color:C.muted,width:36,textAlign:'right'}}>{fmtN(p.views)}</span>
                </div>
                {/* Conv bar (scaled to 10% max) */}
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <span style={{fontSize:10,color:C.hint,width:56,flexShrink:0}}>Conv GA4</span>
                  <div style={{flex:1,background:'#ebebE4',borderRadius:99,height:8,overflow:'hidden'}}>
                    <div style={{width:`${Math.min(p.convRate*5,100)}%`,height:8,background:p.conv>0?C.green:C.border,borderRadius:99}}/>
                  </div>
                  <span style={{fontSize:11,color:p.conv>0?C.green:C.hint,width:36,textAlign:'right',fontWeight:p.conv>0?500:400}}>{p.conv}</span>
                </div>
              </div>
            )
          })}
        </Card>
      </Sec>

      {/* Daily chart */}
      <Sec title="Evolutie zilnica"
        right={
          <div style={{display:'flex',gap:4}}>
            {[['views','Views'],['conv','Conversii']].map(([v,l])=>(
              <button key={v} onClick={()=>setChartMode(v)} style={{
                padding:'3px 10px',fontSize:11,borderRadius:6,cursor:'pointer',
                border:`0.5px solid ${chartMode===v?C.blue:C.border}`,
                background:chartMode===v?'#EBF4FC':'transparent',
                color:chartMode===v?C.blue:C.muted,fontWeight:chartMode===v?500:400
              }}>{l}</button>
            ))}
          </div>
        }>
        <Card>
          <LineChart
            data={chartData}
            metrics={paths.map((p,i)=>({
              field: `${chartMode}_${i}`,
              label: '/'+p.label,
              color: p.color,
            }))}
            height={200}
          />
        </Card>
      </Sec>

      {/* By channel */}
      <Sec title="Trafic per canal — de unde vin userii pe fiecare pagina">
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
          {paths.map((p,i) => (
            <div key={p.path}>
              <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:8}}>
                <div style={{width:8,height:8,borderRadius:'50%',background:p.color}}/>
                <PageLink path={p.path} style={{fontSize:12,fontFamily:'monospace',fontWeight:500,color:p.color}}>/{p.label}</PageLink>
              </div>
              {p.byChannel.length === 0 ? (
                <p style={{fontSize:12,color:C.hint}}>Nu exista date</p>
              ) : (
                [...p.byChannel].sort((a,b)=>(b.screen_page_views||0)-(a.screen_page_views||0)).map(ch=>{
                  const pct = p.views>0?ch.screen_page_views/p.views*100:0
                  const chConvRate = ch.screen_page_views>0?ch.conversions/ch.screen_page_views*100:0
                  return (
                    <div key={ch.session_default_channel_group} style={{marginBottom:8}}>
                      <div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}>
                        <span style={{fontSize:11,color:C.text}}>{ch.session_default_channel_group}</span>
                        <span style={{fontSize:11,color:C.muted}}>{fmtN(ch.screen_page_views)} ({pct.toFixed(0)}%)</span>
                      </div>
                      <div style={{background:'#ebebE4',borderRadius:99,height:5,overflow:'hidden',marginBottom:2}}>
                        <div style={{width:`${pct}%`,height:5,background:p.color,borderRadius:99,opacity:.7}}/>
                      </div>
                      {ch.conversions > 0 && (
                        <p style={{fontSize:10,color:C.green,margin:0,fontWeight:500}}>{ch.conversions} conv · {chConvRate.toFixed(1)}% rate</p>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          ))}
        </div>
      </Sec>

      {/* Insights */}
      <Sec title="Observatii si recomandari">
        <Signal type={paths[2].convRate > paths[0].convRate ? 'positive' : 'neutral'}
          title={`/vreau are ${paths[2].convRate.toFixed(2)}% conv rate — ${paths[2].convRate > paths[0].convRate ? 'cel mai eficient' : 'sub asteptari'}`}
          body={`Cu ${fmtN(paths[2].views)} views si ${paths[2].conv} conversii, /vreau are cel mai bun raport. Dar volumul e mic — ${fmtN(paths[0].views)} views pe /cerere-noua vs ${fmtN(paths[2].views)} pe /vreau. Redirectand mai mult trafic spre /vreau ai putea creste conv rate combinat.`}
        />
        {paths[1].conv === 0 && (
          <Signal type="negative"
            title={`/cereri/nou — ${fmtN(paths[1].views)} views, 0 conversii GA4`}
            body="Aceasta pagina primeste trafic dar nu genereaza conversii trackate. Fie Key Event-ul nu e configurat pentru aceasta ruta, fie formularul are o problema tehnica. Verifica in GA4 daca evenimentul bravo_cerere_noua se triggereaza si de pe /cereri/nou."
          />
        )}
        <Signal type="info"
          title="Traficul combinat: 3 rute diferite pentru acelasi flux"
          body={`${fmtN(totalViews)} vizite totale pe cele 3 rute de cerere noua. Consolidarea intr-o singura ruta cu redirect 301 de pe /cerere-noua si /cereri/nou catre /vreau (cel mai eficient) ar putea imbunatati conv rate general si simplifica tracking-ul.`}
        />
      </Sec>
    </div>
  )
}

/* ─── CONVERSII CONFIG ─────────────────────────────────────────────── */
function TabConversii({ data }) {
  const pages = data.pages.current
  const traffic = data.traffic.current

  // State: which conversions are active
  const initActive = () => {
    const s = {}
    CONV_DEFINITIONS.forEach(c => { s[c.id] = c.defaultOn })
    return s
  }
  const [active, setActive] = useState(initActive)
  const [catFilter, setCatFilter] = useState('Toate')

  const toggle = id => setActive(prev => ({ ...prev, [id]: !prev[id] }))
  const toggleAll = on => { const s = {}; CONV_DEFINITIONS.forEach(c => { s[c.id] = on }); setActive(s) }

  // Compute totals for each conversion
  const getVal = conv => {
    if (conv.isPageView) {
      const p = pages.find(pg => pg.page_path === conv.page)
      return p ? Math.round(p.screen_page_views || 0) : 0
    }
    const field = conv.id
    return Math.round(data.conversions.reduce((s,r) => s+(r[field]||0), 0))
  }

  // Weighted conversion score (active only)
  const totalScore = CONV_DEFINITIONS
    .filter(c => active[c.id])
    .reduce((s, c) => s + getVal(c) * c.value, 0)

  const activeConvs = CONV_DEFINITIONS.filter(c => active[c.id])
  const totalConvCount = activeConvs.reduce((s,c) => s + getVal(c), 0)

  const totalSess = sum(traffic, 'sessions')
  const weightedRate = totalSess > 0 ? totalScore / totalSess : 0

  const filtered = CONV_DEFINITIONS.filter(c => catFilter === 'Toate' || c.category === catFilter)

  const catColors = {
    'Inregistrare': C.blue, 'Cereri': C.amber, 'Oferte': C.green,
    'Proprietati': C.purple, 'Engagement': C.teal, 'CRM': C.gray, 'Monetizare': C.red
  }

  return (
    <div>
      {/* Header stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:8,marginBottom:20}}>
        <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:10,padding:'14px 16px'}}>
          <p style={{fontSize:11,color:C.hint,margin:'0 0 4px',textTransform:'uppercase',letterSpacing:'.05em'}}>Conversii active</p>
          <p style={{fontSize:22,fontWeight:500,color:C.text,margin:0}}>{totalConvCount.toLocaleString('ro')}</p>
          <p style={{fontSize:11,color:C.hint,margin:'3px 0 0'}}>{activeConvs.length} tipuri activate</p>
        </div>
        <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:10,padding:'14px 16px'}}>
          <p style={{fontSize:11,color:C.hint,margin:'0 0 4px',textTransform:'uppercase',letterSpacing:'.05em'}}>Scor ponderat</p>
          <p style={{fontSize:22,fontWeight:500,color:C.text,margin:0}}>{totalScore.toLocaleString('ro')}</p>
          <p style={{fontSize:11,color:C.hint,margin:'3px 0 0'}}>valoare x frecventa</p>
        </div>
        <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:10,padding:'14px 16px'}}>
          <p style={{fontSize:11,color:C.hint,margin:'0 0 4px',textTransform:'uppercase',letterSpacing:'.05em'}}>Conv rate ponderat</p>
          <p style={{fontSize:22,fontWeight:500,color:C.green,margin:0}}>{weightedRate.toFixed(1)}</p>
          <p style={{fontSize:11,color:C.hint,margin:'3px 0 0'}}>scor per sesiune</p>
        </div>
        <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:10,padding:'14px 16px'}}>
          <p style={{fontSize:11,color:C.hint,margin:'0 0 4px',textTransform:'uppercase',letterSpacing:'.05em'}}>Sesiuni perioada</p>
          <p style={{fontSize:22,fontWeight:500,color:C.text,margin:0}}>{totalSess.toLocaleString('ro')}</p>
          <p style={{fontSize:11,color:C.hint,margin:'3px 0 0'}}>total sesiuni</p>
        </div>
      </div>

      {/* Alert Key Events */}
      {CONV_DEFINITIONS.filter(c => !c.isPageView && active[c.id] && getVal(c) === 0).length > 0 && (
        <div style={{background:'#FEF2F2',border:'0.5px solid #FCA5A5',borderRadius:10,padding:'12px 14px',marginBottom:16,fontSize:13}}>
          <strong style={{color:C.red}}>Atentie: </strong>
          <span style={{color:C.muted}}>
            {CONV_DEFINITIONS.filter(c => !c.isPageView && active[c.id] && getVal(c) === 0).map(c=>c.label).join(', ')} returneaza 0 — Key Events neconfigurate in GA4.
          </span>
        </div>
      )}

      {/* Controls */}
      <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',marginBottom:14}}>
        <span style={{fontSize:12,color:C.hint}}>Categorie:</span>
        {['Toate',...CATEGORIES].map(cat=>(
          <button key={cat} onClick={()=>setCatFilter(cat)} style={{
            padding:'4px 10px',fontSize:12,borderRadius:6,cursor:'pointer',
            border:`0.5px solid ${catFilter===cat?(catColors[cat]||C.blue):C.border}`,
            background:catFilter===cat?'#EBF4FC':'transparent',
            color:catFilter===cat?(catColors[cat]||C.blue):C.muted,fontWeight:catFilter===cat?500:400
          }}>{cat}</button>
        ))}
        <div style={{flex:1}}/>
        <button onClick={()=>toggleAll(true)} style={{padding:'4px 10px',fontSize:11,borderRadius:6,cursor:'pointer',border:`0.5px solid ${C.border}`,background:'transparent',color:C.muted}}>Activeaza toate</button>
        <button onClick={()=>toggleAll(false)} style={{padding:'4px 10px',fontSize:11,borderRadius:6,cursor:'pointer',border:`0.5px solid ${C.border}`,background:'transparent',color:C.muted}}>Dezactiveaza toate</button>
      </div>

      {/* Conversions list */}
      <div style={{display:'flex',flexDirection:'column',gap:6}}>
        {filtered.map(conv => {
          const val = getVal(conv)
          const isOn = active[conv.id]
          const catCol = catColors[conv.category] || C.blue
          const convRate = totalSess > 0 ? (val / totalSess * 100) : 0
          return (
            <div key={conv.id} style={{
              background:C.card,border:`0.5px solid ${isOn?C.border:'#ebebE4'}`,borderRadius:10,
              padding:'12px 14px',display:'flex',alignItems:'center',gap:12,
              opacity:isOn?1:0.5,transition:'opacity .15s'
            }}>
              {/* Toggle */}
              <button onClick={()=>toggle(conv.id)} style={{
                width:36,height:20,borderRadius:99,border:'none',cursor:'pointer',flexShrink:0,
                background:isOn?C.blue:'#d0d0c8',position:'relative',transition:'background .2s'
              }}>
                <div style={{
                  width:14,height:14,borderRadius:'50%',background:'#fff',position:'absolute',
                  top:3,left:isOn?19:3,transition:'left .2s',boxShadow:'0 1px 3px rgba(0,0,0,.2)'
                }}/>
              </button>

              {/* Icon + category */}
              <span style={{fontSize:18,flexShrink:0}}>{conv.icon}</span>

              {/* Info */}
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                  <span style={{fontSize:13,fontWeight:500,color:isOn?C.text:C.muted}}>{conv.label}</span>
                  <span style={{fontSize:10,fontWeight:500,padding:'1px 6px',borderRadius:99,background:catCol+'20',color:catCol}}>{conv.category}</span>
                  {conv.isPageView && <span style={{fontSize:10,color:C.hint,padding:'1px 5px',border:`0.5px solid ${C.border}`,borderRadius:4}}>page view</span>}
                </div>
                <p style={{fontSize:12,color:C.hint,margin:'2px 0 0'}}>{conv.description}
                  {conv.page && <> · <PageLink path={conv.page} style={{fontSize:11,fontFamily:'monospace',color:C.blue}}>{conv.page}</PageLink></>}
                </p>
              </div>

              {/* Value */}
              <div style={{textAlign:'right',flexShrink:0}}>
                <p style={{fontSize:18,fontWeight:500,color:isOn&&val>0?C.green:C.hint,margin:0}}>{val.toLocaleString('ro')}</p>
                <p style={{fontSize:11,color:C.hint,margin:'1px 0 0'}}>{convRate.toFixed(2)}% rate</p>
              </div>

              {/* Weight */}
              <div style={{textAlign:'right',flexShrink:0,width:50}}>
                <p style={{fontSize:11,color:C.hint,margin:0}}>val.</p>
                <p style={{fontSize:13,fontWeight:500,color:C.muted,margin:0}}>{conv.value}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Breakdown by category */}
      <div style={{marginTop:20}}>
        <Sec title="Conversii per categorie (active)">
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:8}}>
            {CATEGORIES.map(cat => {
              const catConvs = CONV_DEFINITIONS.filter(c=>c.category===cat&&active[c.id])
              const catTotal = catConvs.reduce((s,c)=>s+getVal(c),0)
              const col = catColors[cat]||C.blue
              if(catConvs.length===0) return null
              return (
                <div key={cat} style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:10,padding:'12px 14px'}}>
                  <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
                    <div style={{width:8,height:8,borderRadius:'50%',background:col}}/>
                    <span style={{fontSize:11,color:C.hint,textTransform:'uppercase',letterSpacing:'.04em'}}>{cat}</span>
                  </div>
                  <p style={{fontSize:22,fontWeight:500,color:catTotal>0?col:C.hint,margin:'0 0 2px'}}>{catTotal.toLocaleString('ro')}</p>
                  <p style={{fontSize:11,color:C.hint,margin:0}}>{catConvs.length} tipuri</p>
                </div>
              )
            })}
          </div>
        </Sec>
      </div>
    </div>
  )
}

/* ─── ACTIUNI ──────────────────────────────────────────────────────── */

/* ─── TAB CERERE TRACKING ──────────────────────────────────────────── */
export function TabCerereTracking({ data }) {
  const tracking = (data.cerereTracking || []).filter(d =>
    d.conversions_bravo_cerere_noua > 0 ||
    d.conversions_bun_venit_cumparator > 0 ||
    d.conversions_bun_venit_agent > 0 ||
    d.conversions_bun_venit_proprietar > 0
  )
  const allDates = data.cerereTracking || []

  const totalCereri   = allDates.reduce((s,d) => s+(d.conversions_bravo_cerere_noua||0), 0)
  const totalCump     = allDates.reduce((s,d) => s+(d.conversions_bun_venit_cumparator||0), 0)
  const totalAgent    = allDates.reduce((s,d) => s+(d.conversions_bun_venit_agent||0), 0)
  const totalProp     = allDates.reduce((s,d) => s+(d.conversions_bun_venit_proprietar||0), 0)
  const totalInreg    = totalCump + totalAgent + totalProp

  // Days with at least 1 cerere
  const activeDays    = allDates.filter(d => (d.conversions_bravo_cerere_noua||0) > 0).length
  const totalDays     = allDates.length || 1
  const avgPerActiveDay = activeDays > 0 ? (totalCereri / activeDays).toFixed(1) : '0'

  // Conversion rate: cereri / inregistrari cumparatori
  const convRate = totalCump > 0 ? (totalCereri / totalCump * 100).toFixed(0) : null

  // Find first day with data
  const firstDay = allDates.find(d => (d.conversions_bravo_cerere_noua||0) > 0)
  const daysSinceFirst = firstDay
    ? Math.round((new Date() - new Date(firstDay.date)) / 864e5)
    : null

  return (
    <div>
      {/* Header KPIs */}
      <Grid>
        <KPI label="Cereri noi (total)" curr={totalCereri}
          sub={activeDays > 0 ? `${activeDays} zile cu activitate` : 'Implementat recent'}/>
        <KPI label="Medie / zi activa" curr={parseFloat(avgPerActiveDay)} type="dec1"
          sub={daysSinceFirst ? `de acum ${daysSinceFirst} zile` : '—'}/>
        <KPI label="Inregistrari cumparatori" curr={totalCump}/>
        <KPI label="Inregistrari agenti" curr={totalAgent}/>
      </Grid>

      {/* Alert daca date putine */}
      {totalCereri < 10 && (
        <Signal type="neutral"
          title={`${totalCereri} cereri noi — implementat recent, baseline in formare`}
          body={`Key Event-ul a fost activat recent. Datele de mai jos reflecta primele zile de tracking. Revino dupa 2-4 saptamani pentru tendinte relevante. Obiectiv realist: 2-3 cereri/zi in 60 zile.`}
        />
      )}

      {convRate && (
        <Signal
          type={parseInt(convRate) > 50 ? 'positive' : parseInt(convRate) > 20 ? 'neutral' : 'negative'}
          title={`${convRate}% din cumparatorii inregistrati adauga si o cerere`}
          body={`${totalCereri} cereri din ${totalCump} inregistrari cumparatori. ${parseInt(convRate) < 50 ? 'Potential de crestere: dupa inregistrare, redirecteaza userul direct catre formularul de cerere.' : 'Rata buna — mai mult de jumatate din cumparatori adauga cerere.'}`}
        />
      )}

      {/* Grafic zilnic principal */}
      <Sec title="Cereri noi adaugate — evolutie zilnica">
        <Card>
          {allDates.length > 0 ? (
            <LineChart
              data={allDates}
              metrics={[
                {field:'conversions_bravo_cerere_noua', label:'Cereri noi', color:'#3B82C4'},
                {field:'conversions_bun_venit_cumparator', label:'Inregistrari cumparatori', color:'#16A34A'},
                {field:'conversions_bun_venit_agent', label:'Inregistrari agenti', color:'#D97706'},
              ]}
              height={220}
            />
          ) : (
            <div style={{padding:'40px 0',textAlign:'center',color:C.hint,fontSize:13}}>
              Nu exista date zilnice pentru perioada selectata.<br/>
              <span style={{fontSize:11,marginTop:4,display:'block'}}>Incearca un interval mai mare (30-60 zile) sau asteapta acumularea datelor.</span>
            </div>
          )}
        </Card>
      </Sec>

      {/* Grafic bar: cereri pe zi (mai usor de citit pentru volum mic) */}
      {allDates.length > 0 && (
        <Sec title="Cereri noi per zi — detaliu">
          <Card style={{padding:'12px 16px'}}>
            {(() => {
              const withCereri = allDates.filter(d => (d.conversions_bravo_cerere_noua||0) > 0)
              if (withCereri.length === 0) return (
                <p style={{fontSize:13,color:C.hint,textAlign:'center',padding:'20px 0'}}>
                  Nicio cerere adaugata in perioada selectata.
                </p>
              )
              const maxV = Math.max(...withCereri.map(d => d.conversions_bravo_cerere_noua||0), 1)
              return withCereri.map((d,i) => {
                const v = d.conversions_bravo_cerere_noua || 0
                const pct = v / maxV * 100
                const dt = new Date(d.date)
                const dayLabel = dt.toLocaleDateString('ro-RO', {weekday:'short', day:'numeric', month:'short'})
                return (
                  <div key={i} style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
                    <span style={{fontSize:11,color:C.muted,width:100,flexShrink:0,fontFamily:'monospace'}}>{dayLabel}</span>
                    <div style={{flex:1,background:'#ebebE4',borderRadius:99,height:10,overflow:'hidden'}}>
                      <div style={{width:`${pct}%`,height:10,background:C.blue,borderRadius:99}}/>
                    </div>
                    <span style={{fontSize:14,fontWeight:600,color:C.blue,width:20,textAlign:'right',flexShrink:0}}>{v}</span>
                  </div>
                )
              })
            })()}
          </Card>
        </Sec>
      )}

      {/* Inregistrari per tip */}
      <Sec title="Inregistrari per tip de cont">
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))',gap:10}}>
          {[
            {label:'Cumparatori',val:totalCump,col:C.blue,icon:'👤'},
            {label:'Agenti',val:totalAgent,col:C.amber,icon:'🏢'},
            {label:'Proprietari',val:totalProp,col:C.green,icon:'🏠'},
          ].map(item=>(
            <div key={item.label} style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:10,padding:'14px 16px',textAlign:'center'}}>
              <div style={{fontSize:20,marginBottom:4}}>{item.icon}</div>
              <div style={{fontSize:22,fontWeight:500,color:item.val>0?item.col:C.hint}}>{item.val}</div>
              <div style={{fontSize:11,color:C.hint,marginTop:2}}>{item.label}</div>
            </div>
          ))}
        </div>
      </Sec>

      {/* Target si ritm */}
      <Sec title="Proiectie si target">
        <Card>
          {(() => {
            const dailyRate = activeDays > 0 ? totalCereri / totalDays : 0
            const proj7  = Math.round(dailyRate * 7)
            const proj30 = Math.round(dailyRate * 30)
            const target7  = 14  // 2/zi
            const target30 = 60  // 2/zi
            return (
              <div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:14}}>
                  {[
                    {label:'Ritm actual /zi',val:dailyRate.toFixed(2),sub:'pe tot intervalul'},
                    {label:'Proiectie 7 zile',val:proj7,sub:`target: ${target7}`,ok:proj7>=target7},
                    {label:'Proiectie 30 zile',val:proj30,sub:`target: ${target30}`,ok:proj30>=target30},
                  ].map((it,i)=>(
                    <div key={i} style={{textAlign:'center',padding:'10px',background:it.ok===true?'#F0FDF4':it.ok===false?'#FEF2F2':'#f5f5f3',borderRadius:8}}>
                      <div style={{fontSize:20,fontWeight:600,color:it.ok===true?C.green:it.ok===false?C.red:C.text}}>{it.val}</div>
                      <div style={{fontSize:11,color:C.hint,marginTop:2}}>{it.label}</div>
                      <div style={{fontSize:10,color:it.ok===true?C.green:it.ok===false?C.red:C.hint,marginTop:1}}>{it.sub}</div>
                    </div>
                  ))}
                </div>
                <div style={{fontSize:12,color:C.muted,lineHeight:1.6,borderTop:`0.5px solid ${C.border}`,paddingTop:10}}>
                  <strong style={{color:C.text}}>Target recomandat:</strong> 2 cereri/zi = 60/luna = 720/an.
                  La ritmul actual de <strong>{dailyRate.toFixed(2)}/zi</strong>,
                  {dailyRate < 2
                    ? ` esti sub target. Implementeaza CTA inline pe /cereri si redirecteaza cumparatorii catre formular imediat dupa inregistrare.`
                    : ` esti pe track. Mentine ritmul si monitorizeaza saptamanal.`}
                </div>
              </div>
            )
          })()}
        </Card>
      </Sec>
    </div>
  )
}

export { TabRecomandari, TabCerereNoua, TabConversii }
