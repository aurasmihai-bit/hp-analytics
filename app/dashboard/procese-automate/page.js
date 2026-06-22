'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import { C } from '../components'
import { DARK_THEME, LIGHT_THEME, THEME_STORAGE_KEY, ThemeSwitch } from '../theme'

const PROCESS_CATALOG = [
  {
    name:'expire-requests',
    category:'Cereri',
    type:'Cron',
    status:'Activ',
    frequency:'Zilnic 02:00',
    target:'Cereri active care au depasit data de expirare.',
    description:'Inchide automat cererile expirate si scrie campurile de audit pentru status.',
    resources:'Edge Runtime, pg_cron, Supabase DB update',
    risk:'Mediu',
    monitor:'invocari, erori DB, cereri expirate, cereri sarite de validari legacy',
  },
  {
    name:'notify-expiring-requests',
    category:'Notificari',
    type:'Cron',
    status:'Activ',
    frequency:'Zilnic 08:00',
    target:'Cumparatori cu cereri care expira in 14, 7, 3 sau 1 zile.',
    description:'Creeaza notificari de prelungire/reactivare inainte ca cererea sa expire.',
    resources:'Edge Runtime, Supabase DB, notificari, Brevo prin dispatcher',
    risk:'Mediu',
    monitor:'notificari create, open/click email, reactivari, duplicate pe aceeasi zi',
  },
  {
    name:'notify-matching-agents',
    category:'Matching AI',
    type:'Cron',
    status:'Activ',
    frequency:'08:00 si 20:00',
    target:'Cereri active si proprietati active eligibile pentru matching.',
    description:'Ruleaza matching AI si creeaza recomandari pentru agenti/proprietari.',
    resources:'Ridicat: Edge Runtime, scan DB, scoring, insert matching_results, notificari',
    risk:'Ridicat',
    monitor:'durata, randuri scanate, recomandari generate, rata oferte trimise, erori timeout',
  },
  {
    name:'process-pending-matches',
    category:'Matching AI',
    type:'Cron',
    status:'Activ',
    frequency:'La 3 ore',
    target:'Recomandari AI in asteptare.',
    description:'Aproba/anuleaza automat recomandarile in functie de scor si vechime.',
    resources:'Edge Runtime, Supabase DB, notificari',
    risk:'Ridicat',
    monitor:'aprobari automate, anulari, recomandari ramase pending peste 24h',
  },
  {
    name:'remind-recommendations-no-offers',
    category:'Matching AI',
    type:'Cron',
    status:'Activ',
    frequency:'Zilnic 09:30; 3/5/7 zile, apoi saptamanal',
    target:'Agenti/proprietari cu recomandari AI aprobate, dar fara oferta trimisa.',
    description:'Trimite reminder doar catre useri cu proprietati active si respecta limita Brevo.',
    resources:'Edge Runtime, Supabase DB, Brevo quota, notificari',
    risk:'Ridicat',
    monitor:'mailuri trimise, limita Brevo folosita, conversie in oferte, unsubscribe/spam',
  },
  {
    name:'remind-pending-offers',
    category:'Oferte',
    type:'Cron',
    status:'Activ',
    frequency:'Zilnic 09:00',
    target:'Oferte trimise care asteapta raspuns.',
    description:'Reaminteste cumparatorilor sa accepte, refuze, negocieze sau ceara detalii.',
    resources:'Edge Runtime, Supabase DB, notificari, tranzactii puncte',
    risk:'Mediu',
    monitor:'oferte pending pe etapa, raspunsuri dupa reminder, deductii de puncte',
  },
  {
    name:'remind-no-offers',
    category:'Cereri',
    type:'Cron',
    status:'Activ',
    frequency:'Zilnic 09:45/10:00',
    target:'Cereri active fara oferte.',
    description:'Trimite remindere pentru cereri fara raspuns comercial dupa milestone-uri.',
    resources:'Edge Runtime, Supabase DB, notificari',
    risk:'Mediu',
    monitor:'cereri fara oferte, remindere pe milestone, oferte generate ulterior',
  },
  {
    name:'remind-open-door',
    category:'Open House',
    type:'Cron',
    status:'Activ',
    frequency:'Zilnic dimineata',
    target:'Participanti la Open House cu eveniment apropiat.',
    description:'Trimite remindere pentru participare la vizionari/Open House.',
    resources:'Edge Runtime, Supabase DB, notificari',
    risk:'Scazut',
    monitor:'remindere trimise, prezente, erori date eveniment',
  },
  {
    name:'remind-no-viewing',
    category:'Open House',
    type:'Cron',
    status:'Activ',
    frequency:'Zilnic',
    target:'Proprietati active fara vizionari/Open House.',
    description:'Incurajeaza agentii/proprietarii sa adauge evenimente de vizionare.',
    resources:'Edge Runtime, Supabase DB, notificari',
    risk:'Mediu',
    monitor:'proprietati fara vizionari, evenimente create dupa reminder',
  },
  {
    name:'remind-inactive-buyers',
    category:'Notificari',
    type:'Cron',
    status:'Activ',
    frequency:'Zilnic 10:00',
    target:'Cumparatori inactivi sau fara cerere.',
    description:'Campanie de reactivare, inclusiv voucher/credite unde este cazul.',
    resources:'Edge Runtime, Supabase DB, notificari, vouchere',
    risk:'Mediu',
    monitor:'reactivari, cereri create, voucher folosit, frecventa/user',
  },
  {
    name:'remind-inactive-agents',
    category:'Notificari',
    type:'Cron',
    status:'Activ',
    frequency:'Zilnic 10:30',
    target:'Agenti/proprietari inactivi.',
    description:'Trimite remindere de revenire pe platforma pentru useri comerciali.',
    resources:'Edge Runtime, Supabase DB, notificari',
    risk:'Mediu',
    monitor:'login dupa reminder, oferte/proprietati adaugate, dezabonari',
  },
  {
    name:'process-delayed-notifications',
    category:'Notificari',
    type:'Cron',
    status:'Activ',
    frequency:'La 5 minute',
    target:'Notificari programate sau amanate.',
    description:'Proceseaza batch-uri de notificari due si le trimite spre email/push/WhatsApp.',
    resources:'Ridicat ca frecventa: Edge Runtime, Supabase DB, Brevo, WhatsApp/push',
    risk:'Ridicat',
    monitor:'queue depth, timp pana la trimitere, erori provider, limita zilnica email',
  },
  {
    name:'process-monthly-credits',
    category:'Puncte & abonamente',
    type:'Cron',
    status:'Activ',
    frequency:'Lunar / cron intern',
    target:'Useri eligibili pentru credite lunare.',
    description:'Acorda puncte/credite recurente conform abonamentelor.',
    resources:'Edge Runtime, Supabase DB, credit_transactions, Brevo',
    risk:'Mediu',
    monitor:'credite acordate, duplicate, useri fara plan, erori tranzactii',
  },
  {
    name:'health-check-auth',
    category:'Sistem',
    type:'Cron',
    status:'Activ',
    frequency:'Zilnic 06:00/07:00',
    target:'Supabase Auth si flow-uri de autentificare.',
    description:'Verifica sanatatea sistemului de auth si semnaleaza erori operationale.',
    resources:'Scazut: Edge Runtime, Supabase Auth',
    risk:'Scazut',
    monitor:'status auth, latenta, erori token/session',
  },
  {
    name:'check-suspension',
    category:'Securitate',
    type:'Cron',
    status:'Activ',
    frequency:'Zilnic 03:00',
    target:'Useri suspendati sau care necesita restrictii.',
    description:'Verifica si aplica reguli legate de suspendari/conturi restrictionate.',
    resources:'Edge Runtime, Supabase DB/Auth',
    risk:'Mediu',
    monitor:'conturi verificate, suspendari aplicate, acces blocat corect',
  },
  {
    name:'expire-welcome-bonus',
    category:'Puncte & abonamente',
    type:'Cron',
    status:'Activ',
    frequency:'Zilnic 03:00',
    target:'Bonusuri welcome mai vechi de 7 zile.',
    description:'Expira bonusurile nefolosite si ajusteaza soldul de credite.',
    resources:'Edge Runtime, Supabase DB',
    risk:'Scazut',
    monitor:'bonusuri expirate, solduri negative, duplicate',
  },
  {
    name:'auto-send-feedback',
    category:'Open House',
    type:'Cron',
    status:'Activ',
    frequency:'Zilnic 06:00/07:00',
    target:'Evenimente Open House finalizate.',
    description:'Trimite automat cereri de feedback dupa vizionari.',
    resources:'Edge Runtime, Supabase DB, notificari/Brevo',
    risk:'Mediu',
    monitor:'feedback trimis, raspunsuri primite, erori email',
  },
  {
    name:'send-offer-rejection-feedback',
    category:'Oferte',
    type:'Cron',
    status:'Activ',
    frequency:'Zilnic 11:00',
    target:'Oferte refuzate unde se poate cere feedback.',
    description:'Solicita motiv de refuz pentru imbunatatirea ofertelor si a matchingului.',
    resources:'Edge Runtime, Supabase DB, notificari',
    risk:'Scazut',
    monitor:'feedback completat, motive refuz, rata raspuns',
  },
  {
    name:'invite-open-house-zone-match',
    category:'Open House',
    type:'Cron',
    status:'Activ',
    frequency:'La 2 zile, 09:00',
    target:'Cereri compatibile cu zonele Open House.',
    description:'Invita cumparatori la Open House pe baza potrivirii de zona.',
    resources:'Edge Runtime, Supabase DB, matching zona, notificari',
    risk:'Mediu',
    monitor:'invitatii trimise, inscrieri, potriviri gresite de zona',
  },
  {
    name:'import-immoflux',
    category:'CRM',
    type:'Cron',
    status:'Activ',
    frequency:'Zilnic 04:00',
    target:'Proprietati si date venite din ImmoFlux.',
    description:'Sincronizeaza date CRM ImmoFlux in HomePitch.',
    resources:'Ridicat: API extern ImmoFlux/proxy, Edge Runtime, Supabase DB',
    risk:'Ridicat',
    monitor:'proprietati importate/actualizate, erori API, timp sync, duplicate',
  },
  {
    name:'process-rss-queue',
    category:'SEO & Social',
    type:'Cron',
    status:'Activ',
    frequency:'Programat; publica in fereastra 07:00-23:59',
    target:'Queue de RSS/social posting.',
    description:'Publica itemi RSS/social cu delay intre postari.',
    resources:'Edge Runtime, Supabase DB, RSS/social endpoint',
    risk:'Scazut',
    monitor:'queue depth, itemi publicati, erori publicare',
  },
  {
    name:'remind-no-map',
    category:'Legacy',
    type:'Cron',
    status:'Dezactivat',
    frequency:'Legacy',
    target:'Cereri fara harta.',
    description:'Notificare veche, dezactivata dupa ce zona/harta a devenit obligatorie.',
    resources:'Nu ar trebui sa consume resurse daca ramane dezactivata.',
    risk:'Scazut',
    monitor:'sa nu existe invocari active sau notificari no_map_24h/no_map_48h',
  },
  {
    name:'create-guest-request',
    category:'Cereri',
    type:'Event',
    status:'Activ',
    frequency:'La submit formular /vreau pentru user nelogat',
    target:'Cereri create de vizitatori neautentificati.',
    description:'Creeaza cererea si declanseaza backfill zona, scor cumparator, bonus si matching.',
    resources:'Edge Runtime, Supabase DB, backfill, scor, matching, notificari',
    risk:'Ridicat',
    monitor:'request_created, erori validare, timp completare, draft recovery, conversie guest',
  },
  {
    name:'backfill-request-cartier',
    category:'Geo',
    type:'Event',
    status:'Activ',
    frequency:'Dupa creare/editare cerere',
    target:'Cartierele asociate unei cereri.',
    description:'Mapeaza cartierele din pin/polygon/zona selectata in campuri cautabile.',
    resources:'Edge Runtime, Supabase DB, logica geo',
    risk:'Ridicat',
    monitor:'cereri fara cartiere mapate, mismatch pin/polygon, durata backfill',
  },
  {
    name:'backfill-request-neighborhoods',
    category:'Geo',
    type:'Event',
    status:'Activ',
    frequency:'Dupa creare/editare harta cerere',
    target:'Lista de cartiere pentru zone desenate.',
    description:'Extrage si salveaza cartierele intersectate de harta desenata.',
    resources:'Edge Runtime, Supabase DB, calcule geo',
    risk:'Ridicat',
    monitor:'cartiere detectate, zone fara rezultate, erori polygon/pin',
  },
  {
    name:'backfill-property-cartier',
    category:'Geo',
    type:'Event/Admin',
    status:'Activ',
    frequency:'Dupa import/editare proprietate sau rulat manual',
    target:'Cartier proprietate.',
    description:'Normalizeaza cartierul proprietatii pentru cautare si matching.',
    resources:'Edge Runtime, Supabase DB, calcule geo',
    risk:'Mediu',
    monitor:'proprietati fara cartier, cartier gresit, durata batch',
  },
  {
    name:'recompute-request-buyer-score',
    category:'Scor cumparator',
    type:'Event/Admin',
    status:'Activ',
    frequency:'Dupa creare/editare cerere, upload document sau recalcul manual',
    target:'Scorul cumparatorului pe cerere.',
    description:'Recalculeaza scorul total si categoriile scorului cumparator.',
    resources:'Edge Runtime, Supabase DB/RPC',
    risk:'Mediu',
    monitor:'scoruri 0 anormale, categorii inconsistente, erori RPC/schema cache',
  },
  {
    name:'send-notification-email',
    category:'Notificari',
    type:'Trigger DB',
    status:'Activ',
    frequency:'La notificare noua eligibila',
    target:'Emailurile tranzactionale HomePitch.',
    description:'Trimite notificari prin Brevo pe baza randurilor din tabela notifications.',
    resources:'Edge Runtime, Supabase pg_net, Brevo API',
    risk:'Ridicat',
    monitor:'delivery rate, bounced, daily cap/user, erori template, retry',
  },
  {
    name:'send-push-notification',
    category:'Notificari',
    type:'Trigger DB',
    status:'Dezactivat partial',
    frequency:'La notificare noua, daca push este activ',
    target:'Push notifications.',
    description:'Canal push pregatit, dar marcat in admin ca dezactivat pentru moment.',
    resources:'Edge Runtime, provider push',
    risk:'Scazut',
    monitor:'sa nu consume invocari inutile cat timp e dezactivat',
  },
  {
    name:'dispatch-whatchimp-notification',
    category:'WhatsApp',
    type:'Trigger DB',
    status:'Activ daca secretul este setat',
    frequency:'La notificare eligibila WhatsApp',
    target:'Mesaje WhatsApp prin Whatchimp.',
    description:'Dispatcher automat pentru notificari WhatsApp.',
    resources:'Edge Runtime, Whatchimp API, Supabase DB',
    risk:'Mediu',
    monitor:'mesaje trimise, failed, cost/mesaj, rate limit provider',
  },
  {
    name:'dispatch-twilio-notification',
    category:'WhatsApp',
    type:'Trigger DB',
    status:'Activ daca secretul este setat',
    frequency:'La notificare eligibila WhatsApp/SMS',
    target:'Mesaje Twilio.',
    description:'Dispatcher alternativ pentru notificari WhatsApp/SMS.',
    resources:'Edge Runtime, Twilio API',
    risk:'Mediu',
    monitor:'status callbacks, cost, failed, opt-out',
  },
  {
    name:'create-checkout',
    category:'Plati',
    type:'Event',
    status:'Activ',
    frequency:'La creare plata Stripe',
    target:'Abonamente, promovari, bannere sau servicii platite.',
    description:'Creeaza sesiuni Stripe Checkout pentru fluxurile de plata.',
    resources:'Edge Runtime, Stripe API, Supabase DB',
    risk:'Ridicat',
    monitor:'checkout creat, checkout platit, abandon, erori Stripe key',
  },
  {
    name:'stripe-webhook',
    category:'Plati',
    type:'Webhook',
    status:'Activ',
    frequency:'La evenimente Stripe',
    target:'Confirmari plata, abonamente, prioritizare listari.',
    description:'Proceseaza webhookurile Stripe si aplica efectele in HomePitch.',
    resources:'Edge Runtime, Stripe webhook, Supabase DB, notificari/Brevo',
    risk:'Ridicat',
    monitor:'webhook success, semnatura invalida, duplicate event id, efect business aplicat',
  },
  {
    name:'vip-change-subscription',
    category:'Plati',
    type:'Event',
    status:'Activ',
    frequency:'La modificare abonament',
    target:'Abonamente VIP/PRO.',
    description:'Actualizeaza planuri si limite pentru userii platitori.',
    resources:'Edge Runtime, Stripe/Supabase DB',
    risk:'Mediu',
    monitor:'plan actualizat, limite corecte, downgrade/upgrade',
  },
  {
    name:'send-concierge-request-email',
    category:'Concierge',
    type:'Event',
    status:'Activ',
    frequency:'La submit formular /concierge',
    target:'Cereri concierge.',
    description:'Trimite email catre destinatarii configurati si sincronizeaza catre CRM analytics.',
    resources:'Edge Runtime, Brevo, Supabase HomePitch, Supabase analytics',
    risk:'Ridicat',
    monitor:'email trimis, CRM row creat, erori HP_ANALYTICS_SUPABASE_SERVICE_KEY, duplicate',
  },
  {
    name:'notify-alert-subscribers',
    category:'Notificari',
    type:'Event',
    status:'Activ',
    frequency:'La cerere/proprietate noua eligibila',
    target:'Useri abonati la alerte.',
    description:'Trimite alerte personalizate catre userii care urmaresc criterii relevante.',
    resources:'Edge Runtime, Supabase DB, notificari',
    risk:'Mediu',
    monitor:'abonati gasiti, CTR, duplicate alerte',
  },
  {
    name:'notify-price-change',
    category:'Oferte',
    type:'Event',
    status:'Activ',
    frequency:'La modificare pret oferta/proprietate',
    target:'Useri interesati de schimbarea de pret.',
    description:'Notifica schimbari de pret relevante.',
    resources:'Edge Runtime, Supabase DB, notificari',
    risk:'Scazut',
    monitor:'notificari trimise, erori, conversii dupa notificare',
  },
  {
    name:'rate-offer',
    category:'Oferte',
    type:'Event',
    status:'Activ',
    frequency:'La accept/refuz/rating oferta',
    target:'Flow cerere-oferta.',
    description:'Proceseaza feedbackul cumparatorului pe oferta si actualizeaza statusurile.',
    resources:'Edge Runtime, Supabase DB, notificari',
    risk:'Ridicat',
    monitor:'acceptari, refuzuri, status invalid, mesaje trimise',
  },
  {
    name:'negotiate-offer',
    category:'Oferte',
    type:'Event',
    status:'Activ',
    frequency:'La negociere oferta',
    target:'Mesaje si negociere intre cumparator si ofertant.',
    description:'Creeaza etapa de negociere si comunica urmatorul pas.',
    resources:'Edge Runtime, Supabase DB, notificari',
    risk:'Ridicat',
    monitor:'negocieri pornite, reply rate, erori permisiuni',
  },
  {
    name:'analytics-traffic',
    category:'Analytics',
    type:'Admin/API',
    status:'Activ',
    frequency:'La deschiderea dashboardurilor analytics/sync',
    target:'Date GA4, trafic, pagini, surse.',
    description:'Citeste date din Google Analytics pentru rapoarte si taburi.',
    resources:'Google OAuth/API, Edge/Node API, cache Supabase',
    risk:'Ridicat',
    monitor:'quota GA4, latenta, cache hit, 401/403 service account',
  },
  {
    name:'submit-url',
    category:'SEO',
    type:'Event/Admin',
    status:'Activ',
    frequency:'La indexare URL nou',
    target:'Google Indexing/Search Console si IndexNow.',
    description:'Trimite URL-uri noi/importante catre servicii de indexare.',
    resources:'Google API, IndexNow, Edge Runtime',
    risk:'Mediu',
    monitor:'URL-uri trimise, erori quota, status indexare',
  },
  {
    name:'purge-cloudflare-cache',
    category:'Sistem',
    type:'Admin',
    status:'Activ',
    frequency:'La apasarea Clear Cache',
    target:'Cache Cloudflare.',
    description:'Curata cache-ul CDN pentru actualizari vizibile mai rapid.',
    resources:'Cloudflare API',
    risk:'Mediu',
    monitor:'purge success, erori token, timp pana la refresh live',
  },
  {
    name:'optimize-image',
    category:'Media',
    type:'Event',
    status:'Activ',
    frequency:'La upload imagine',
    target:'Imagini proprietati/listari.',
    description:'Optimizeaza imaginile pentru performanta si afisare.',
    resources:'CPU Edge/worker, storage, Supabase DB',
    risk:'Mediu',
    monitor:'dimensiune inainte/dupa, erori procesare, timp upload',
  },
  {
    name:'og-image',
    category:'SEO & Social',
    type:'Public/API',
    status:'Activ',
    frequency:'La crawl/share social',
    target:'Preview social pentru pagini HomePitch.',
    description:'Genereaza imagine Open Graph pentru partajare.',
    resources:'Edge Runtime, render imagine, DB read',
    risk:'Scazut',
    monitor:'erori render, latenta crawler, fallback image',
  },
  {
    name:'sitemap',
    category:'SEO',
    type:'Public/API',
    status:'Activ',
    frequency:'La crawl sau request manual',
    target:'Motoare de cautare.',
    description:'Genereaza sitemap din cereri/proprietati/pagini publice.',
    resources:'Edge Runtime, Supabase DB read',
    risk:'Mediu',
    monitor:'numar URL-uri, erori DB, timp generare',
  },
  {
    name:'rss-feed',
    category:'SEO & Social',
    type:'Public/API',
    status:'Activ',
    frequency:'La request crawler/consumer',
    target:'Feed-uri RSS.',
    description:'Expune feed pentru continut nou HomePitch.',
    resources:'Edge Runtime, Supabase DB read',
    risk:'Scazut',
    monitor:'request-uri, erori, itemi lipsa',
  },
  {
    name:'send-property-contact-email',
    category:'Email',
    type:'Event',
    status:'Activ',
    frequency:'La contact proprietate',
    target:'Agent/proprietar si lead.',
    description:'Trimite email de contact pentru proprietati.',
    resources:'Edge Runtime, Brevo, Supabase DB',
    risk:'Mediu',
    monitor:'emailuri trimise, leaduri, bounced, duplicate',
  },
  {
    name:'send-viewing-request-email',
    category:'Email',
    type:'Event',
    status:'Activ',
    frequency:'La cerere vizionare',
    target:'Agent/proprietar.',
    description:'Trimite email pentru solicitari de vizionare.',
    resources:'Edge Runtime, Brevo, Supabase DB',
    risk:'Mediu',
    monitor:'vizionari solicitate, email success, conversie in programari',
  },
  {
    name:'send-questionnaire-report',
    category:'Concierge',
    type:'Event',
    status:'Activ',
    frequency:'La completare chestionar vizionare',
    target:'Cumparator si/sau admin.',
    description:'Trimite raportul chestionarului de vizionare.',
    resources:'Edge Runtime, Brevo, Supabase DB',
    risk:'Scazut',
    monitor:'rapoarte trimise, erori email, completari formular',
  },
  {
    name:'submit-contact',
    category:'Email',
    type:'Event',
    status:'Activ',
    frequency:'La formular contact',
    target:'Admin/HomePitch.',
    description:'Proceseaza cererile din formularul de contact.',
    resources:'Edge Runtime, Brevo, Supabase DB',
    risk:'Scazut',
    monitor:'contacte noi, spam, erori email',
  },
  {
    name:'newsletter-subscribe',
    category:'Email',
    type:'Event',
    status:'Activ',
    frequency:'La inscriere newsletter',
    target:'Contacte newsletter.',
    description:'Adauga contacte in lista de newsletter.',
    resources:'Edge Runtime, Brevo/Supabase DB',
    risk:'Scazut',
    monitor:'abonari, duplicate, opt-in/opt-out',
  },
  {
    name:'import-crm-rebs / crmrebs-import-property',
    category:'CRM',
    type:'Event/Admin',
    status:'Activ',
    frequency:'Manual, webhook sau sync configurat',
    target:'Proprietati CRM REBS.',
    description:'Importa proprietati REBS si normalizeaza datele pentru HomePitch.',
    resources:'API CRM REBS, Edge Runtime, Supabase DB, backfill geo',
    risk:'Ridicat',
    monitor:'proprietati importate, proprietati inactive, erori API, mapping campuri',
  },
  {
    name:'import-crm-renet / crmrenet-import-property',
    category:'CRM',
    type:'Event/Admin',
    status:'Activ partial',
    frequency:'Manual, webhook sau sync dupa setarea cheii',
    target:'Proprietati Renet.',
    description:'Importa proprietati Renet dupa configurarea API key potrivita.',
    resources:'API Renet, Edge Runtime, Supabase DB',
    risk:'Ridicat',
    monitor:'conexiune API, proprietati importate, duplicate, campuri lipsa',
  },
  {
    name:'immoflux-webhook',
    category:'CRM',
    type:'Webhook',
    status:'Activ',
    frequency:'La evenimente ImmoFlux',
    target:'Proprietati sincronizate din ImmoFlux.',
    description:'Primeste modificari din ImmoFlux si actualizeaza HomePitch.',
    resources:'ImmoFlux API/proxy, Edge Runtime, Supabase DB',
    risk:'Ridicat',
    monitor:'webhook-uri primite, semnaturi/validare, actualizari aplicate',
  },
  {
    name:'rebs-webhook-property / rebs-webhook-agent',
    category:'CRM',
    type:'Webhook',
    status:'Activ',
    frequency:'La evenimente REBS',
    target:'Proprietati si agenti REBS.',
    description:'Sincronizeaza schimbari REBS catre HomePitch.',
    resources:'REBS webhook, Edge Runtime, Supabase DB',
    risk:'Ridicat',
    monitor:'payload-uri procesate, erori mapping, proprietati deactivate de webhook',
  },
  {
    name:'renet-activation-inbound / rebs-activation-inbound',
    category:'CRM',
    type:'Webhook',
    status:'Activ',
    frequency:'La activari inbound',
    target:'Activari agentii/CRM.',
    description:'Leaga activarea CRM de conturile HomePitch.',
    resources:'Edge Runtime, Supabase DB, CRM API',
    risk:'Mediu',
    monitor:'activari reusite, conturi nelinkuite, erori credentiale',
  },
  {
    name:'validate-email-domain',
    category:'Securitate',
    type:'Event/API',
    status:'Activ',
    frequency:'La validari email',
    target:'Domenii email din conturi/formulare.',
    description:'Verifica domenii email si poate alimenta statistici/domenii suspecte.',
    resources:'Edge Runtime, Supabase DB/API extern optional',
    risk:'Scazut',
    monitor:'domenii respinse, domenii temporare, erori DNS/API',
  },
  {
    name:'rate-limit',
    category:'Securitate',
    type:'Event/API',
    status:'Activ',
    frequency:'La actiuni limitate',
    target:'Formulare, login, actiuni sensibile.',
    description:'Aplica limite de frecventa pentru protectie anti-spam.',
    resources:'Edge Runtime, Supabase DB/cache',
    risk:'Mediu',
    monitor:'blocari legitime, atacuri/spam, false positives',
  },
  {
    name:'admin-* / brevo-* utilities',
    category:'Admin',
    type:'Admin',
    status:'Activ la cerere',
    frequency:'Manual din admin',
    target:'Setari, parole, template-uri, status Brevo.',
    description:'Functii utilitare pentru administrare platforma si email.',
    resources:'Edge Runtime, Supabase DB/Auth, Brevo API',
    risk:'Mediu',
    monitor:'cine ruleaza, audit, erori permisiuni, modificari critice',
  },
  {
    name:'generate-seo / generate-seo-landing',
    category:'SEO',
    type:'Event/Admin',
    status:'Activ',
    frequency:'La publicare sau manual',
    target:'Pagini SEO si landing pages.',
    description:'Genereaza continut/metadate SEO pentru pagini dedicate.',
    resources:'Edge Runtime, Supabase DB, eventual AI/API text',
    risk:'Mediu',
    monitor:'pagini generate, indexare, trafic organic, continut duplicat',
  },
]

const MONITORING_AREAS = [
  {
    title:'Cost si performanta',
    body:'Invocari/zi, durata medie, timeout-uri, functii cu scan DB mare, cache hit/miss si p95 latency.',
    accent:C.blue,
  },
  {
    title:'Livrabilitate notificari',
    body:'Brevo sent/delivered/bounced, daily cap/user, WhatsApp failed, duplicate notificari si retry queue.',
    accent:C.green,
  },
  {
    title:'Impact business',
    body:'Cereri create, oferte trimise dupa reminder, recomandari AI transformate in oferte, plati confirmate.',
    accent:C.amber,
  },
  {
    title:'Calitate date',
    body:'Cereri fara scor, cartiere nemapate, proprietati importate fara localitate/cartier, statusuri invalide.',
    accent:C.purple,
  },
  {
    title:'Securitate si audit',
    body:'Admin actions, webhooks Stripe/CRM validate, rate-limit hits, functii publice cu JWT off si erori 401/403.',
    accent:C.red,
  },
]

const OPTIMIZATION_RECOMMENDATIONS = [
  {
    title:'Ruleaza matching incremental, nu full-scan global',
    process:'notify-matching-agents, process-pending-matches',
    area:'Server',
    priority:'Critic',
    effort:'Mare',
    saving:'DB scan + Edge duration',
    warning:'Matchingul este cel mai probabil cel mai scump proces: compara cereri active cu proprietati active si poate creste rapid cu volumul.',
    recommendation:'Cand apare o cerere noua, ruleaza matching doar pentru acea cerere. Cand apare o proprietate noua, ruleaza doar contra cererilor eligibile. Pastreaza cron-ul de 2 ori/zi doar ca reconciliere/light audit.',
    metric:'p95 duration, randuri scanate, matching_results create/invocation, timeout rate',
  },
  {
    title:'Deduplicare hard pentru notificari inainte de Brevo/WhatsApp',
    process:'send-notification-email, process-delayed-notifications, dispatch-whatchimp-notification',
    area:'Resurse externe',
    priority:'Critic',
    effort:'Mediu',
    saving:'Brevo quota + WhatsApp cost',
    warning:'Orice duplicat in tabela notifications poate consuma email/WhatsApp si poate irita userii.',
    recommendation:'Adauga o cheie de idempotenta per user + notification_type + entity_id + milestone_day. Blocheaza trimiterea daca exista delivery cu status sent/recent.',
    metric:'notificari duplicate, email sent/user/day, failed/retry count, cost WhatsApp',
  },
  {
    title:'Cache agresiv pentru analytics si rapoarte GA4',
    process:'analytics-traffic, /api/report, /api/sync',
    area:'Viteza',
    priority:'Ridicat',
    effort:'Mediu',
    saving:'Google API quota + load time dashboard',
    warning:'Taburile analytics pot deveni lente daca fiecare deschidere citeste live din GA4/GSC.',
    recommendation:'Pastreaza daily cache in Supabase pentru fiecare tab si reimprospateaza incremental doar zilele lipsa. Pentru UI, afiseaza cache imediat si ruleaza refresh manual/async.',
    metric:'cache hit rate, GA4 calls/day, time to first dashboard render',
  },
  {
    title:'Mutare backfill geo intr-o coada batch cu hash de geometrie',
    process:'backfill-request-cartier, backfill-request-neighborhoods, backfill-property-cartier',
    area:'Server',
    priority:'Ridicat',
    effort:'Mediu',
    saving:'CPU geo + DB writes',
    warning:'Pin/polygon/cartiere sunt recalculate la creare/editare; aceeasi geometrie poate fi procesata repetat.',
    recommendation:'Salveaza geometry_hash si refoloseste rezultatul pentru aceeasi zona. Ruleaza batch async pentru polygon-uri mari, cu status vizibil in admin.',
    metric:'cereri fara cartiere, durata backfill, cache hits geometry_hash',
  },
  {
    title:'Nu mai apela matching complet din create-guest-request',
    process:'create-guest-request',
    area:'Viteza',
    priority:'Ridicat',
    effort:'Mediu',
    saving:'Timp submit formular + Edge duration',
    warning:'Daca submitul cererii asteapta prea multe procese secundare, userul simte eroare sau delay.',
    recommendation:'Dupa insert, returneaza rapid succes catre user. Pune recompute score, geo backfill si matching intr-o coada async cu retry si audit.',
    metric:'time_to_request_created, submit error rate, queue processing lag',
  },
  {
    title:'Indexuri si materialized view pentru admin procese grele',
    process:'admin/matching, admin/notificari, process-pending-matches',
    area:'Server',
    priority:'Ridicat',
    effort:'Mediu',
    saving:'DB query time',
    warning:'Paginile admin pot scana tabele mari de matching, notifications, requests si properties.',
    recommendation:'Adauga indexuri pe status + created_at + user_id/entity_id si view-uri agregate pentru count-uri din taburi. Evita COUNT global live la fiecare render.',
    metric:'query duration, rows read, admin page load p95',
  },
  {
    title:'Sterge definitiv cron-urile legacy dezactivate',
    process:'remind-no-map',
    area:'Server',
    priority:'Mediu',
    effort:'Mic',
    saving:'Invocari inutile + zgomot operational',
    warning:'no_map_24h/no_map_48h este vechi si nu se mai aplica dupa harta obligatorie.',
    recommendation:'Pastreaza logica documentata ca deprecated, dar elimina schedule-ul si orice trigger ramas in DB ca sa nu mai apara in rapoarte sau notificari.',
    metric:'0 invocari remind-no-map, 0 notificari no_map_*',
  },
  {
    title:'Rate limit si circuit breaker pentru importuri CRM',
    process:'import-immoflux, import-crm-rebs, import-crm-renet, webhooks CRM',
    area:'Resurse externe',
    priority:'Ridicat',
    effort:'Mediu',
    saving:'API calls CRM + DB writes',
    warning:'Importurile pot retrimite aceleasi proprietati sau pot dezactiva date gresit daca providerul are raspunsuri incomplete.',
    recommendation:'Adauga last_successful_sync, etag/external_updated_at si circuit breaker dupa N erori consecutive. Nu rescrie randuri daca payload-ul nu s-a schimbat.',
    metric:'API calls/sync, rows unchanged skipped, consecutive errors, inactive reason source',
  },
  {
    title:'Precalculeaza scorul cumparator si serveste breakdown din DB',
    process:'recompute-request-buyer-score, get_buyer_score_breakdown',
    area:'Viteza',
    priority:'Mediu',
    effort:'Mediu',
    saving:'Page load + RPC latency',
    warning:'Pagina de cerere este sensibila la scor; daca RPC-ul e lent sau lipseste, userul vede eroare langa un scor vizibil.',
    recommendation:'Pastreaza scorul total si categoriile in tabela dedicata, cu updated_at. RPC-ul doar citeste breakdown-ul, nu recalculare live.',
    metric:'RPC duration, buyer score errors, scoruri 0 anormale',
  },
  {
    title:'Cache pentru sitemap si og-image',
    process:'sitemap, og-image, share',
    area:'Viteza',
    priority:'Mediu',
    effort:'Mic',
    saving:'Edge render + DB read',
    warning:'Crawlerele pot apela repetat sitemap/OG si pot produce load inutil.',
    recommendation:'Cache pe Cloudflare/Vercel pentru sitemap si OG images cu invalidare la publicare cerere/proprietate sau purge manual.',
    metric:'cache hit ratio, OG render duration, crawler request volume',
  },
  {
    title:'Fallback lightweight pentru send-concierge-request-email',
    process:'send-concierge-request-email',
    area:'Reliability',
    priority:'Ridicat',
    effort:'Mic',
    saving:'Pierderi lead + retry manual',
    warning:'Daca analytics Supabase sau Brevo cade, cererea concierge poate fi incompleta in CRM.',
    recommendation:'Scrie intai cererea local/audit, apoi trimite email si sync analytics in pasi separati cu retry. Marcheaza clar sync_status.',
    metric:'concierge email sent, crm row created, sync failures, retry success',
  },
  {
    title:'Evita generarea AI/SEO pe request sincron',
    process:'generate-seo, generate-seo-landing',
    area:'AI',
    priority:'Mediu',
    effort:'Mediu',
    saving:'AI/API cost + timp publicare',
    warning:'Generarea SEO/AI poate consuma cost si poate bloca flow-uri daca ruleaza sincron.',
    recommendation:'Ruleaza generarea in background, cache pe slug si template. Refoloseste continutul pentru pagini similare si marcheaza necesita_review.',
    metric:'AI calls/day, cost/call, generated pages reviewed, publish latency',
  },
  {
    title:'Batch pentru notificari low-priority',
    process:'remind-inactive-buyers, remind-inactive-agents, remind-no-viewing',
    area:'Resurse externe',
    priority:'Mediu',
    effort:'Mediu',
    saving:'Brevo quota + user fatigue',
    warning:'Multe remindere de reactivare au valoare mai mica decat notificari tranzactionale.',
    recommendation:'Grupeaza low-priority reminders intr-un digest zilnic/saptamanal si pastreaza email instant doar pentru oferte, plati, expirari si matching important.',
    metric:'email/user/week, unsubscribe, reactivari/email, Brevo daily cap usage',
  },
  {
    title:'Audit pentru functiile publice cu verify_jwt=false',
    process:'create-guest-request, create-checkout, webhooks, public SEO endpoints',
    area:'Securitate',
    priority:'Ridicat',
    effort:'Mediu',
    saving:'Risc operational + spam traffic',
    warning:'Functiile publice sunt necesare, dar pot fi abuzate daca lipsesc rate-limit, semnatura sau idempotenta.',
    recommendation:'Fa inventar lunar pentru functii publice, adauga rate-limit pe IP/user-agent, semnatura pentru webhooks si audit table pentru request-uri sensibile.',
    metric:'rate-limit hits, 401/403, webhook signature failures, requests/IP/hour',
  },
  {
    title:'Health score pentru fiecare integrare externa',
    process:'Stripe, Brevo, Cloudflare, GA4, ImmoFlux, REBS, Renet, Whatchimp/Twilio',
    area:'Observability',
    priority:'Ridicat',
    effort:'Mediu',
    saving:'Timp diagnostic + pierderi lead/plati',
    warning:'Cand o integrare cade, simptomele apar in multe locuri: emailuri lipsa, CRM fara date, plati neconfirmate.',
    recommendation:'Creeaza status per provider: ultimul success, ultimele 5 erori, rata de succes 24h si buton de test. Afiseaza alerta daca providerul are 3 erori consecutive.',
    metric:'success rate/provider, last_success_at, consecutive_errors, affected workflows',
  },
  {
    title:'Data quality checks pentru cereri si proprietati',
    process:'create-guest-request, imports CRM, edit request/property',
    area:'Calitate date',
    priority:'Ridicat',
    effort:'Mediu',
    saving:'Matching gresit + suport manual',
    warning:'Campuri lipsa sau mapate gresit pot strica scorul, matchingul si SEO fara sa produca erori tehnice evidente.',
    recommendation:'Ruleaza zilnic check-uri pentru cereri fara avans/metoda plata, fara cartiere mapate, proprietati fara localitate/cartier/pret si scoruri 0 nejustificate.',
    metric:'records with missing critical fields, scoruri 0, unmatched geo, CRM mapping issues',
  },
  {
    title:'SLO pentru flow-uri de conversie critice',
    process:'/vreau, create-guest-request, /concierge, create-checkout',
    area:'UX & conversie',
    priority:'Critic',
    effort:'Mediu',
    saving:'Conversii pierdute',
    warning:'Chiar daca serverul raspunde, conversia poate cadea daca formularul sau plata au erori silentioase.',
    recommendation:'Defineste SLO-uri: submit cerere < 2s, error rate < 1%, checkout link creat < 3s. Alerta cand scade funnel-ul sau cresc validari blocate.',
    metric:'form_start -> request_created, validation_error rate, checkout_created rate, p95 submit latency',
  },
  {
    title:'Replay safe pentru webhooks si procese financiare',
    process:'stripe-webhook, CRM webhooks, payment-reminder',
    area:'Reliability',
    priority:'Ridicat',
    effort:'Mediu',
    saving:'Corectitudine plati + audit',
    warning:'Webhookurile pot ajunge de mai multe ori sau in ordine diferita; fara idempotenta pot dubla efecte.',
    recommendation:'Stocheaza provider_event_id si payload hash, marcheaza processed/skipped/error si permite replay manual doar pentru event-uri esuate.',
    metric:'duplicate webhook skipped, failed replay success, payment_status mismatches',
  },
  {
    title:'Separare notificari tranzactionale vs growth',
    process:'send-notification-email, campaign/reminder functions',
    area:'Resurse externe',
    priority:'Mediu',
    effort:'Mic',
    saving:'Deliverability + Brevo reputation',
    warning:'Daca emailurile de growth consuma reputatia/daily cap, pot afecta notificari importante de oferta/plata.',
    recommendation:'Foloseste categorii de prioritate si sender/template separat pentru tranzactional, operational si growth. Rezerva quota pentru plati, oferte si expirari.',
    metric:'deliverability by category, daily cap reserve, transactional delay',
  },
  {
    title:'Arhivare date voluminoase si TTL pentru audit logs',
    process:'notifications, matching_results, crm import logs, analytics cache',
    area:'Server',
    priority:'Mediu',
    effort:'Mediu',
    saving:'DB storage + query speed',
    warning:'Tabelele de audit si matching cresc constant si pot incetini pagini admin sau cron-uri.',
    recommendation:'Pastreaza active/recent in tabele rapide, muta istoricul vechi in arhiva lunara si adauga politici TTL pentru logs fara valoare operationala.',
    metric:'table size, index bloat, query p95, archived rows/month',
  },
  {
    title:'Buget lunar pentru AI si generare automata',
    process:'generate-seo, recommendations, any AI helper',
    area:'AI',
    priority:'Mediu',
    effort:'Mic',
    saving:'Cost AI predictibil',
    warning:'Procesele AI pot parea ieftine per apel, dar cresc cu pagini, recomandari si regenerari manuale.',
    recommendation:'Logheaza fiecare apel AI cu feature, tokens/cost estimat si user/admin trigger. Pune prag lunar si fallback pe template cand depaseste bugetul.',
    metric:'AI calls/month, estimated cost, cache reuse, manual regenerations',
  },
  {
    title:'Prioritizeaza joburile dupa impact business',
    process:'process-delayed-notifications, reminders, matching, imports',
    area:'Observability',
    priority:'Mediu',
    effort:'Mediu',
    saving:'Resurse pe joburi cu valoare mare',
    warning:'Cron-urile ruleaza uniform, dar nu toate au aceeasi valoare cand resursele sau providerii sunt limitati.',
    recommendation:'Adauga priority queue: plati/oferte/expirari > matching > CRM sync > growth reminders > SEO/social. Cand providerul e aproape de limita, ruleaza doar prioritatile mari.',
    metric:'jobs skipped by priority, business events protected, queue lag by priority',
  },
]

const PAGE_SIZE_OPTIONS = [10, 20, 50]
const RISK_ORDER = { Scazut: 1, Mediu: 2, Ridicat: 3 }
const SORTABLE_COLUMNS = [
  { label:'Proces', key:'name', align:'left' },
  { label:'Frecventa', key:'frequency', align:'left' },
  { label:'Target', key:'target', align:'left' },
  { label:'Resurse consumate', key:'resources', align:'left' },
  { label:'Ce monitorizam', key:'monitor', align:'left' },
  { label:'Risc', key:'risk', align:'right' },
]

function normalize(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function sortValue(row, key) {
  if (key === 'risk') return RISK_ORDER[row.risk] || 99
  return normalize(row[key])
}

function compareRows(left, right, key, direction) {
  const a = sortValue(left, key)
  const b = sortValue(right, key)
  const multiplier = direction === 'desc' ? -1 : 1
  if (typeof a === 'number' && typeof b === 'number') return (a - b) * multiplier
  return String(a).localeCompare(String(b), 'ro', { numeric:true, sensitivity:'base' }) * multiplier
}

function buildDynamicOptimizationRecommendations() {
  const highRisk = PROCESS_CATALOG.filter(row => row.risk === 'Ridicat')
  const activeCron = PROCESS_CATALOG.filter(row => row.type === 'Cron' && row.status === 'Activ')
  const external = PROCESS_CATALOG.filter(row => /Brevo|Stripe|Google|Cloudflare|CRM|Whatchimp|Twilio|ImmoFlux|REBS|Renet|API extern/i.test(row.resources))
  const legacy = PROCESS_CATALOG.filter(row => normalize(row.status).includes('dezactivat') || row.category === 'Legacy')
  const matching = PROCESS_CATALOG.filter(row => row.category === 'Matching AI')
  const crm = PROCESS_CATALOG.filter(row => row.category === 'CRM')

  return [
    highRisk.length > 0 && {
      title:`Auto: ${highRisk.length} procese cu risc ridicat necesita praguri de alerta`,
      process:highRisk.slice(0, 5).map(row => row.name).join(', '),
      area:'Observability',
      priority:'Ridicat',
      effort:'Mic',
      saving:'Diagnostic rapid + reducere timp incident',
      warning:`Catalogul contine ${highRisk.length} procese marcate cu risc ridicat. Fara praguri, problemele apar abia cand userii raporteaza.`,
      recommendation:'Seteaza praguri simple: error rate > 2%, p95 peste prag, 3 erori consecutive sau 0 rezultate cand ar trebui sa existe activitate.',
      metric:'error_rate, p95_duration, consecutive_errors, zero_result_anomaly',
    },
    activeCron.length > 8 && {
      title:`Auto: ${activeCron.length} cron-uri active pot concura pe resurse`,
      process:activeCron.slice(0, 6).map(row => row.name).join(', '),
      area:'Server',
      priority:'Mediu',
      effort:'Mic',
      saving:'Edge concurrency + DB load',
      warning:'Multe joburi programate in aceleasi ferestre orare pot genera varfuri de DB si Edge Runtime.',
      recommendation:'Grupeaza cron-urile dupa prioritate si evita ca matching, importuri CRM si notificari batch sa ruleze simultan. Adauga jitter de 5-15 minute pentru procese non-critice.',
      metric:'concurrent cron invocations, DB CPU, queue lag, p95 duration by hour',
    },
    external.length > 0 && {
      title:`Auto: ${external.length} procese depind de API-uri externe`,
      process:external.slice(0, 6).map(row => row.name).join(', '),
      area:'Resurse externe',
      priority:'Ridicat',
      effort:'Mediu',
      saving:'Quota + cost provider + stabilitate',
      warning:'Dependintele externe pot produce costuri, rate limits si erori partiale care nu apar ca erori DB.',
      recommendation:'Adauga health score per provider, retry cu backoff si circuit breaker. Pentru Brevo/WhatsApp/CRM, logheaza costul si statusul per request.',
      metric:'provider_success_rate, provider_latency, quota_used, retry_count',
    },
    legacy.length > 0 && {
      title:`Auto: ${legacy.length} proces legacy/dezactivat trebuie curatat din runtime`,
      process:legacy.map(row => row.name).join(', '),
      area:'Server',
      priority:'Mediu',
      effort:'Mic',
      saving:'Zgomot operational + invocari inutile',
      warning:'Procesele legacy pot ramane in cron, docs sau notificari si pot crea confuzie in analiza.',
      recommendation:'Verifica pg_cron, config admin si notification types. Pastreaza doar documentatia de istoric, nu schedule activ.',
      metric:'0 invocari legacy, 0 notificari deprecated, 0 cron jobs obsolete',
    },
    matching.length >= 2 && {
      title:'Auto: matchingul are nevoie de metrici pe pereche, nu doar pe rulare',
      process:matching.map(row => row.name).join(', '),
      area:'Calitate date',
      priority:'Ridicat',
      effort:'Mediu',
      saving:'Recomandari mai bune + mai putine rulari inutile',
      warning:'Daca vezi doar cate recomandari s-au creat, nu stii daca scorul, zona sau pretul au blocat matchingul.',
      recommendation:'Logheaza per rulare cate perechi au fost evaluate, respinse pe pret, respinse pe zona, aprobate si transformate in oferte.',
      metric:'pairs_evaluated, price_rejected, zone_rejected, approved_to_offer_rate',
    },
    crm.length > 0 && {
      title:`Auto: ${crm.length} procese CRM necesita audit de dezactivare proprietati`,
      process:crm.slice(0, 6).map(row => row.name).join(', '),
      area:'Calitate date',
      priority:'Ridicat',
      effort:'Mediu',
      saving:'Prevenire dezactivari gresite + matching corect',
      warning:'Importurile CRM pot modifica statusuri si campuri critice fara feedback vizibil pentru agent.',
      recommendation:'Pentru fiecare proprietate dezactivata, salveaza source: manual, CRM, webhook, import, API, auto-cleanup. Afiseaza motivul in admin/proprietati.',
      metric:'inactive_by_source, crm_payload_changes, properties_reactivated',
    },
  ].filter(Boolean)
}

function mergeRecommendations(dynamicRows, curatedRows) {
  const seen = new Set()
  return [...dynamicRows, ...curatedRows].filter(item => {
    const key = normalize(item.title)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function uniqueOptions(rows, key) {
  return Array.from(new Set(rows.map(row => row[key]).filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b), 'ro'))
}

function riskColor(risk) {
  if (risk === 'Ridicat') return C.red
  if (risk === 'Mediu') return C.amber
  return C.green
}

function statusColor(status) {
  if (String(status).toLowerCase().includes('dezactivat')) return C.gray
  if (String(status).toLowerCase().includes('partial')) return C.amber
  return C.green
}

function priorityColor(priority) {
  if (priority === 'Critic') return C.red
  if (priority === 'Ridicat') return C.amber
  return C.blue
}

function areaColor(area) {
  if (area === 'Viteza') return C.blue
  if (area === 'Server') return C.purple
  if (area === 'AI') return C.teal
  if (area === 'Resurse externe') return C.amber
  if (area === 'Reliability') return C.green
  if (area === 'Securitate') return C.red
  if (area === 'Calitate date') return C.purple
  if (area === 'UX & conversie') return C.green
  if (area === 'Observability') return C.blue
  return C.gray
}

function Badge({ children, color, soft }) {
  return (
    <span style={{
      display:'inline-flex',alignItems:'center',width:'fit-content',padding:'3px 8px',borderRadius:999,
      background:soft || C.softPanel,color,fontSize:11,fontWeight:600,whiteSpace:'nowrap',
    }}>
      {children}
    </span>
  )
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding:'9px 14px',border:'none',borderBottom:`2px solid ${active ? C.blue : 'transparent'}`,
        background:'transparent',color:active ? C.blue : C.muted,cursor:'pointer',fontSize:13,
        fontWeight:active ? 700 : 500,
      }}
    >
      {children}
    </button>
  )
}

function HeaderShell({ darkMode, toggleTheme }) {
  return (
    <div style={{background:C.card,borderBottom:`0.5px solid ${C.border}`,padding:'0 16px',display:'flex',alignItems:'center',gap:12,minHeight:52,position:'sticky',top:0,zIndex:10,flexWrap:'wrap'}}>
      <div style={{display:'flex',alignItems:'center',gap:8}}>
        <div style={{width:26,height:26,borderRadius:6,background:darkMode?'#1d4ed8':C.navy,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:600,fontSize:12}}>H</div>
        <span style={{fontSize:14,fontWeight:600,color:C.text}}>Procese automate</span>
        <span style={{fontSize:11,color:C.hint}}>· HomePitch Analytics</span>
      </div>
      <div style={{flex:1}}/>
      <ThemeSwitch darkMode={darkMode} onToggle={toggleTheme}/>
      <a href="/dashboard" style={{padding:'4px 10px',fontSize:11,border:`0.5px solid ${C.border}`,borderRadius:6,background:'transparent',color:C.muted,textDecoration:'none'}}>Trafic</a>
      <a href="/dashboard/cereri-piata" style={{padding:'4px 10px',fontSize:11,border:`0.5px solid ${C.green}`,borderRadius:6,background:C.softGreen,color:C.green,textDecoration:'none'}}>Cereri piata</a>
      <a href="/dashboard/concierge" style={{padding:'4px 10px',fontSize:11,border:`0.5px solid ${C.amber}`,borderRadius:6,background:C.softAmber,color:C.amber,textDecoration:'none'}}>Concierge CRM</a>
      <a href="/dashboard/cereri-oferte" style={{padding:'4px 10px',fontSize:11,border:`0.5px solid ${C.purple}`,borderRadius:6,background:'rgba(124,58,237,.10)',color:C.purple,textDecoration:'none'}}>Cereri/Oferte</a>
    </div>
  )
}

function OptimizationRecommendations() {
  const [area, setArea] = useState('toate')
  const [priority, setPriority] = useState('toate')
  const [query, setQuery] = useState('')
  const [analysisVersion, setAnalysisVersion] = useState(0)
  const [generatedAt, setGeneratedAt] = useState(() => new Date().toISOString())
  const dynamicRecommendations = useMemo(() => buildDynamicOptimizationRecommendations(), [analysisVersion])
  const recommendations = useMemo(
    () => mergeRecommendations(dynamicRecommendations, OPTIMIZATION_RECOMMENDATIONS),
    [dynamicRecommendations],
  )
  const areas = uniqueOptions(recommendations, 'area')
  const priorities = uniqueOptions(recommendations, 'priority')
  const rows = useMemo(() => {
    const q = normalize(query)
    return recommendations.filter(item => {
      const text = normalize(`${item.title} ${item.process} ${item.area} ${item.priority} ${item.warning} ${item.recommendation} ${item.metric} ${item.saving}`)
      return (!q || text.includes(q))
        && (area === 'toate' || item.area === area)
        && (priority === 'toate' || item.priority === priority)
    }).sort((a, b) => {
      const priorityRank = { Critic: 1, Ridicat: 2, Mediu: 3 }
      return (priorityRank[a.priority] || 9) - (priorityRank[b.priority] || 9)
    })
  }, [area, priority, query, recommendations])
  const critical = recommendations.filter(item => item.priority === 'Critic').length
  const serverSavings = recommendations.filter(item => item.area === 'Server').length
  const externalSavings = recommendations.filter(item => item.area === 'Resurse externe').length
  const aiSavings = recommendations.filter(item => item.area === 'AI').length
  const rerunAnalysis = () => {
    setAnalysisVersion(current => current + 1)
    setGeneratedAt(new Date().toISOString())
  }

  return (
    <div>
      <section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:8,marginBottom:16}}>
        <SummaryCard label="Warnings totale" value={recommendations.length} sub="optimizari propuse"/>
        <SummaryCard label="Auto-generate" value={dynamicRecommendations.length} sub="din catalogul curent" color={C.blue}/>
        <SummaryCard label="Critice" value={critical} sub="prioritate imediata" color={C.red}/>
        <SummaryCard label="Saving server" value={serverSavings} sub="DB scan / Edge duration" color={C.purple}/>
        <SummaryCard label="Saving extern" value={externalSavings} sub="Brevo, CRM, WhatsApp" color={C.amber}/>
        <SummaryCard label="Saving AI" value={aiSavings} sub="generare/cache" color={C.teal}/>
      </section>

      <section style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:14,padding:'14px',marginBottom:14}}>
        <div style={{display:'grid',gridTemplateColumns:'minmax(220px,1.4fr) minmax(130px,.7fr) minmax(130px,.7fr) minmax(190px,.8fr)',gap:8,alignItems:'end'}}>
          <label>
            <span style={{fontSize:10,color:C.hint,textTransform:'uppercase',letterSpacing:'.06em',display:'block',marginBottom:5}}>Search recomandari</span>
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Cauta proces, saving, AI, Brevo, matching..." style={{width:'100%',boxSizing:'border-box',padding:'9px 10px',border:`0.5px solid ${C.border}`,borderRadius:8,background:C.input,color:C.text,fontSize:13,outline:'none'}}/>
          </label>
          <label>
            <span style={{fontSize:10,color:C.hint,textTransform:'uppercase',letterSpacing:'.06em',display:'block',marginBottom:5}}>Obiectiv</span>
            <select value={area} onChange={event => setArea(event.target.value)} style={{width:'100%',boxSizing:'border-box',padding:'9px 8px',border:`0.5px solid ${C.border}`,borderRadius:8,background:C.input,color:C.text,fontSize:12}}>
              <option value="toate">Toate</option>
              {areas.map(option => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label>
            <span style={{fontSize:10,color:C.hint,textTransform:'uppercase',letterSpacing:'.06em',display:'block',marginBottom:5}}>Prioritate</span>
            <select value={priority} onChange={event => setPriority(event.target.value)} style={{width:'100%',boxSizing:'border-box',padding:'9px 8px',border:`0.5px solid ${C.border}`,borderRadius:8,background:C.input,color:C.text,fontSize:12}}>
              <option value="toate">Toate</option>
              {priorities.map(option => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <div>
            <button
              onClick={rerunAnalysis}
              style={{width:'100%',padding:'9px 10px',border:`0.5px solid ${C.blue}`,borderRadius:8,background:C.softBlue,color:C.blue,fontSize:12,fontWeight:700,cursor:'pointer'}}
            >
              Reincarca recomandari
            </button>
            <p style={{fontSize:10,color:C.hint,margin:'6px 0 0',lineHeight:1.3}}>
              Ultima analiza: {new Date(generatedAt).toLocaleString('ro-RO')}
            </p>
          </div>
        </div>
      </section>

      <section style={{display:'grid',gap:10}}>
        {rows.map(item => {
          const pColor = priorityColor(item.priority)
          const aColor = areaColor(item.area)
          return (
            <article key={item.title} style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:14,padding:'14px 16px',borderLeft:`4px solid ${pColor}`}}>
              <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'flex-start',flexWrap:'wrap',marginBottom:8}}>
                <div style={{minWidth:220,flex:'1 1 420px'}}>
                  <h2 style={{fontSize:15,lineHeight:1.25,color:C.text,margin:'0 0 6px'}}>{item.title}</h2>
                  <p style={{fontSize:12,color:C.hint,margin:0}}>{item.process}</p>
                </div>
                <div style={{display:'flex',gap:6,flexWrap:'wrap',justifyContent:'flex-end'}}>
                  <Badge color={pColor}>{item.priority}</Badge>
                  <Badge color={aColor}>{item.area}</Badge>
                  <Badge color={C.gray}>{item.effort}</Badge>
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:10}}>
                <div style={{background:C.softRed,border:`0.5px solid ${C.red}`,borderRadius:10,padding:'10px 12px'}}>
                  <p style={{fontSize:10,color:C.red,textTransform:'uppercase',letterSpacing:'.06em',fontWeight:700,margin:'0 0 5px'}}>Warning</p>
                  <p style={{fontSize:13,color:C.text,lineHeight:1.5,margin:0}}>{item.warning}</p>
                </div>
                <div style={{background:C.softGreen,border:`0.5px solid ${C.green}`,borderRadius:10,padding:'10px 12px'}}>
                  <p style={{fontSize:10,color:C.green,textTransform:'uppercase',letterSpacing:'.06em',fontWeight:700,margin:'0 0 5px'}}>Recomandare</p>
                  <p style={{fontSize:13,color:C.text,lineHeight:1.5,margin:0}}>{item.recommendation}</p>
                </div>
                <div style={{background:C.softBlue,border:`0.5px solid ${C.blue}`,borderRadius:10,padding:'10px 12px'}}>
                  <p style={{fontSize:10,color:C.blue,textTransform:'uppercase',letterSpacing:'.06em',fontWeight:700,margin:'0 0 5px'}}>Monitorizare</p>
                  <p style={{fontSize:13,color:C.text,lineHeight:1.5,margin:'0 0 7px'}}>{item.metric}</p>
                  <p style={{fontSize:12,color:C.muted,lineHeight:1.45,margin:0}}><strong style={{color:C.text}}>Saving:</strong> {item.saving}</p>
                </div>
              </div>
            </article>
          )
        })}
        {rows.length === 0 && (
          <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:14,padding:'26px',textAlign:'center',color:C.hint,fontSize:13}}>
            Nu exista recomandari pentru filtrele selectate.
          </div>
        )}
      </section>
    </div>
  )
}

function SummaryCard({ label, value, sub, color = C.text }) {
  return (
    <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:12,padding:'14px 16px'}}>
      <p style={{fontSize:10,color:C.hint,textTransform:'uppercase',letterSpacing:'.06em',margin:'0 0 7px',fontWeight:600}}>{label}</p>
      <div style={{fontSize:26,lineHeight:1,fontWeight:700,color}}>{value}</div>
      <p style={{fontSize:12,color:C.muted,margin:'7px 0 0',lineHeight:1.35}}>{sub}</p>
    </div>
  )
}

function ProcessRow({ row }) {
  const [open, setOpen] = useState(false)
  const rowRiskColor = riskColor(row.risk)
  const rowStatusColor = statusColor(row.status)
  return (
    <>
      <tr style={{borderBottom:`0.5px solid ${C.border}`,verticalAlign:'top'}}>
        <td style={{padding:'11px 10px',minWidth:220}}>
          <button onClick={()=>setOpen(current => !current)} style={{border:'none',background:'transparent',padding:0,cursor:'pointer',fontSize:13,fontWeight:700,color:C.text,textAlign:'left'}}>
            {row.name}
          </button>
          <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:6}}>
            <Badge color={C.blue} soft={C.softBlue}>{row.category}</Badge>
            <Badge color={rowStatusColor}>{row.status}</Badge>
          </div>
        </td>
        <td style={{padding:'11px 10px',minWidth:130}}>
          <Badge color={C.purple}>{row.type}</Badge>
          <p style={{fontSize:12,color:C.muted,margin:'8px 0 0',lineHeight:1.45}}>{row.frequency}</p>
        </td>
        <td style={{padding:'11px 10px',minWidth:220,fontSize:12,color:C.text,lineHeight:1.45}}>{row.target}</td>
        <td style={{padding:'11px 10px',minWidth:230,fontSize:12,color:C.muted,lineHeight:1.45}}>{row.resources}</td>
        <td style={{padding:'11px 10px',minWidth:220,fontSize:12,color:C.muted,lineHeight:1.45}}>{row.monitor}</td>
        <td style={{padding:'11px 10px',textAlign:'right',minWidth:90}}>
          <Badge color={rowRiskColor}>{row.risk}</Badge>
        </td>
      </tr>
      {open && (
        <tr style={{borderBottom:`0.5px solid ${C.border}`,background:C.softPanel}}>
          <td colSpan={6} style={{padding:'12px 14px'}}>
            <p style={{fontSize:13,color:C.text,margin:'0 0 8px',fontWeight:600}}>Descriere</p>
            <p style={{fontSize:13,color:C.muted,margin:0,lineHeight:1.6}}>{row.description}</p>
          </td>
        </tr>
      )}
    </>
  )
}

function SortHeader({ column, sortConfig, onSort }) {
  const active = sortConfig.key === column.key
  const arrow = active ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'
  return (
    <th style={{padding:'0',textAlign:column.align,fontSize:10,color:C.hint,textTransform:'uppercase',letterSpacing:'.06em',fontWeight:700}}>
      <button
        onClick={() => onSort(column.key)}
        title={`Sorteaza dupa ${column.label}`}
        style={{
          width:'100%',height:'100%',padding:'9px 10px',border:'none',background:'transparent',
          color:active ? C.blue : C.hint,cursor:'pointer',fontSize:10,fontWeight:700,
          textTransform:'uppercase',letterSpacing:'.06em',display:'flex',gap:5,
          justifyContent:column.align === 'right' ? 'flex-end' : 'flex-start',alignItems:'center',
        }}
      >
        <span>{column.label}</span>
        <span style={{fontSize:11,lineHeight:1,color:active ? C.blue : C.hint}}>{arrow}</span>
      </button>
    </th>
  )
}

export default function AutomatedProcessesPage() {
  const [darkMode, setDarkMode] = useState(false)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('toate')
  const [type, setType] = useState('toate')
  const [status, setStatus] = useState('toate')
  const [risk, setRisk] = useState('toate')
  const [pageSize, setPageSize] = useState(20)
  const [page, setPage] = useState(1)
  const [sortConfig, setSortConfig] = useState({ key:'name', direction:'asc' })
  const [activeTab, setActiveTab] = useState('inventory')

  useEffect(() => {
    setDarkMode(localStorage.getItem(THEME_STORAGE_KEY) === 'dark')
  }, [])

  function toggleTheme() {
    setDarkMode(current => {
      const next = !current
      localStorage.setItem(THEME_STORAGE_KEY, next ? 'dark' : 'light')
      return next
    })
  }

  const filtered = useMemo(() => {
    const q = normalize(query)
    return PROCESS_CATALOG.filter(row => {
      const text = normalize(`${row.name} ${row.category} ${row.type} ${row.status} ${row.frequency} ${row.target} ${row.description} ${row.resources} ${row.monitor}`)
      return (!q || text.includes(q))
        && (category === 'toate' || row.category === category)
        && (type === 'toate' || row.type === type)
        && (status === 'toate' || row.status === status)
        && (risk === 'toate' || row.risk === risk)
    })
  }, [query, category, type, status, risk])

  const sortedRows = useMemo(() => {
    return [...filtered].sort((left, right) => compareRows(left, right, sortConfig.key, sortConfig.direction))
  }, [filtered, sortConfig])

  useEffect(() => {
    setPage(1)
  }, [query, category, type, status, risk, pageSize])

  function handleSort(key) {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }))
    setPage(1)
  }

  const pageCount = Math.max(1, Math.ceil(sortedRows.length / pageSize))
  const safePage = Math.min(page, pageCount)
  const visibleRows = sortedRows.slice((safePage - 1) * pageSize, safePage * pageSize)
  const externalCount = PROCESS_CATALOG.filter(row => /Brevo|Stripe|Google|Cloudflare|CRM|Whatchimp|Twilio|ImmoFlux|REBS|Renet|API extern/i.test(row.resources)).length
  const cronCount = PROCESS_CATALOG.filter(row => row.type === 'Cron' && row.status === 'Activ').length
  const highRiskCount = PROCESS_CATALOG.filter(row => row.risk === 'Ridicat').length
  const disabledCount = PROCESS_CATALOG.filter(row => normalize(row.status).includes('dezactivat')).length
  const theme = darkMode ? DARK_THEME : LIGHT_THEME

  return (
    <div style={{minHeight:'100vh',background:C.bg,color:C.text,...theme}}>
      <HeaderShell darkMode={darkMode} toggleTheme={toggleTheme}/>
      <main style={{maxWidth:1280,margin:'0 auto',padding:'22px 16px 40px'}}>
        <section style={{display:'grid',gridTemplateColumns:'minmax(0,1.15fr) minmax(260px,.85fr)',gap:14,marginBottom:16}}>
          <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:14,padding:'18px 20px'}}>
            <p style={{fontSize:11,color:C.blue,textTransform:'uppercase',letterSpacing:'.08em',fontWeight:700,margin:'0 0 8px'}}>Operational map</p>
            <h1 style={{fontSize:28,lineHeight:1.1,color:C.text,margin:'0 0 8px'}}>Edge functions si procese automate HomePitch</h1>
            <p style={{fontSize:14,color:C.muted,lineHeight:1.6,margin:0}}>
              Inventar pentru cron-uri, webhooks, trigger-e si procese manuale: ce fac, pe cine vizeaza,
              cat de des ruleaza, ce resurse ating si ce merita monitorizat ca sa prinzi costuri, erori si blocaje.
            </p>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
            <SummaryCard label="Procese mapate" value={PROCESS_CATALOG.length} sub="din cod si config HomePitch"/>
            <SummaryCard label="Cron active" value={cronCount} sub="ruleaza automat" color={C.blue}/>
            <SummaryCard label="Risc ridicat" value={highRiskCount} sub="scan DB/API extern/plati" color={C.red}/>
            <SummaryCard label="Dependinte externe" value={externalCount} sub="Brevo, Stripe, CRM, Google etc." color={C.amber}/>
          </div>
        </section>

        <section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:8,marginBottom:18}}>
          {MONITORING_AREAS.map(area => (
            <div key={area.title} style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:12,padding:'13px 14px',borderTop:`3px solid ${area.accent}`}}>
              <p style={{fontSize:13,fontWeight:700,color:C.text,margin:'0 0 5px'}}>{area.title}</p>
              <p style={{fontSize:12,color:C.muted,lineHeight:1.5,margin:0}}>{area.body}</p>
            </div>
          ))}
        </section>

        <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:14,display:'flex',gap:0,overflowX:'auto',marginBottom:16}}>
          <TabButton active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')}>Inventar procese</TabButton>
          <TabButton active={activeTab === 'optimizations'} onClick={() => setActiveTab('optimizations')}>Warnings & optimizari</TabButton>
        </div>

        {activeTab === 'inventory' ? (
          <>
        <section style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:14,padding:'14px 14px 10px',marginBottom:16}}>
          <div style={{display:'grid',gridTemplateColumns:'minmax(220px,1.6fr) repeat(5,minmax(120px,1fr))',gap:8,alignItems:'end'}}>
            <label style={{display:'block'}}>
              <span style={{fontSize:10,color:C.hint,textTransform:'uppercase',letterSpacing:'.06em',display:'block',marginBottom:5}}>Search</span>
              <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Cauta dupa functie, target, resurse, monitorizare..." style={{width:'100%',boxSizing:'border-box',padding:'9px 10px',border:`0.5px solid ${C.border}`,borderRadius:8,background:C.input,color:C.text,fontSize:13,outline:'none'}}/>
            </label>
            {[
              ['Categorie', category, setCategory, uniqueOptions(PROCESS_CATALOG, 'category')],
              ['Tip', type, setType, uniqueOptions(PROCESS_CATALOG, 'type')],
              ['Status', status, setStatus, uniqueOptions(PROCESS_CATALOG, 'status')],
              ['Risc', risk, setRisk, uniqueOptions(PROCESS_CATALOG, 'risk')],
            ].map(([label, value, setter, options]) => (
              <label key={label} style={{display:'block'}}>
                <span style={{fontSize:10,color:C.hint,textTransform:'uppercase',letterSpacing:'.06em',display:'block',marginBottom:5}}>{label}</span>
                <select value={value} onChange={event => setter(event.target.value)} style={{width:'100%',boxSizing:'border-box',padding:'9px 8px',border:`0.5px solid ${C.border}`,borderRadius:8,background:C.input,color:C.text,fontSize:12}}>
                  <option value="toate">Toate</option>
                  {options.map(option => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
            ))}
            <label style={{display:'block'}}>
              <span style={{fontSize:10,color:C.hint,textTransform:'uppercase',letterSpacing:'.06em',display:'block',marginBottom:5}}>Pe pagina</span>
              <select value={pageSize} onChange={event => setPageSize(Number(event.target.value))} style={{width:'100%',boxSizing:'border-box',padding:'9px 8px',border:`0.5px solid ${C.border}`,borderRadius:8,background:C.input,color:C.text,fontSize:12}}>
                {PAGE_SIZE_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'center',marginTop:12,flexWrap:'wrap'}}>
            <p style={{fontSize:12,color:C.muted,margin:0}}>
              Afisate {visibleRows.length} din {filtered.length} procese filtrate. {disabledCount} proces(e) dezactivate/legacy in catalog.
            </p>
            <button onClick={()=>{setQuery('');setCategory('toate');setType('toate');setStatus('toate');setRisk('toate')}} style={{padding:'6px 10px',fontSize:12,border:`0.5px solid ${C.border}`,borderRadius:7,background:'transparent',color:C.muted,cursor:'pointer'}}>
              Reseteaza filtrele
            </button>
          </div>
        </section>

        <section style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:14,overflow:'hidden'}}>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead>
                <tr style={{borderBottom:`0.5px solid ${C.border}`,background:C.softPanel}}>
                  {SORTABLE_COLUMNS.map(column => (
                    <SortHeader key={column.key} column={column} sortConfig={sortConfig} onSort={handleSort}/>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map(row => <ProcessRow key={row.name} row={row}/>)}
              </tbody>
            </table>
          </div>
          {visibleRows.length === 0 && (
            <div style={{padding:'26px',textAlign:'center',color:C.hint,fontSize:13}}>Nu exista procese pentru filtrele selectate.</div>
          )}
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,padding:'12px 14px',borderTop:`0.5px solid ${C.border}`,flexWrap:'wrap'}}>
            <p style={{fontSize:12,color:C.hint,margin:0}}>Pagina {safePage} din {pageCount}</p>
            <div style={{display:'flex',gap:6}}>
              <button disabled={safePage <= 1} onClick={()=>setPage(current => Math.max(1, current - 1))} style={{padding:'6px 10px',fontSize:12,border:`0.5px solid ${C.border}`,borderRadius:7,background:'transparent',color:safePage <= 1 ? C.hint : C.text,cursor:safePage <= 1 ? 'not-allowed' : 'pointer'}}>Anterior</button>
              <button disabled={safePage >= pageCount} onClick={()=>setPage(current => Math.min(pageCount, current + 1))} style={{padding:'6px 10px',fontSize:12,border:`0.5px solid ${C.border}`,borderRadius:7,background:'transparent',color:safePage >= pageCount ? C.hint : C.text,cursor:safePage >= pageCount ? 'not-allowed' : 'pointer'}}>Urmator</button>
            </div>
          </div>
        </section>

        <section style={{marginTop:18,display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:10}}>
          <div style={{background:C.softBlue,border:`0.5px solid ${C.blue}`,borderRadius:12,padding:'14px 16px'}}>
            <p style={{fontSize:13,fontWeight:700,color:C.text,margin:'0 0 6px'}}>Urmatorul nivel de monitorizare</p>
            <p style={{fontSize:12,color:C.muted,lineHeight:1.55,margin:0}}>
              Pentru cifre reale, pagina ar trebui legata la logs Supabase/Vercel: invocari, duration, error rate,
              plus tabele de audit pentru notificari, matching, plati si importuri CRM.
            </p>
          </div>
          <div style={{background:C.softAmber,border:`0.5px solid ${C.amber}`,borderRadius:12,padding:'14px 16px'}}>
            <p style={{fontSize:13,fontWeight:700,color:C.text,margin:'0 0 6px'}}>Alerta prioritara</p>
            <p style={{fontSize:12,color:C.muted,lineHeight:1.55,margin:0}}>
              Primele alerte utile: Brevo aproape de limita zilnica, matching peste prag de durata,
              webhook Stripe esuat, cereri fara cartiere mapate si CRM import cu erori consecutive.
            </p>
          </div>
        </section>
          </>
        ) : (
          <OptimizationRecommendations/>
        )}
      </main>
    </div>
  )
}
