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
      </main>
    </div>
  )
}
